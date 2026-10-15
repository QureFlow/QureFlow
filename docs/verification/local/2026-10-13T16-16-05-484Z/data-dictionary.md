# MySQL data dictionary

Generated from the running database. CHECK definitions and foreign keys are in schema.json.

| Relation | Attribute | Type | Nullable | Key | Default | Extra |
|---|---|---|---|---|---|---|
| appointment_details | id | varchar(100) | NO |  |  |  |
| appointment_details | patientId | varchar(100) | NO |  |  |  |
| appointment_details | doctorId | varchar(100) | NO |  |  |  |
| appointment_details | date | date | NO |  |  |  |
| appointment_details | slotMinute | int | NO |  |  |  |
| appointment_details | tokenNumber | varchar(100) | NO |  |  |  |
| appointment_details | status | enum('booked','waiting','in_consultation','completed','cancelled','no_show') | NO |  |  |  |
| appointment_details | priority | enum('normal','emergency') | NO |  |  |  |
| appointment_details | isWalkIn | tinyint(1) | NO |  | 0 |  |
| appointment_details | notes | text | YES |  |  |  |
| appointment_details | version | int | NO |  | 1 |  |
| appointment_details | metadata | json | YES |  |  |  |
| appointment_details | createdAt | datetime(3) | NO |  |  |  |
| appointment_details | updatedAt | datetime(3) | NO |  |  |  |
| appointment_details | patientName | varchar(200) | NO |  |  |  |
| appointment_details | patientPhone | varchar(20) | YES |  |  |  |
| appointment_details | doctorName | varchar(200) | NO |  |  |  |
| appointment_details | doctorSpecialization | varchar(100) | NO |  |  |  |
| appointment_details | clinicId | varchar(100) | NO |  |  |  |
| appointment_details | clinicName | varchar(200) | NO |  |  |  |
| appointment_details | tokenId | varchar(100) | YES |  |  |  |
| appointment_slots | doctorId | varchar(100) | NO | PRI |  |  |
| appointment_slots | slotDate | date | NO | PRI |  |  |
| appointment_slots | slotMinute | int | NO | PRI |  |  |
| appointment_slots | bookedCount | int | NO |  | 0 |  |
| appointment_slots | capacity | int | NO |  |  |  |
| appointments | id | varchar(100) | NO | PRI |  |  |
| appointments | patientId | varchar(100) | NO | MUL |  |  |
| appointments | doctorId | varchar(100) | NO | MUL |  |  |
| appointments | date | date | NO |  |  |  |
| appointments | slotMinute | int | NO |  |  |  |
| appointments | tokenNumber | varchar(100) | NO |  |  |  |
| appointments | status | enum('booked','waiting','in_consultation','completed','cancelled','no_show') | NO |  |  |  |
| appointments | priority | enum('normal','emergency') | NO |  |  |  |
| appointments | isWalkIn | tinyint(1) | NO |  | 0 |  |
| appointments | notes | text | YES |  |  |  |
| appointments | version | int | NO |  | 1 |  |
| appointments | metadata | json | YES |  |  |  |
| appointments | createdAt | datetime(3) | NO |  |  |  |
| appointments | updatedAt | datetime(3) | NO |  |  |  |
| audit_events | id | varchar(100) | NO | PRI |  |  |
| audit_events | clinicId | varchar(100) | YES | MUL |  |  |
| audit_events | entityType | varchar(60) | NO |  |  |  |
| audit_events | entityId | varchar(100) | NO |  |  |  |
| audit_events | action | varchar(60) | NO |  |  |  |
| audit_events | actorId | varchar(100) | NO |  |  |  |
| audit_events | requestId | varchar(100) | NO |  |  |  |
| audit_events | timestamp | datetime(3) | NO |  | CURRENT_TIMESTAMP(3) | DEFAULT_GENERATED |
| audit_events | details | json | YES |  |  |  |
| clinic_settings | clinicId | varchar(100) | NO | PRI |  |  |
| clinic_settings | averageConsultationMinutes | int | NO |  |  |  |
| clinic_settings | bufferMinutes | int | NO |  | 2 |  |
| clinic_settings | allowWalkIns | tinyint(1) | NO |  | 1 |  |
| clinic_settings | allowEmergencyPriority | tinyint(1) | NO |  | 1 |  |
| clinic_settings | notifyOnTwoAhead | tinyint(1) | NO |  | 0 |  |
| clinic_settings | autoTokenPrefixByDoctor | tinyint(1) | NO |  | 1 |  |
| clinic_settings | clinicName | varchar(200) | NO |  |  |  |
| clinic_settings | contactNumber | varchar(30) | NO |  |  |  |
| clinics | id | varchar(100) | NO | PRI |  |  |
| clinics | name | varchar(200) | NO |  |  |  |
| clinics | address | varchar(500) | NO |  |  |  |
| clinics | district | varchar(100) | NO |  |  |  |
| clinics | state | varchar(100) | NO |  |  |  |
| clinics | phone | varchar(20) | NO |  |  |  |
| clinics | email | varchar(254) | NO |  |  |  |
| clinics | openingHours | varchar(100) | NO |  |  |  |
| clinics | emergencyContact | varchar(30) | NO |  |  |  |
| clinics | metadata | json | YES |  |  |  |
| clinics | updatedAt | datetime(3) | NO |  | CURRENT_TIMESTAMP(3) | DEFAULT_GENERATED |
| daily_patient_flow | clinicId | varchar(100) | NO |  |  |  |
| daily_patient_flow | date | date | NO |  |  |  |
| daily_patient_flow | total | bigint | NO |  | 0 |  |
| daily_patient_flow | completed | decimal(23,0) | YES |  |  |  |
| daily_patient_flow | cancelled | decimal(23,0) | YES |  |  |  |
| daily_patient_flow | noShow | decimal(23,0) | YES |  |  |  |
| demo_seed | version | varchar(30) | NO | PRI |  |  |
| demo_seed | seededAt | datetime(3) | NO |  | CURRENT_TIMESTAMP(3) | DEFAULT_GENERATED |
| doctor_days | doctorId | varchar(100) | NO | PRI |  |  |
| doctor_days | dayOfWeek | enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') | NO | PRI |  |  |
| doctor_directory | id | varchar(100) | YES |  |  |  |
| doctor_directory | clinicId | varchar(100) | YES |  |  |  |
| doctor_directory | specialtyId | int | YES |  |  |  |
| doctor_directory | name | varchar(200) | YES |  |  |  |
| doctor_directory | qualifications | varchar(300) | YES |  |  |  |
| doctor_directory | experienceYears | int | YES |  |  |  |
| doctor_directory | consultationFee | decimal(10,2) | YES |  |  |  |
| doctor_directory | startMinute | int | YES |  |  |  |
| doctor_directory | endMinute | int | YES |  |  |  |
| doctor_directory | slotDurationMinutes | int | YES |  |  |  |
| doctor_directory | status | enum('active','inactive') | YES |  | active |  |
| doctor_directory | avatar | varchar(1000) | YES |  |  |  |
| doctor_directory | bio | text | YES |  |  |  |
| doctor_directory | roomNumber | varchar(30) | YES |  |  |  |
| doctor_directory | department | varchar(100) | YES |  |  |  |
| doctor_directory | registrationId | varchar(100) | YES |  |  |  |
| doctor_directory | metadata | json | YES |  |  |  |
| doctor_directory | clinicName | varchar(200) | NO |  |  |  |
| doctor_directory | district | varchar(100) | NO |  |  |  |
| doctor_directory | specialization | varchar(100) | NO |  |  |  |
| doctor_directory | isAvailableToday | int | NO |  | 0 |  |
| doctor_directory | consultationDays | json | YES |  |  |  |
| doctor_directory | languages | json | YES |  |  |  |
| doctor_directory | clinicalInterests | json | YES |  |  |  |
| doctor_interests | doctorId | varchar(100) | NO | PRI |  |  |
| doctor_interests | interest | varchar(200) | NO | PRI |  |  |
| doctor_languages | doctorId | varchar(100) | NO | PRI |  |  |
| doctor_languages | languageId | int | NO | PRI |  |  |
| doctors | id | varchar(100) | NO | PRI |  |  |
| doctors | clinicId | varchar(100) | NO | MUL |  |  |
| doctors | specialtyId | int | NO | MUL |  |  |
| doctors | name | varchar(200) | NO |  |  |  |
| doctors | qualifications | varchar(300) | NO |  |  |  |
| doctors | experienceYears | int | NO | MUL |  |  |
| doctors | consultationFee | decimal(10,2) | NO | MUL |  |  |
| doctors | startMinute | int | NO |  |  |  |
| doctors | endMinute | int | NO |  |  |  |
| doctors | slotDurationMinutes | int | NO |  |  |  |
| doctors | status | enum('active','inactive') | NO |  | active |  |
| doctors | avatar | varchar(1000) | YES |  |  |  |
| doctors | bio | text | YES |  |  |  |
| doctors | roomNumber | varchar(30) | YES |  |  |  |
| doctors | department | varchar(100) | YES |  |  |  |
| doctors | registrationId | varchar(100) | YES |  |  |  |
| doctors | metadata | json | YES |  |  |  |
| languages | id | int | NO | PRI |  | auto_increment |
| languages | name | varchar(60) | NO | UNI |  |  |
| prediction_models | doctorId | varchar(100) | NO | PRI |  |  |
| prediction_models | clinicId | varchar(100) | NO |  |  |  |
| prediction_models | model | json | NO |  |  |  |
| prediction_models | updatedAt | datetime(3) | NO |  | CURRENT_TIMESTAMP(3) | DEFAULT_GENERATED |
| queue_counters | doctorId | varchar(100) | NO | PRI |  |  |
| queue_counters | queueDate | date | NO | PRI |  |  |
| queue_counters | currentNumber | int | NO |  | 0 |  |
| queue_state | doctorId | varchar(100) | NO | PRI |  |  |
| queue_state | isPaused | tinyint(1) | NO |  | 0 |  |
| queue_tokens | id | varchar(100) | NO | PRI |  |  |
| queue_tokens | appointmentId | varchar(100) | YES | UNI |  |  |
| queue_tokens | patientId | varchar(100) | NO | MUL |  |  |
| queue_tokens | doctorId | varchar(100) | NO | MUL |  |  |
| queue_tokens | queueDate | date | NO |  |  |  |
| queue_tokens | tokenSeq | int | NO |  |  |  |
| queue_tokens | tokenNumber | varchar(100) | NO |  |  |  |
| queue_tokens | scheduledMinute | int | YES |  |  |  |
| queue_tokens | priority | enum('normal','emergency') | NO |  | normal |  |
| queue_tokens | isWalkIn | tinyint(1) | NO |  | 0 |  |
| queue_tokens | status | enum('waiting','current','completed','skipped','cancelled') | NO |  |  |  |
| queue_tokens | createdAt | datetime(3) | NO |  |  |  |
| queue_tokens | calledAt | datetime(3) | YES |  |  |  |
| queue_tokens | servedAt | datetime(3) | YES |  |  |  |
| queue_tokens | version | int | NO |  | 1 |  |
| queue_tokens | updatedAt | datetime(3) | NO |  |  |  |
| queue_tokens | metadata | json | YES |  |  |  |
| queue_tokens | activePatientId | varchar(100) | YES | MUL |  | STORED GENERATED |
| queue_tokens | servingDoctorId | varchar(100) | YES | MUL |  | STORED GENERATED |
| schema_migrations | version | varchar(30) | NO | PRI |  |  |
| schema_migrations | appliedAt | datetime(3) | NO |  | CURRENT_TIMESTAMP(3) | DEFAULT_GENERATED |
| specialties | id | int | NO | PRI |  | auto_increment |
| specialties | name | varchar(100) | NO | UNI |  |  |
| users | id | varchar(100) | NO | PRI |  |  |
| users | name | varchar(200) | NO |  |  |  |
| users | phone | varchar(20) | YES | UNI |  |  |
| users | email | varchar(254) | YES | UNI |  |  |
| users | role | enum('patient','doctor','health_worker','admin') | NO |  |  |  |
| users | dob | date | YES |  |  |  |
| users | gender | enum('Male','Female','Other') | YES |  |  |  |
| users | staffId | varchar(100) | YES | UNI |  |  |
| users | doctorId | varchar(100) | YES | MUL |  |  |
| users | clinicId | varchar(100) | YES | MUL |  |  |
| users | passwordHash | varchar(255) | YES |  |  |  |
| users | cognitoSub | varchar(200) | YES | UNI |  |  |
| users | sessionVersion | int | NO |  | 0 |  |
| users | version | int | NO |  | 1 |  |
| users | metadata | json | YES |  |  |  |
| users | createdAt | datetime(3) | NO |  |  |  |
| users | updatedAt | datetime(3) | NO |  |  |  |
| visit_details | id | varchar(100) | NO |  |  |  |
| visit_details | appointmentId | varchar(100) | YES |  |  |  |
| visit_details | patientId | varchar(100) | NO |  |  |  |
| visit_details | doctorId | varchar(100) | NO |  |  |  |
| visit_details | queueDate | date | NO |  |  |  |
| visit_details | tokenSeq | int | NO |  |  |  |
| visit_details | tokenNumber | varchar(100) | NO |  |  |  |
| visit_details | scheduledMinute | int | YES |  |  |  |
| visit_details | priority | enum('normal','emergency') | NO |  | normal |  |
| visit_details | isWalkIn | tinyint(1) | NO |  | 0 |  |
| visit_details | status | enum('waiting','current','completed','skipped','cancelled') | NO |  |  |  |
| visit_details | createdAt | datetime(3) | NO |  |  |  |
| visit_details | calledAt | datetime(3) | YES |  |  |  |
| visit_details | servedAt | datetime(3) | YES |  |  |  |
| visit_details | version | int | NO |  | 1 |  |
| visit_details | updatedAt | datetime(3) | NO |  |  |  |
| visit_details | metadata | json | YES |  |  |  |
| visit_details | activePatientId | varchar(100) | YES |  |  |  |
| visit_details | servingDoctorId | varchar(100) | YES |  |  |  |
| visit_details | patientName | varchar(200) | NO |  |  |  |
| visit_details | patientPhone | varchar(20) | YES |  |  |  |
| visit_details | doctorName | varchar(200) | NO |  |  |  |
| visit_details | clinicId | varchar(100) | NO |  |  |  |
| visit_details | clinicName | varchar(200) | NO |  |  |  |
