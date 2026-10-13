-- Read-only queries to execute in MySQL Workbench or the MySQL terminal.
USE qureflow_dbms;
SHOW TABLES;

-- Normalized joins: choose a gynecologist, ordered by consultation fee.
SELECT d.id,d.name,s.name AS specialty,c.name AS clinic,d.consultationFee
FROM doctors d JOIN specialties s ON s.id=d.specialtyId JOIN clinics c ON c.id=d.clinicId
WHERE s.name='Gynecology' AND d.status='active'
ORDER BY d.consultationFee,d.name;

-- Language and availability selection; SQL owns sorting and pagination.
SELECT d.name,d.specialization,d.clinicName,d.consultationFee
FROM doctor_directory d
WHERE d.isAvailableToday=TRUE AND EXISTS(
  SELECT 1 FROM doctor_languages dl JOIN languages l ON l.id=dl.languageId
  WHERE dl.doctorId=d.id AND l.name='Hindi')
ORDER BY d.experienceYears DESC,d.name LIMIT 9 OFFSET 0;

-- Actual queue order, with scheduled-time eligibility.
SELECT tokenNumber,patientName,priority,scheduledMinute
FROM visit_details WHERE doctorId='doc-1'
AND queueDate=DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+05:30')) AND status='waiting'
ORDER BY priority='emergency' DESC,tokenSeq;

-- Relational joins and aggregation.
SELECT c.name,s.name AS specialty,COUNT(*) AS doctorCount,ROUND(AVG(d.consultationFee),2) AS averageFee
FROM clinics c JOIN doctors d ON d.clinicId=c.id JOIN specialties s ON s.id=d.specialtyId
GROUP BY c.id,c.name,s.id,s.name ORDER BY c.name,s.name;
SELECT * FROM daily_patient_flow WHERE clinicId='clinic-1' ORDER BY date DESC LIMIT 14;

-- Function and procedures (the cursor procedure is read-only).
SELECT fn_consultation_minutes('2026-10-13 10:00:00','2026-10-13 10:12:30') AS minutes;
SET @clinic_day=DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+05:30'));
CALL sp_daily_patient_flow('clinic-1',@clinic_day-INTERVAL 13 DAY,@clinic_day);
CALL sp_doctor_workload_cursor('clinic-1',@clinic_day);
SHOW TRIGGERS;
SELECT ROUTINE_NAME,ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE();
SHOW CREATE TABLE queue_tokens;
EXPLAIN SELECT * FROM doctors WHERE specialtyId=6 AND clinicId='clinic-2' AND status='active';
