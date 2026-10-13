-- QureFlow DBMS variant. MySQL 8.4 / InnoDB; all data is local and synthetic.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(30) PRIMARY KEY, appliedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS clinics (
  id VARCHAR(100) PRIMARY KEY, name VARCHAR(200) NOT NULL, address VARCHAR(500) NOT NULL,
  district VARCHAR(100) NOT NULL, state VARCHAR(100) NOT NULL, phone VARCHAR(20) NOT NULL,
  email VARCHAR(254) NOT NULL, openingHours VARCHAR(100) NOT NULL, emergencyContact VARCHAR(30) NOT NULL,
  metadata JSON, updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS specialties (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS languages (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS doctors (
  id VARCHAR(100) PRIMARY KEY, clinicId VARCHAR(100) NOT NULL, specialtyId INT NOT NULL,
  name VARCHAR(200) NOT NULL, qualifications VARCHAR(300) NOT NULL,
  experienceYears INT NOT NULL CHECK (experienceYears BETWEEN 0 AND 70),
  consultationFee DECIMAL(10,2) NOT NULL CHECK (consultationFee >= 0),
  startMinute INT NOT NULL, endMinute INT NOT NULL, slotDurationMinutes INT NOT NULL CHECK (slotDurationMinutes BETWEEN 2 AND 30),
  status ENUM('active','inactive') NOT NULL DEFAULT 'active', avatar VARCHAR(1000),
  bio TEXT, roomNumber VARCHAR(30), department VARCHAR(100), registrationId VARCHAR(100), metadata JSON,
  FOREIGN KEY (clinicId) REFERENCES clinics(id), FOREIGN KEY (specialtyId) REFERENCES specialties(id),
  CHECK (startMinute >= 0 AND endMinute <= 1440 AND endMinute > startMinute),
  INDEX doctors_directory (specialtyId, clinicId, status), INDEX doctors_fee (consultationFee), INDEX doctors_experience (experienceYears)
);
CREATE TABLE IF NOT EXISTS doctor_days (
  doctorId VARCHAR(100) NOT NULL, dayOfWeek ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  PRIMARY KEY (doctorId, dayOfWeek), FOREIGN KEY (doctorId) REFERENCES doctors(id)
);
CREATE TABLE IF NOT EXISTS doctor_languages (
  doctorId VARCHAR(100) NOT NULL, languageId INT NOT NULL,
  PRIMARY KEY (doctorId, languageId), FOREIGN KEY (doctorId) REFERENCES doctors(id), FOREIGN KEY (languageId) REFERENCES languages(id)
);
CREATE TABLE IF NOT EXISTS doctor_interests (
  doctorId VARCHAR(100) NOT NULL, interest VARCHAR(200) NOT NULL,
  PRIMARY KEY (doctorId, interest), FOREIGN KEY (doctorId) REFERENCES doctors(id)
);
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) PRIMARY KEY, name VARCHAR(200) NOT NULL, phone VARCHAR(20) UNIQUE, email VARCHAR(254) UNIQUE,
  role ENUM('patient','doctor','health_worker','admin') NOT NULL,
  dob DATE, gender ENUM('Male','Female','Other'), staffId VARCHAR(100) UNIQUE, doctorId VARCHAR(100),
  clinicId VARCHAR(100), passwordHash VARCHAR(255), cognitoSub VARCHAR(200) UNIQUE, sessionVersion INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1, metadata JSON, createdAt DATETIME(3) NOT NULL, updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (clinicId) REFERENCES clinics(id), FOREIGN KEY (doctorId) REFERENCES doctors(id)
);
CREATE TABLE IF NOT EXISTS clinic_settings (
  clinicId VARCHAR(100) PRIMARY KEY, averageConsultationMinutes INT NOT NULL CHECK (averageConsultationMinutes BETWEEN 1 AND 120),
  bufferMinutes INT NOT NULL DEFAULT 2 CHECK (bufferMinutes >= 0), allowWalkIns BOOLEAN NOT NULL DEFAULT TRUE,
  allowEmergencyPriority BOOLEAN NOT NULL DEFAULT TRUE, notifyOnTwoAhead BOOLEAN NOT NULL DEFAULT FALSE,
  autoTokenPrefixByDoctor BOOLEAN NOT NULL DEFAULT TRUE, clinicName VARCHAR(200) NOT NULL, contactNumber VARCHAR(30) NOT NULL,
  FOREIGN KEY (clinicId) REFERENCES clinics(id)
);
CREATE TABLE IF NOT EXISTS queue_counters (
  doctorId VARCHAR(100) NOT NULL, queueDate DATE NOT NULL, currentNumber INT NOT NULL DEFAULT 0,
  PRIMARY KEY (doctorId, queueDate), FOREIGN KEY (doctorId) REFERENCES doctors(id)
);
CREATE TABLE IF NOT EXISTS queue_state (
  doctorId VARCHAR(100) PRIMARY KEY, isPaused BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (doctorId) REFERENCES doctors(id)
);
CREATE TABLE IF NOT EXISTS appointment_slots (
  doctorId VARCHAR(100) NOT NULL, slotDate DATE NOT NULL, slotMinute INT NOT NULL,
  bookedCount INT NOT NULL DEFAULT 0, capacity INT NOT NULL,
  PRIMARY KEY (doctorId, slotDate, slotMinute), FOREIGN KEY (doctorId) REFERENCES doctors(id),
  CHECK (bookedCount >= 0 AND bookedCount <= capacity), CHECK (capacity > 0)
);
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(100) PRIMARY KEY, patientId VARCHAR(100) NOT NULL, doctorId VARCHAR(100) NOT NULL,
  date DATE NOT NULL, slotMinute INT NOT NULL, tokenNumber VARCHAR(100) NOT NULL,
  status ENUM('booked','waiting','in_consultation','completed','cancelled','no_show') NOT NULL,
  priority ENUM('normal','emergency') NOT NULL, isWalkIn BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT, version INT NOT NULL DEFAULT 1, metadata JSON, createdAt DATETIME(3) NOT NULL, updatedAt DATETIME(3) NOT NULL,
  FOREIGN KEY (patientId) REFERENCES users(id), FOREIGN KEY (doctorId) REFERENCES doctors(id),
  INDEX appointments_patient (patientId, date), INDEX appointments_doctor (doctorId, date, slotMinute)
);
CREATE TABLE IF NOT EXISTS queue_tokens (
  id VARCHAR(100) PRIMARY KEY, appointmentId VARCHAR(100) UNIQUE,
  patientId VARCHAR(100) NOT NULL, doctorId VARCHAR(100) NOT NULL, queueDate DATE NOT NULL,
  tokenSeq INT NOT NULL, tokenNumber VARCHAR(100) NOT NULL, scheduledMinute INT,
  priority ENUM('normal','emergency') NOT NULL DEFAULT 'normal', isWalkIn BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('waiting','current','completed','skipped','cancelled') NOT NULL,
  createdAt DATETIME(3) NOT NULL, calledAt DATETIME(3), servedAt DATETIME(3),
  version INT NOT NULL DEFAULT 1, updatedAt DATETIME(3) NOT NULL, metadata JSON,
  activePatientId VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN status IN ('waiting','current') THEN patientId ELSE NULL END) STORED,
  servingDoctorId VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN status = 'current' THEN doctorId ELSE NULL END) STORED,
  UNIQUE active_visit (activePatientId, queueDate), UNIQUE one_consultation (servingDoctorId, queueDate),
  UNIQUE token_sequence (doctorId, queueDate, tokenSeq),
  FOREIGN KEY (patientId) REFERENCES users(id), FOREIGN KEY (doctorId) REFERENCES doctors(id),
  FOREIGN KEY (appointmentId) REFERENCES appointments(id),
  CHECK (servedAt IS NULL OR calledAt IS NOT NULL AND servedAt >= calledAt),
  INDEX queue_waiting (doctorId, queueDate, status, priority, tokenSeq)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(100) PRIMARY KEY, clinicId VARCHAR(100), entityType VARCHAR(60) NOT NULL, entityId VARCHAR(100) NOT NULL,
  action VARCHAR(60) NOT NULL, actorId VARCHAR(100) NOT NULL, requestId VARCHAR(100) NOT NULL,
  timestamp DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), details JSON,
  INDEX audit_clinic (clinicId, timestamp)
);
CREATE TABLE IF NOT EXISTS prediction_models (
  doctorId VARCHAR(100) PRIMARY KEY, clinicId VARCHAR(100) NOT NULL, model JSON NOT NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY (doctorId) REFERENCES doctors(id)
);
CREATE TABLE IF NOT EXISTS demo_seed (
  version VARCHAR(30) PRIMARY KEY, seededAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE OR REPLACE VIEW doctor_directory AS
SELECT d.*, c.name AS clinicName, c.district, s.name AS specialization,
  EXISTS(SELECT 1 FROM doctor_days dd WHERE dd.doctorId=d.id AND dd.dayOfWeek=DAYNAME(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+05:30'))) AND d.status='active' AS isAvailableToday,
  (SELECT JSON_ARRAYAGG(dayOfWeek) FROM doctor_days WHERE doctorId=d.id) AS consultationDays,
  (SELECT JSON_ARRAYAGG(l.name) FROM doctor_languages dl JOIN languages l ON l.id=dl.languageId WHERE dl.doctorId=d.id) AS languages,
  (SELECT JSON_ARRAYAGG(interest) FROM doctor_interests WHERE doctorId=d.id) AS clinicalInterests
FROM doctors d JOIN clinics c ON c.id=d.clinicId JOIN specialties s ON s.id=d.specialtyId;
CREATE OR REPLACE VIEW visit_details AS
SELECT t.*, u.name AS patientName, u.phone AS patientPhone, d.name AS doctorName,
  d.clinicId, c.name AS clinicName
FROM queue_tokens t JOIN users u ON u.id=t.patientId JOIN doctors d ON d.id=t.doctorId JOIN clinics c ON c.id=d.clinicId;
CREATE OR REPLACE VIEW appointment_details AS
SELECT a.*, u.name AS patientName, u.phone AS patientPhone, d.name AS doctorName, s.name AS doctorSpecialization,
  d.clinicId, c.name AS clinicName, t.id AS tokenId
FROM appointments a JOIN users u ON u.id=a.patientId JOIN doctors d ON d.id=a.doctorId
JOIN clinics c ON c.id=d.clinicId JOIN specialties s ON s.id=d.specialtyId
LEFT JOIN queue_tokens t ON t.appointmentId=a.id;
CREATE OR REPLACE VIEW daily_patient_flow AS
SELECT d.clinicId, t.queueDate AS date, COUNT(*) AS total,
 SUM(t.status='completed') AS completed, SUM(t.status='cancelled') AS cancelled, SUM(t.status='skipped') AS noShow
FROM queue_tokens t JOIN doctors d ON d.id=t.doctorId GROUP BY d.clinicId,t.queueDate;
