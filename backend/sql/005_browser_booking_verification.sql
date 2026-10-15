-- Read-only proof of the synthetic booking made through the browser on this computer.
USE qureflow_dbms;
SELECT a.id,a.patientId,a.doctorId,a.date,a.slotMinute,a.status appointmentStatus,
 t.tokenNumber,t.status tokenStatus,s.bookedCount,s.capacity
FROM appointments a JOIN queue_tokens t ON t.appointmentId=a.id
JOIN appointment_slots s ON s.doctorId=a.doctorId AND s.slotDate=a.date AND s.slotMinute=a.slotMinute
WHERE a.notes='Synthetic local browser verification 2026-10-13'
ORDER BY a.createdAt;
