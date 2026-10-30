-- ==============================================================================
-- NOPROXY DATABASE SCHEMA MIGRATION 002
-- Row Level Security (RLS) & Multi-Tenant Isolation
-- ==============================================================================

-- Helper function: get current authenticated user id
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID AS $$
    SELECT auth.uid();
$$ LANGUAGE SQL STABLE;

-- Helper function: check if user is a Platform Super Admin
CREATE OR REPLACE FUNCTION is_platform_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM institution_memberships
        WHERE user_id = user_uuid AND role = 'SUPER_ADMIN' AND status = 'ACTIVE'
    );
$$ LANGUAGE SQL STABLE;

-- Helper function: check if user has a specific role in an institution
CREATE OR REPLACE FUNCTION has_institution_role(inst_id UUID, user_uuid UUID, required_roles TEXT[])
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM institution_memberships
        WHERE institution_id = inst_id 
          AND user_id = user_uuid 
          AND role = ANY(required_roles)
          AND status = 'ACTIVE'
    );
$$ LANGUAGE SQL STABLE;

-- Helper function: check if student is enrolled in batch
CREATE OR REPLACE FUNCTION is_student_in_batch(b_id UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM student_enrollments
        WHERE batch_id = b_id AND student_id = user_uuid AND status = 'ACTIVE'
    );
$$ LANGUAGE SQL STABLE;

-- Enable RLS on all tables
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. INSTITUTIONS POLICIES
CREATE POLICY institutions_superadmin_all ON institutions
    FOR ALL USING (is_platform_super_admin(auth.uid()));

CREATE POLICY institutions_member_select ON institutions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM institution_memberships
            WHERE institution_id = institutions.id AND user_id = auth.uid() AND status = 'ACTIVE'
        )
    );

-- 2. PROFILES POLICIES
CREATE POLICY profiles_self ON profiles
    FOR ALL USING (id = auth.uid());

CREATE POLICY profiles_tenant_read ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM institution_memberships m1
            JOIN institution_memberships m2 ON m1.institution_id = m2.institution_id
            WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
        )
    );

-- 3. INSTITUTION MEMBERSHIPS POLICIES
CREATE POLICY memberships_admin_all ON institution_memberships
    FOR ALL USING (
        is_platform_super_admin(auth.uid()) OR
        has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN'])
    );

CREATE POLICY memberships_self_read ON institution_memberships
    FOR SELECT USING (user_id = auth.uid());

-- 4. ACADEMIC ENTITIES (Courses, Subjects, Batches, Classrooms)
CREATE POLICY academic_admin_manage ON courses
    FOR ALL USING (has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN']));

CREATE POLICY academic_member_read ON courses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM institution_memberships
            WHERE institution_id = courses.institution_id AND user_id = auth.uid()
        )
    );

CREATE POLICY subjects_admin_manage ON subjects
    FOR ALL USING (has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN']));

CREATE POLICY subjects_member_read ON subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM institution_memberships
            WHERE institution_id = subjects.institution_id AND user_id = auth.uid()
        )
    );

CREATE POLICY batches_admin_manage ON batches
    FOR ALL USING (has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN']));

CREATE POLICY batches_member_read ON batches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM institution_memberships
            WHERE institution_id = batches.institution_id AND user_id = auth.uid()
        )
    );

CREATE POLICY classrooms_admin_manage ON classrooms
    FOR ALL USING (has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN']));

CREATE POLICY classrooms_trainer_read ON classrooms
    FOR SELECT USING (
        has_institution_role(institution_id, auth.uid(), ARRAY['TRAINER', 'INSTITUTION_ADMIN'])
    );

-- 5. SESSIONS POLICIES
CREATE POLICY sessions_admin_all ON sessions
    FOR ALL USING (has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN']));

CREATE POLICY sessions_trainer_manage ON sessions
    FOR ALL USING (
        has_institution_role(institution_id, auth.uid(), ARRAY['TRAINER']) AND
        (created_by = auth.uid() OR EXISTS (
            SELECT 1 FROM session_trainers WHERE session_id = sessions.id AND trainer_id = auth.uid()
        ))
    );

CREATE POLICY sessions_student_read ON sessions
    FOR SELECT USING (
        is_student_in_batch(batch_id, auth.uid())
    );

-- 6. ATTENDANCE POLICIES
CREATE POLICY attendance_admin_all ON attendance
    FOR ALL USING (has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN']));

CREATE POLICY attendance_trainer_manage ON attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions s
            LEFT JOIN session_trainers st ON st.session_id = s.id
            WHERE s.id = attendance.session_id 
              AND (s.created_by = auth.uid() OR st.trainer_id = auth.uid())
        )
    );

CREATE POLICY attendance_student_read ON attendance
    FOR SELECT USING (student_id = auth.uid());

-- 7. DEVICE REGISTRATIONS POLICIES
CREATE POLICY device_regs_student ON device_registrations
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY device_regs_admin_read ON device_registrations
    FOR SELECT USING (has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN']));

-- 8. AUDIT LOGS POLICIES
CREATE POLICY audit_logs_admin_read ON audit_logs
    FOR SELECT USING (
        is_platform_super_admin(auth.uid()) OR
        has_institution_role(institution_id, auth.uid(), ARRAY['INSTITUTION_ADMIN'])
    );
