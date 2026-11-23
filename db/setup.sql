-- ============================================================
-- SmartResolve AI - Database Setup
-- Run this once to initialize the full schema.
-- Safe to run again (uses IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

CREATE DATABASE IF NOT EXISTS smartresolve_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smartresolve_db;

-- ============================================================
-- TABLE: users
-- Stores citizen and admin accounts for JWT authentication.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) DEFAULT '',
    phone           VARCHAR(15)  DEFAULT NULL,
    address         TEXT         DEFAULT NULL,
    city            VARCHAR(100) DEFAULT NULL,
    state           VARCHAR(100) DEFAULT NULL,
    pincode         VARCHAR(10)  DEFAULT NULL,
    is_active       BOOLEAN      DEFAULT TRUE,
    is_admin        BOOLEAN      DEFAULT FALSE,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_username (username),
    INDEX idx_email    (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: prediction_history
-- Stores every grievance prediction with optional review flow.
-- ============================================================

CREATE TABLE IF NOT EXISTS prediction_history (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number       VARCHAR(20)  UNIQUE NULL,
    user_id             INT          NULL,       -- linked citizen (nullable for anonymous)
    grievance_text      TEXT         NOT NULL,
    predicted_category  VARCHAR(100) NOT NULL,
    confidence          FLOAT        NOT NULL,
    needs_human_review  BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Human review columns
    reviewed_by         INT          NULL,
    review_status       ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    review_notes        TEXT         NULL,
    reviewed_at         TIMESTAMP    NULL,

    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ph_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_ph_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_user_id      (user_id),
    INDEX idx_needs_review (needs_human_review),
    INDEX idx_created_at   (created_at),
    INDEX idx_category     (predicted_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- MIGRATION: add missing columns to an existing table
-- Run only if you already have an older prediction_history
-- (safe to run; ALTER IGNORE silently skips existing columns).
-- ============================================================

-- Add user_id if it does not exist
SET @col_exists = (
    SELECT COUNT(*)
    FROM   information_schema.COLUMNS
    WHERE  TABLE_SCHEMA = DATABASE()
    AND    TABLE_NAME   = 'prediction_history'
    AND    COLUMN_NAME  = 'user_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE prediction_history ADD COLUMN user_id INT NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*)
    FROM   information_schema.COLUMNS
    WHERE  TABLE_SCHEMA = DATABASE()
    AND    TABLE_NAME   = 'prediction_history'
    AND    COLUMN_NAME  = 'review_status'
);

SET @sql = IF(@col_exists = 0,
    "ALTER TABLE prediction_history
         ADD COLUMN reviewed_by    INT NULL,
         ADD COLUMN review_status  ENUM('pending','approved','rejected') DEFAULT 'pending',
         ADD COLUMN review_notes   TEXT NULL,
         ADD COLUMN reviewed_at    TIMESTAMP NULL",
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- MIGRATION: add address/phone fields to users (v2.1)
-- ============================================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN phone VARCHAR(15) DEFAULT NULL AFTER full_name,
     ADD COLUMN address TEXT DEFAULT NULL,
     ADD COLUMN city VARCHAR(100) DEFAULT NULL,
     ADD COLUMN state VARCHAR(100) DEFAULT NULL,
     ADD COLUMN pincode VARCHAR(10) DEFAULT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- MIGRATION: add ticket_number to prediction_history (v2.1)

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prediction_history' AND COLUMN_NAME = 'ticket_number');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE prediction_history ADD COLUMN ticket_number VARCHAR(20) UNIQUE NULL AFTER id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
