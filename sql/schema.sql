-- PharmaTrace AI — PostgreSQL Schema
-- Run: psql -U postgres -d pharmatrace -f sql/schema.sql

-- Drop existing tables (for clean reinstall)
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS supply_chain CASCADE;
DROP TABLE IF EXISTS medicine_tests CASCADE;
DROP TABLE IF EXISTS packaging_info CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================
-- USERS
-- =====================
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100) UNIQUE NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(50) NOT NULL CHECK (role IN ('admin','manufacturer','inspector','distributor','pharmacy','hospital','consumer')),
  organization  VARCHAR(200),
  phone         VARCHAR(20),
  address       TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- =====================
-- MEDICINES
-- =====================
CREATE TABLE medicines (
  id                    SERIAL PRIMARY KEY,
  batch_id              VARCHAR(100) UNIQUE NOT NULL,
  medicine_name         VARCHAR(200) NOT NULL,
  manufacturer_name     VARCHAR(200) NOT NULL,
  manufacturer_id       INTEGER REFERENCES users(id),
  manufacturing_date    DATE NOT NULL,
  expiry_date           DATE NOT NULL,
  quantity              INTEGER NOT NULL,
  package_type          VARCHAR(100),
  storage_condition     VARCHAR(200),
  temperature_requirement VARCHAR(100),
  qr_code_path          TEXT,
  status                VARCHAR(50) DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected')),
  description           TEXT,
  dosage_form           VARCHAR(100),
  active_ingredient     VARCHAR(200),
  created_at            TIMESTAMP DEFAULT NOW()
);

-- =====================
-- PACKAGING INFO
-- =====================
CREATE TABLE packaging_info (
  id                    SERIAL PRIMARY KEY,
  batch_id              VARCHAR(100) REFERENCES medicines(batch_id) ON DELETE CASCADE,
  package_type          VARCHAR(100),
  storage_condition     VARCHAR(200),
  temperature_requirement VARCHAR(100),
  units_per_pack        INTEGER,
  barcode               VARCHAR(100),
  created_at            TIMESTAMP DEFAULT NOW()
);

-- =====================
-- MEDICINE TESTS
-- =====================
CREATE TABLE medicine_tests (
  id                  SERIAL PRIMARY KEY,
  batch_id            VARCHAR(100) REFERENCES medicines(batch_id) ON DELETE CASCADE,
  inspector_id        INTEGER REFERENCES users(id),
  purity_percentage   DECIMAL(6,2),
  ph_level            DECIMAL(5,2),
  sterility_status    BOOLEAN DEFAULT FALSE,
  contamination_flag  BOOLEAN DEFAULT FALSE,
  dissolution_rate    DECIMAL(6,2),
  moisture_content    DECIMAL(6,2),
  test_result         VARCHAR(50) CHECK (test_result IN ('SAFE','DEFECTIVE','PENDING'))
                      DEFAULT 'PENDING',
  ai_risk_level       VARCHAR(20),
  notes               TEXT,
  lab_name            VARCHAR(200),
  tested_at           TIMESTAMP DEFAULT NOW()
);

-- =====================
-- SUPPLY CHAIN
-- =====================
CREATE TABLE supply_chain (
  id              SERIAL PRIMARY KEY,
  batch_id        VARCHAR(100) REFERENCES medicines(batch_id) ON DELETE CASCADE,
  sender_id       INTEGER REFERENCES users(id),
  receiver_id     INTEGER REFERENCES users(id),
  sender_role     VARCHAR(50),
  receiver_role   VARCHAR(50),
  quantity        INTEGER DEFAULT 0,
  location        VARCHAR(200),
  notes           TEXT,
  transfer_date   TIMESTAMP DEFAULT NOW(),
  confirmed       BOOLEAN DEFAULT FALSE,
  confirmed_at    TIMESTAMP
);

-- =====================
-- ALERTS
-- =====================
CREATE TABLE alerts (
  id          SERIAL PRIMARY KEY,
  batch_id    VARCHAR(100),
  alert_type  VARCHAR(100) NOT NULL,
  severity    VARCHAR(20) CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  message     TEXT NOT NULL,
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- =====================
-- INVENTORY
-- =====================
CREATE TABLE inventory (
  id          SERIAL PRIMARY KEY,
  batch_id    VARCHAR(100) REFERENCES medicines(batch_id) ON DELETE CASCADE,
  owner_id    INTEGER REFERENCES users(id),
  owner_role  VARCHAR(50),
  quantity    INTEGER DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_medicines_batch    ON medicines(batch_id);
CREATE INDEX idx_medicines_status   ON medicines(status);
CREATE INDEX idx_tests_batch        ON medicine_tests(batch_id);
CREATE INDEX idx_supply_batch       ON supply_chain(batch_id);
CREATE INDEX idx_alerts_batch       ON alerts(batch_id);
CREATE INDEX idx_alerts_resolved    ON alerts(resolved);
CREATE INDEX idx_inventory_owner    ON inventory(owner_id);

-- =====================
-- SEED ADMIN USER (password: admin123)
-- =====================
INSERT INTO users (username, email, password_hash, role, organization)
VALUES (
  'admin',
  'admin@pharmatrace.com',
  '$2b$10$rQZ3mK1vF2bV8qX9nL5YOeWkGpH7jM4cN6uA0sE1dI2yB3tR8wP5K',
  'admin',
  'PharmaTrace HQ'
);
-- NOTE: The seed password hash above is a placeholder.
-- Register a real admin through the UI at /register and then run:
-- UPDATE users SET role='admin' WHERE email='your@email.com';
