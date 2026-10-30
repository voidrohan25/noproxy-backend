-- ==============================================================================
-- NOPROXY MIGRATION 004: MULTI-BATCH STUDENT ENROLLMENT & ADMIN-ONLY LOCATION SECURITY
-- ==============================================================================

-- 1. Ensure student_enrollments supports flexible multi-batch memberships
CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    roll_number VARCHAR(50),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DROPPED', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_institution_student_batch UNIQUE (institution_id, student_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_batch ON student_enrollments(batch_id);

-- 2. Relax single batch constraint on student_profiles to enable multi-batch enrollment
ALTER TABLE student_profiles ALTER COLUMN batch_id DROP NOT NULL;

-- 3. RLS Policies for multi-batch access
-- Students can select batches and sessions they are actively enrolled in
DROP POLICY IF EXISTS "Students can view enrolled batches" ON batches;
CREATE POLICY "Students can view enrolled batches"
    ON batches FOR SELECT
    USING (
        id IN (
            SELECT batch_id FROM student_enrollments
            WHERE student_id = auth.uid() AND status = 'ACTIVE'
        )
        OR EXISTS (
            SELECT 1 FROM institution_memberships
            WHERE institution_id = batches.institution_id
            AND user_id = auth.uid()
            AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Students can view sessions for batches they are actively enrolled in
DROP POLICY IF EXISTS "Students can view enrolled batch sessions" ON sessions;
CREATE POLICY "Students can view enrolled batch sessions"
    ON sessions FOR SELECT
    USING (
        batch_id IN (
            SELECT batch_id FROM student_enrollments
            WHERE student_id = auth.uid() AND status = 'ACTIVE'
        )
        OR EXISTS (
            SELECT 1 FROM institution_memberships
            WHERE institution_id = sessions.institution_id
            AND user_id = auth.uid()
            AND role IN ('ADMIN', 'SUPER_ADMIN', 'TRAINER')
        )
    );

-- 4. Admin-Only Classroom Location & Network Settings Security Policy
-- Only Administrators can view raw GPS coordinates and network CIDRs
DROP POLICY IF EXISTS "Admins can manage classrooms" ON classrooms;
CREATE POLICY "Admins can manage classrooms"
    ON classrooms FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM institution_memberships
            WHERE institution_id = classrooms.institution_id
            AND user_id = auth.uid()
            AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Trainers can view classroom names and buildings for session selection, but not coordinates
CREATE OR REPLACE VIEW trainer_classroom_view AS
SELECT 
    id,
    institution_id,
    name,
    building,
    room_number,
    gps_verification_enabled,
    network_verification_enabled,
    status
FROM classrooms;
