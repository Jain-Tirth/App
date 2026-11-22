-- Up Migration

-- One definition of "awaiting admin review", shared by the review queue
-- (PostgresReviewRepository.listAwaitingReview) and the dashboard stat.
CREATE OR REPLACE VIEW "v_profiles_awaiting_review" AS
SELECT u."id" AS "userId", u."profileSubmittedAt" AS "submittedAt"
FROM "Users" u
WHERE u."profileReviewStatus" = 'submitted'
  AND u."profileSubmittedAt" IS NOT NULL
  AND u."accountStatus" = 'pending'
  AND u."role" = 'user';

CREATE OR REPLACE FUNCTION fn_admin_get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    v_total_profiles BIGINT;
    v_pending_profiles BIGINT;
    v_active_users BIGINT;
    v_rejected_users BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_total_profiles FROM "Profiles";
    SELECT COUNT(*) INTO v_pending_profiles FROM "v_profiles_awaiting_review";
    SELECT COUNT(*) INTO v_active_users FROM "Users" WHERE "accountStatus" = 'active' AND "role" = 'user';
    SELECT COUNT(*) INTO v_rejected_users FROM "Users" WHERE "accountStatus" = 'rejected' AND "role" = 'user';

    RETURN jsonb_build_object(
        'totalProfiles', v_total_profiles,
        'pendingApprovals', v_pending_profiles,
        'activeUsers', v_active_users,
        'rejectedUsers', v_rejected_users
    );
END;
$$ LANGUAGE plpgsql;

-- Down Migration

CREATE OR REPLACE FUNCTION fn_admin_get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    v_total_profiles BIGINT;
    v_pending_profiles BIGINT;
    v_active_users BIGINT;
    v_rejected_users BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_total_profiles FROM "Profiles";
    SELECT COUNT(*) INTO v_pending_profiles FROM "Users" WHERE "accountStatus" = 'pending' AND "role" = 'user';
    SELECT COUNT(*) INTO v_active_users FROM "Users" WHERE "accountStatus" = 'active' AND "role" = 'user';
    SELECT COUNT(*) INTO v_rejected_users FROM "Users" WHERE "accountStatus" = 'rejected' AND "role" = 'user';

    RETURN jsonb_build_object(
        'totalProfiles', v_total_profiles,
        'pendingApprovals', v_pending_profiles,
        'activeUsers', v_active_users,
        'rejectedUsers', v_rejected_users
    );
END;
$$ LANGUAGE plpgsql;

DROP VIEW IF EXISTS "v_profiles_awaiting_review";
