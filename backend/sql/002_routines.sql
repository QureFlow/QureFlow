-- These routines run in the application, rather than serving as report-only examples.
-- Safe to retry this migration if an earlier initial setup stopped part-way through.
DROP FUNCTION IF EXISTS fn_consultation_minutes;
DROP TRIGGER IF EXISTS validate_token_transition;
DROP TRIGGER IF EXISTS audit_token_insert;
DROP TRIGGER IF EXISTS synchronize_token_update;
DROP PROCEDURE IF EXISTS sp_daily_patient_flow;
DROP PROCEDURE IF EXISTS sp_doctor_workload_cursor;
DELIMITER $$
CREATE FUNCTION fn_consultation_minutes(started DATETIME(3), finished DATETIME(3))
RETURNS DECIMAL(8,2) DETERMINISTIC NO SQL
BEGIN
  IF started IS NULL OR finished IS NULL OR finished < started OR TIMESTAMPDIFF(SECOND,started,finished)>7200 THEN RETURN NULL; END IF;
  RETURN ROUND(TIMESTAMPDIFF(MICROSECOND,started,finished)/60000000,2);
END$$
CREATE TRIGGER validate_token_transition BEFORE UPDATE ON queue_tokens FOR EACH ROW
BEGIN
  IF NEW.status<>OLD.status AND NOT (
    OLD.status='waiting' AND NEW.status IN ('current','skipped','cancelled') OR
    OLD.status='current' AND NEW.status IN ('completed','skipped')
  ) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid queue status transition'; END IF;
  IF NEW.status='current' AND EXISTS(SELECT 1 FROM queue_state WHERE doctorId=NEW.doctorId AND isPaused=TRUE)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Resume the queue before calling a patient'; END IF;
END$$
CREATE TRIGGER audit_token_insert AFTER INSERT ON queue_tokens FOR EACH ROW
BEGIN
  INSERT INTO audit_events(id,clinicId,entityType,entityId,action,actorId,requestId,details)
  SELECT UUID(),clinicId,'token',NEW.id,'created',COALESCE(@qf_actor,'sql-client'),COALESCE(@qf_request,UUID()),
    JSON_OBJECT('status',NEW.status,'queueDate',NEW.queueDate) FROM doctors WHERE id=NEW.doctorId;
END$$
CREATE TRIGGER synchronize_token_update AFTER UPDATE ON queue_tokens FOR EACH ROW
BEGIN
  IF NEW.status<>OLD.status THEN
    UPDATE appointments SET status=CASE NEW.status WHEN 'current' THEN 'in_consultation'
      WHEN 'skipped' THEN 'no_show' ELSE NEW.status END,
      version=version+1,updatedAt=UTC_TIMESTAMP(3)
    WHERE id=NEW.appointmentId;
    IF NEW.status IN ('cancelled','skipped') THEN
      UPDATE appointment_slots s JOIN appointments a ON a.doctorId=s.doctorId AND a.date=s.slotDate AND a.slotMinute=s.slotMinute
      SET s.bookedCount=GREATEST(0,s.bookedCount-1) WHERE a.id=NEW.appointmentId;
    END IF;
    INSERT INTO audit_events(id,clinicId,entityType,entityId,action,actorId,requestId,details)
    SELECT UUID(),clinicId,'token',NEW.id,'status_changed',COALESCE(@qf_actor,'sql-client'),COALESCE(@qf_request,UUID()),
      JSON_OBJECT('from',OLD.status,'to',NEW.status,'queueDate',NEW.queueDate) FROM doctors WHERE id=NEW.doctorId;
  END IF;
END$$
CREATE PROCEDURE sp_daily_patient_flow(IN facility VARCHAR(100), IN from_day DATE, IN until_day DATE)
READS SQL DATA
BEGIN
  WITH RECURSIVE dates AS (SELECT from_day AS date UNION ALL SELECT date+INTERVAL 1 DAY FROM dates WHERE date<until_day)
  SELECT dates.date,COALESCE(v.total,0) total,COALESCE(v.completed,0) completed,COALESCE(v.cancelled,0) cancelled,COALESCE(v.noShow,0) noShow
  FROM dates LEFT JOIN daily_patient_flow v ON v.date=dates.date AND v.clinicId=facility ORDER BY dates.date;
END$$
-- Cursor exercise: walk the clinic roster and return its current-day workload.
-- This is read-only. Normal operational aggregation uses GROUP BY.
CREATE PROCEDURE sp_doctor_workload_cursor(IN facility VARCHAR(100), IN visit_day DATE)
READS SQL DATA
BEGIN
  DECLARE finished BOOLEAN DEFAULT FALSE;
  DECLARE doctor_key VARCHAR(100);
  DECLARE doctor_name VARCHAR(200);
  DECLARE waiting_count INT;
  DECLARE result JSON DEFAULT JSON_ARRAY();
  DECLARE roster CURSOR FOR SELECT id,name FROM doctors WHERE clinicId=facility ORDER BY name;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished=TRUE;
  OPEN roster;
  read_roster: LOOP
    FETCH roster INTO doctor_key,doctor_name;
    IF finished THEN LEAVE read_roster; END IF;
    SELECT COUNT(*) INTO waiting_count FROM queue_tokens WHERE doctorId=doctor_key AND queueDate=visit_day AND status='waiting';
    SET result=JSON_ARRAY_APPEND(result,'$',JSON_OBJECT('doctorId',doctor_key,'name',doctor_name,'waiting',waiting_count));
  END LOOP;
  CLOSE roster;
  SELECT result AS workload;
END$$
DELIMITER ;
