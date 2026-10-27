SELECT fn_consultation_minutes('2026-10-19 10:00:00',
 '2026-10-19 10:12:30') AS minutes,
 fn_consultation_minutes(NULL,'2026-10-19 10:12:30') AS missingInput,
 fn_consultation_minutes('2026-10-19 11:00:00',
 '2026-10-19 10:00:00') AS reversedInput;