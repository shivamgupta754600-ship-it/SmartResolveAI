-- Apply to the same database as setup.sql.
CREATE TABLE IF NOT EXISTS service_wards (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS service_departments (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    response_hours SMALLINT UNSIGNED NOT NULL DEFAULT 72
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS case_staff (
    user_id INT NOT NULL,
    ward VARCHAR(32) NOT NULL,
    department VARCHAR(32) NOT NULL,
    role ENUM('intake','officer','supervisor') NOT NULL,
    PRIMARY KEY (user_id, ward, department, role),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ward) REFERENCES service_wards(code),
    FOREIGN KEY (department) REFERENCES service_departments(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_mfa_steps (
    user_id INT PRIMARY KEY,
    last_step BIGINT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS service_cases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ticket CHAR(24) NOT NULL UNIQUE,
    receipt_hash BINARY(32) NOT NULL UNIQUE,
    ward VARCHAR(32) NOT NULL,
    department VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(300) NOT NULL,
    language ENUM('en','hi') NOT NULL,
    channel ENUM('web','phone','desk') NOT NULL,
    contact_phone VARCHAR(16) NULL,
    status ENUM('received','assigned','in_progress','needs_information','resolved','reopen_requested') NOT NULL DEFAULT 'received',
    officer_id INT NULL,
    assigned_at DATETIME NULL,
    next_update_at DATETIME NOT NULL,
    resolved_at DATETIME NULL,
    escalated_at DATETIME NULL,
    suggested_category VARCHAR(100) NULL,
    suggestion_confidence FLOAT NULL,
    suggestion_model VARCHAR(100) NULL,
    suggestion_state ENUM('pending','ready','unavailable') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ward) REFERENCES service_wards(code),
    FOREIGN KEY (department) REFERENCES service_departments(code),
    FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX (ward, department, status, next_update_at),
    INDEX (suggestion_state, id),
    INDEX (status, escalated_at, next_update_at),
    INDEX (resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS case_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    case_id BIGINT NOT NULL,
    actor_id INT NULL,
    kind VARCHAR(32) NOT NULL,
    note TEXT NULL,
    public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX (case_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS case_sms (
    event_id BIGINT PRIMARY KEY,
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    try_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME NULL,
    FOREIGN KEY (event_id) REFERENCES case_events(id) ON DELETE CASCADE,
    INDEX (sent_at, try_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS incident_members (
    case_id BIGINT PRIMARY KEY,
    incident CHAR(32) NOT NULL,
    FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
    INDEX (incident)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS case_message_times (
    event_id BIGINT PRIMARY KEY,
    seconds_spent INT UNSIGNED NOT NULL,
    FOREIGN KEY (event_id) REFERENCES case_events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS responsibility_rules (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 ward VARCHAR(32) NOT NULL, department VARCHAR(32) NOT NULL,
 locality VARCHAR(120) NOT NULL, office VARCHAR(160) NOT NULL,
 designation VARCHAR(160) NOT NULL, escalation VARCHAR(160) NOT NULL,
 target_hours INT NOT NULL, scheme VARCHAR(160), authority VARCHAR(160),
 reviewer INT, appeal_days INT, verified_by INT NOT NULL,
 verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (ward) REFERENCES service_wards(code),
 FOREIGN KEY (department) REFERENCES service_departments(code),
 FOREIGN KEY (reviewer) REFERENCES users(id),
 FOREIGN KEY (verified_by) REFERENCES users(id),
 INDEX (ward,department,locality,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS case_targets (
 case_id BIGINT PRIMARY KEY, rule_id BIGINT NOT NULL, due_at DATETIME NOT NULL,
 revised_at DATETIME, delay_reason TEXT,
 FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
 FOREIGN KEY (rule_id) REFERENCES responsibility_rules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS authority_referrals (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, case_id BIGINT NOT NULL,
 office VARCHAR(160) NOT NULL, inward_number VARCHAR(160), follow_up VARCHAR(160) NOT NULL,
 referred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, acknowledged_at DATETIME,
 FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS service_appeals (
 case_id BIGINT PRIMARY KEY, reason TEXT NOT NULL, filed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 decision TEXT, decided_at DATETIME, decided_by INT,
 FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
 FOREIGN KEY (decided_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS action_reports (
 case_id BIGINT PRIMARY KEY, report TEXT NOT NULL, designation VARCHAR(160) NOT NULL,
 reviewed_by INT NOT NULL, reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
 FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS case_photos (
    case_id BIGINT PRIMARY KEY,
    jpeg MEDIUMBLOB NOT NULL,
    FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resident_identity (
    user_id INT PRIMARY KEY,
    document_type ENUM('aadhaar','voter','passport','driving_licence','other') NOT NULL,
    document_suffix CHAR(4) NOT NULL,
    assistance_hash BINARY(32) UNIQUE,
    assistance_expires DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS case_residents (
    case_id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX (user_id,case_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS phone_challenges (
    phone CHAR(10) PRIMARY KEY,
    challenge CHAR(32) NOT NULL UNIQUE,
    subject_id INT NULL,
    code_hash BINARY(32),
    proof_hash BINARY(32) UNIQUE,
    expires_at DATETIME NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL,
    last_sent DATETIME NOT NULL,
    window_start DATETIME NOT NULL,
    sent_count TINYINT UNSIGNED NOT NULL,
    INDEX (last_sent)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS verified_phones (
    user_id INT PRIMARY KEY,
    phone CHAR(10) NOT NULL,
    verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_sessions (
    id CHAR(32) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS case_worker_health (
    worker VARCHAR(32) PRIMARY KEY,
    completed_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_recovery_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    reference_number VARCHAR(80) NOT NULL,
    operation ENUM('resident_password','revoke_sessions') NOT NULL,
    performed_by VARCHAR(288) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS india_intake_routes (
    state_name VARCHAR(80) NOT NULL,
    department VARCHAR(32) NOT NULL,
    ward VARCHAR(32) NOT NULL,
    PRIMARY KEY (state_name, department),
    FOREIGN KEY (department) REFERENCES service_departments(code),
    FOREIGN KEY (ward) REFERENCES service_wards(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS case_geography (
    case_id BIGINT PRIMARY KEY,
    details JSON NOT NULL,
    FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;
