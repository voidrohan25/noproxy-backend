-- ==============================================================================
-- NOPROXY DATABASE SCHEMA MIGRATION 003
-- Automated Session Finalization, Strict Status Enforcement, and Audit Triggers
-- ==============================================================================

-- 1. Strictly Enforce Only 3 Attendance Statuses: PRESENT, ONLINE, ABSENT
CREATE OR REPLACE FUNCTION enforce_valid_attendance_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status NOT IN ('PRESENT', 'ONLINE', 'ABSENT') THEN
        RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Attendance status must be strictly one of PRESENT, ONLINE, or ABSENT. Found: %', NEW.status;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_valid_attendance_status ON attendance;
CREATE TRIGGER trg_enforce_valid_attendance_status
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION enforce_valid_attendance_status();

-- 2. Stored Procedure: Finalize Session & Mark Remaining Eligible Students as ABSENT
CREATE OR REPLACE FUNCTION finalize_session(
    p_session_id UUID,
    p_actor_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_absent_count INT := 0;
    v_eligible_count INT := 0;
    r_student RECORD;
BEGIN
    -- Check session existence and status
    SELECT * INTO v_session FROM sessions WHERE id = p_session_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found: %', p_session_id;
    END IF;

    IF v_session.session_status = 'FINALIZED' THEN
        RAISE EXCEPTION 'Session is already finalized and locked.';
    END IF;

    -- Ensure session roster exists; populate from active student_enrollments if empty
    INSERT INTO session_roster (institution_id, session_id, student_id, roster_status)
    SELECT v_session.institution_id, p_session_id, se.student_id, 'ELIGIBLE'
    FROM student_enrollments se
    WHERE se.batch_id = v_session.batch_id 
      AND se.status = 'ACTIVE'
    ON CONFLICT (session_id, student_id) DO NOTHING;

    -- Count eligible students
    SELECT COUNT(*) INTO v_eligible_count 
    FROM session_roster 
    WHERE session_id = p_session_id AND roster_status = 'ELIGIBLE';

    -- Insert ABSENT records for students in roster who have no attendance record yet
    FOR r_student IN 
        SELECT sr.student_id 
        FROM session_roster sr
        WHERE sr.session_id = p_session_id 
          AND sr.roster_status = 'ELIGIBLE'
          AND NOT EXISTS (
              SELECT 1 FROM attendance a 
              WHERE a.session_id = p_session_id AND a.student_id = sr.student_id
          )
    LOOP
        INSERT INTO attendance (
            institution_id,
            session_id,
            student_id,
            status,
            attendance_source,
            verification_summary,
            marked_by,
            marked_at
        ) VALUES (
            v_session.institution_id,
            p_session_id,
            r_student.student_id,
            'ABSENT',
            'SYSTEM_FINALIZATION',
            '{"reason": "No attendance recorded before session finalization"}'::jsonb,
            p_actor_id,
            NOW()
        );
        v_absent_count := v_absent_count + 1;
    END LOOP;

    -- Update session status to FINALIZED
    UPDATE sessions
    SET session_status = 'FINALIZED',
        finalized_by = p_actor_id,
        finalized_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id;

    -- Revoke active QR challenges for this session
    UPDATE qr_challenges
    SET status = 'EXPIRED',
        revoked_at = NOW()
    WHERE session_id = p_session_id AND status = 'ACTIVE';

    -- Record in audit logs
    INSERT INTO audit_logs (
        institution_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        reason,
        metadata
    ) VALUES (
        v_session.institution_id,
        p_actor_id,
        'FINALIZE_SESSION',
        'SESSION',
        p_session_id,
        'Session marked finalized and locked against standard submissions',
        jsonb_build_object(
            'batch_id', v_session.batch_id,
            'session_date', v_session.session_date,
            'eligible_students', v_eligible_count,
            'absent_marked_count', v_absent_count
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'status', 'FINALIZED',
        'eligible_count', v_eligible_count,
        'absent_marked_count', v_absent_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
