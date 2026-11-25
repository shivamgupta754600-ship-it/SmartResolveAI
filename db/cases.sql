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
