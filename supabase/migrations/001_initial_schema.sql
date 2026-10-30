-- ==============================================================================
-- NOPROXY DATABASE SCHEMA MIGRATION 001
-- Multi-Tenant Smart Attendance Management System
-- Strict 3-Status Rule: PRESENT, ONLINE, ABSENT (NO Late/Grace Period)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. INSTITUTIONS (Tenants)
CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    contact_email VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROFILES (Users linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'PENDING', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INSTITUTION MEMBERSHIPS (Role-Based Access within Tenants)
CREATE TABLE IF NOT EXISTS institution_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'TRAINER', 'STUDENT')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVITED', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_institution_user UNIQUE (institution_id, user_id)
);

-- 4. COURSES
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_institution_course_code UNIQUE (institution_id, code)
);

-- 5. SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. BATCHES
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_institution_batch_code UNIQUE (institution_id, code)
);

-- 7. BATCH SUBJECTS
CREATE TABLE IF NOT EXISTS batch_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT uq_batch_subject UNIQUE (batch_id, subject_id)
);

-- 8. TRAINER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS trainer_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_trainer_batch_subject UNIQUE (institution_id, trainer_id, batch_id, subject_id)
);

-- 9. AUTHORITATIVE STUDENT ROSTER (Pre-loaded by Admin / Excel Import)
CREATE TABLE IF NOT EXISTS authoritative_student_roster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    student_id_number VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    CONSTRAINT uq_batch_student_id UNIQUE (batch_id, student_id_number)
);

-- 10. STUDENT PROFILES (Verified Student Identities Linked to Auth Users)
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    student_id_number VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('VERIFIED', 'PENDING', 'REJECTED')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_institution_student_profile UNIQUE (institution_id, student_id_number)
);

-- 11. STUDENT ENROLLMENTS
CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    roll_number VARCHAR(50),
    enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DROPPED', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_batch_student UNIQUE (batch_id, student_id)
);

-- 12. CLASSROOMS
CREATE TABLE IF NOT EXISTS classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    building VARCHAR(255),
    room_number VARCHAR(50),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geofence_radius_meters DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    required_gps_accuracy_meters DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    gps_verification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    gps_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_network_cidrs JSONB DEFAULT '[]'::jsonb, -- e.g. ["203.0.113.0/24"]
    network_verification_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    network_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    mode VARCHAR(50) NOT NULL CHECK (mode IN ('OFFLINE', 'ONLINE')),
    session_status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (session_status IN ('SCHEDULED', 'ACTIVE', 'FINALIZED', 'CANCELLED')),
    external_meeting_platform VARCHAR(100), -- Zoom, Google Meet, Teams, etc.
    external_meeting_url TEXT,
    finalized_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. SESSION TRAINERS
CREATE TABLE IF NOT EXISTS session_trainers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT uq_session_trainer UNIQUE (session_id, trainer_id)
);

-- 13. SESSION ROSTER (Eligible students snapshot for session)
CREATE TABLE IF NOT EXISTS session_roster (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    roster_status VARCHAR(50) NOT NULL DEFAULT 'ELIGIBLE' CHECK (roster_status IN ('ELIGIBLE', 'EXEMPT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_roster_student UNIQUE (session_id, student_id)
);

-- 14. ATTENDANCE (Strictly 3 Statuses: PRESENT, ONLINE, ABSENT)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('PRESENT', 'ONLINE', 'ABSENT')),
    attendance_source VARCHAR(50) NOT NULL CHECK (attendance_source IN ('DYNAMIC_QR', 'TRAINER_ONLINE_ROSTER', 'SYSTEM_FINALIZATION', 'ADMIN_CORRECTION')),
    verification_summary JSONB DEFAULT '{}'::jsonb,
    marked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correction_reason TEXT,
    CONSTRAINT uq_session_student_attendance UNIQUE (session_id, student_id)
);

-- 15. DYNAMIC QR CHALLENGES (Short-lived, Anti-Replay Tokens)
CREATE TABLE IF NOT EXISTS qr_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    challenge_token_hash VARCHAR(128) NOT NULL,
    nonce VARCHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED', 'CONSUMED'))
);

-- 16. DEVICE REGISTRATIONS (One Active Device per Student)
CREATE TABLE IF NOT EXISTS device_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL, -- WebAuthn Credential ID or Device Public Fingerprint
    public_key TEXT,
    device_model VARCHAR(255),
    platform VARCHAR(100), -- Android, iOS, Windows, macOS, etc.
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'PENDING_RESET')),
    reset_audit JSONB DEFAULT '{}'::jsonb
);

-- 17. ATTENDANCE ATTEMPTS & AUDIT
CREATE TABLE IF NOT EXISTS attendance_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    device_reference TEXT,
    verification_outcome VARCHAR(50) NOT NULL CHECK (verification_outcome IN ('SUCCESS', 'REJECTED', 'FLAGGED')),
    failure_reason_codes JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. ATTENDANCE POLICIES
CREATE TABLE IF NOT EXISTS attendance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    session_mode VARCHAR(50) NOT NULL CHECK (session_mode IN ('OFFLINE', 'ONLINE', 'ALL')),
    require_dynamic_qr BOOLEAN NOT NULL DEFAULT TRUE,
    require_gps BOOLEAN NOT NULL DEFAULT TRUE,
    require_network BOOLEAN NOT NULL DEFAULT FALSE,
    require_registered_device BOOLEAN NOT NULL DEFAULT TRUE,
    require_local_auth BOOLEAN NOT NULL DEFAULT TRUE, -- WebAuthn / Platform Biometric
    qr_refresh_seconds INT NOT NULL DEFAULT 20,
    strict_mode BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_institution_policy_mode UNIQUE (institution_id, session_mode)
);

-- 19. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE AND TENANT FILTERING
CREATE INDEX IF NOT EXISTS idx_memberships_inst_user ON institution_memberships(institution_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON institution_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_institution ON batches(institution_id);
CREATE INDEX IF NOT EXISTS idx_subjects_institution ON subjects(institution_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_institution ON classrooms(institution_id);
CREATE INDEX IF NOT EXISTS idx_sessions_batch_date ON sessions(batch_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_institution ON sessions(institution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_institution ON attendance(institution_id);
CREATE INDEX IF NOT EXISTS idx_qr_challenges_session ON qr_challenges(session_id, status);
CREATE INDEX IF NOT EXISTS idx_device_regs_student ON device_registrations(student_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_institution ON audit_logs(institution_id, timestamp);
