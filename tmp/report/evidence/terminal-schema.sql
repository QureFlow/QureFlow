SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion;
SELECT 'doctors' AS entity, COUNT(*) AS total FROM doctors
UNION ALL SELECT 'appointments',COUNT(*) FROM appointments
UNION ALL SELECT 'queue_tokens',COUNT(*) FROM queue_tokens;