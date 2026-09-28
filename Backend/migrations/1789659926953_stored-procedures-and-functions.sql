-- Up Migration

-- ============================================================
-- STORED PROCEDURES & FUNCTIONS (PL/pgSQL)
-- Encapsulates all database operations, eliminating inline SQL
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. AUTH & SESSIONS
-- ─────────────────────────────────────────────

-- Register or update unverified user
CREATE OR REPLACE FUNCTION fn_register_user(
    p_name VARCHAR(100),
    p_email VARCHAR(150),
    p_password_hash TEXT,
    p_mobile VARCHAR(15),
    p_profile_created_by "ProfileCreatedBy",
    p_gender "Gender"
)
RETURNS TABLE (
    "id" UUID,
    "name" VARCHAR(100),
    "email" VARCHAR(150),
    "mobile" VARCHAR(15),
    "role" "Role",
    "accountStatus" "AccountStatus",
    "mobileVerified" BOOLEAN
) AS $$
#variable_conflict use_column
DECLARE
    v_user_id UUID;
BEGIN
    -- Check if verified user already exists with this email or mobile
    IF EXISTS (
        SELECT 1 FROM "Users" u
        WHERE (u."email" = p_email OR u."mobile" = p_mobile) 
          AND u."mobileVerified" = true
    ) THEN
        RAISE EXCEPTION 'USER_EXISTS';
    END IF;

    -- Upsert unverified user or insert new user
    SELECT u."id" INTO v_user_id
    FROM "Users" u
    WHERE (u."email" = p_email OR u."mobile" = p_mobile)
      AND u."mobileVerified" = false
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        UPDATE "Users" u
        SET "name" = p_name,
            "email" = p_email,
            "passwordHash" = p_password_hash,
            "mobile" = p_mobile,
            "profileCreatedBy" = p_profile_created_by,
            "gender" = COALESCE(p_gender, u."gender"),
            "accountStatus" = 'pending',
            "rejectionReason" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE u."id" = v_user_id;
    ELSE
        INSERT INTO "Users" (
            "name", "email", "passwordHash", "mobile", 
            "profileCreatedBy", "gender", "accountStatus", "mobileVerified"
        ) VALUES (
            p_name, p_email, p_password_hash, p_mobile, 
            p_profile_created_by, p_gender, 'pending', false
        )
        RETURNING "Users"."id" INTO v_user_id;
    END IF;

    RETURN QUERY
    SELECT u."id", u."name", u."email", u."mobile", u."role", u."accountStatus", u."mobileVerified"
    FROM "Users" u
    WHERE u."id" = v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Get user by email or mobile (for login)
CREATE OR REPLACE FUNCTION fn_get_user_by_identifier(
    p_identifier TEXT
)
RETURNS TABLE (
    "id" UUID,
    "name" VARCHAR(100),
    "email" VARCHAR(150),
    "passwordHash" TEXT,
    "mobile" VARCHAR(15),
    "mobileVerified" BOOLEAN,
    "emailVerified" BOOLEAN,
    "role" "Role",
    "membershipType" "MembershipType",
    "accountStatus" "AccountStatus",
    "rejectionReason" TEXT,
    "profileCreatedBy" "ProfileCreatedBy",
    "gender" "Gender"
) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT 
        u."id", u."name", u."email", u."passwordHash", u."mobile",
        u."mobileVerified", u."emailVerified", u."role", u."membershipType",
        u."accountStatus", u."rejectionReason", u."profileCreatedBy", u."gender"
    FROM "Users" u
    WHERE u."email" = LOWER(TRIM(p_identifier))
       OR u."mobile" = TRIM(p_identifier)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Mark user mobile as verified
CREATE OR REPLACE FUNCTION fn_verify_user_mobile(
    p_user_id UUID
)
RETURNS TABLE (
    "id" UUID,
    "name" VARCHAR(100),
    "email" VARCHAR(150),
    "mobile" VARCHAR(15),
    "role" "Role",
    "accountStatus" "AccountStatus",
    "mobileVerified" BOOLEAN
) AS $$
#variable_conflict use_column
BEGIN
    UPDATE "Users" u
    SET "mobileVerified" = true,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE u."id" = p_user_id;

    RETURN QUERY
    SELECT u."id", u."name", u."email", u."mobile", u."role", u."accountStatus", u."mobileVerified"
    FROM "Users" u
    WHERE u."id" = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Save user refresh token session
CREATE OR REPLACE FUNCTION fn_save_user_session(
    p_user_id UUID,
    p_refresh_token_hash TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO "UserSessions" ("userId", "refreshTokenHash", "refreshTokenExpiresAt", "updatedAt")
    VALUES (p_user_id, p_refresh_token_hash, p_expires_at, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE
    SET "refreshTokenHash" = EXCLUDED."refreshTokenHash",
        "refreshTokenExpiresAt" = EXCLUDED."refreshTokenExpiresAt",
        "updatedAt" = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Get user refresh token session
CREATE OR REPLACE FUNCTION fn_get_user_session(
    p_user_id UUID
)
RETURNS TABLE (
    "userId" UUID,
    "refreshTokenHash" TEXT,
    "refreshTokenExpiresAt" TIMESTAMPTZ
) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT s."userId", s."refreshTokenHash", s."refreshTokenExpiresAt"
    FROM "UserSessions" s
    WHERE s."userId" = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Clear user session (logout)
CREATE OR REPLACE FUNCTION fn_clear_user_session(
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM "UserSessions" WHERE "userId" = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- 2. PROFILES & 5-STEP WIZARD
-- ─────────────────────────────────────────────

-- Helper: Ensure base profile exists and get profile id
CREATE OR REPLACE FUNCTION fn_ensure_profile_exists(
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_profile_id UUID;
    v_random_uid VARCHAR(15);
BEGIN
    SELECT "id" INTO v_profile_id FROM "Profiles" WHERE "userId" = p_user_id;

    IF v_profile_id IS NULL THEN
        v_random_uid := 'DHB' || LPAD(FLOOR(RANDOM() * 10000000)::TEXT, 7, '0');
        
        INSERT INTO "Profiles" ("userId", "profileUid", "profileCompletePct")
        VALUES (p_user_id, v_random_uid, 0)
        RETURNING "id" INTO v_profile_id;
    END IF;

    RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql;

-- Helper: Recalculate profile completion percentage
CREATE OR REPLACE FUNCTION fn_recalculate_profile_completion(
    p_profile_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_pct INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM "ProfilePersonal" WHERE "profileId" = p_profile_id) THEN
        v_pct := v_pct + 20;
    END IF;
    IF EXISTS (SELECT 1 FROM "ProfileReligious" WHERE "profileId" = p_profile_id) THEN
        v_pct := v_pct + 20;
    END IF;
    IF EXISTS (SELECT 1 FROM "ProfileLocations" WHERE "profileId" = p_profile_id) THEN
        v_pct := v_pct + 20;
    END IF;
    IF EXISTS (SELECT 1 FROM "ProfileProfessional" WHERE "profileId" = p_profile_id) THEN
        v_pct := v_pct + 20;
    END IF;
    IF EXISTS (SELECT 1 FROM "ProfileFamilyBio" WHERE "profileId" = p_profile_id) THEN
        v_pct := v_pct + 20;
    END IF;

    UPDATE "Profiles"
    SET "profileCompletePct" = v_pct,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_profile_id;

    RETURN v_pct;
END;
$$ LANGUAGE plpgsql;

-- Save Step 1: Personal details (without bodyType)
CREATE OR REPLACE FUNCTION fn_save_step_1_personal(
    p_user_id UUID,
    p_date_of_birth DATE,
    p_height_cm INTEGER,
    p_weight_kg INTEGER,
    p_physical_status "PhysicalStatus",
    p_marital_status "MaritalStatus",
    p_spoken_languages TEXT[],
    p_eating_habits "EatingHabits",
    p_resident_status VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
    v_profile_id UUID;
    v_pct INTEGER;
BEGIN
    v_profile_id := fn_ensure_profile_exists(p_user_id);

    INSERT INTO "ProfilePersonal" (
        "profileId", "dateOfBirth", "heightCm", "weightKg",
        "physicalStatus", "maritalStatus", "spokenLanguages", "eatingHabits",
        "residentStatus", "updatedAt"
    ) VALUES (
        v_profile_id, p_date_of_birth, p_height_cm, p_weight_kg,
        p_physical_status, p_marital_status, COALESCE(p_spoken_languages, ARRAY[]::TEXT[]),
        p_eating_habits, p_resident_status, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("profileId") DO UPDATE
    SET "dateOfBirth" = EXCLUDED."dateOfBirth",
        "heightCm" = EXCLUDED."heightCm",
        "weightKg" = EXCLUDED."weightKg",
        "physicalStatus" = EXCLUDED."physicalStatus",
        "maritalStatus" = EXCLUDED."maritalStatus",
        "spokenLanguages" = EXCLUDED."spokenLanguages",
        "eatingHabits" = EXCLUDED."eatingHabits",
        "residentStatus" = EXCLUDED."residentStatus",
        "updatedAt" = CURRENT_TIMESTAMP;

    v_pct := fn_recalculate_profile_completion(v_profile_id);
    RETURN v_pct;
END;
$$ LANGUAGE plpgsql;

-- Save Step 2: Religious details
CREATE OR REPLACE FUNCTION fn_save_step_2_religious(
    p_user_id UUID,
    p_religion VARCHAR(50),
    p_caste VARCHAR(100),
    p_subcaste VARCHAR(100),
    p_open_to_any_subcaste BOOLEAN,
    p_gothra VARCHAR(100),
    p_dosh "Dosh",
    p_manglik "Dosh"
)
RETURNS INTEGER AS $$
DECLARE
    v_profile_id UUID;
    v_pct INTEGER;
BEGIN
    v_profile_id := fn_ensure_profile_exists(p_user_id);

    INSERT INTO "ProfileReligious" (
        "profileId", "religion", "caste", "subcaste",
        "openToAnySubcaste", "gothra", "dosh", "manglik", "updatedAt"
    ) VALUES (
        v_profile_id, p_religion, p_caste, p_subcaste,
        COALESCE(p_open_to_any_subcaste, false), p_gothra, p_dosh, p_manglik, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("profileId") DO UPDATE
    SET "religion" = EXCLUDED."religion",
        "caste" = EXCLUDED."caste",
        "subcaste" = EXCLUDED."subcaste",
        "openToAnySubcaste" = EXCLUDED."openToAnySubcaste",
        "gothra" = EXCLUDED."gothra",
        "dosh" = EXCLUDED."dosh",
        "manglik" = EXCLUDED."manglik",
        "updatedAt" = CURRENT_TIMESTAMP;

    v_pct := fn_recalculate_profile_completion(v_profile_id);
    RETURN v_pct;
END;
$$ LANGUAGE plpgsql;

-- Save Step 3: Location details
CREATE OR REPLACE FUNCTION fn_save_step_3_location(
    p_user_id UUID,
    p_country VARCHAR(100),
    p_state VARCHAR(100),
    p_city VARCHAR(100)
)
RETURNS INTEGER AS $$
DECLARE
    v_profile_id UUID;
    v_pct INTEGER;
BEGIN
    v_profile_id := fn_ensure_profile_exists(p_user_id);

    INSERT INTO "ProfileLocations" (
        "profileId", "country", "state", "city", "updatedAt"
    ) VALUES (
        v_profile_id, p_country, p_state, p_city, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("profileId") DO UPDATE
    SET "country" = EXCLUDED."country",
        "state" = EXCLUDED."state",
        "city" = EXCLUDED."city",
        "updatedAt" = CURRENT_TIMESTAMP;

    v_pct := fn_recalculate_profile_completion(v_profile_id);
    RETURN v_pct;
END;
$$ LANGUAGE plpgsql;

-- Save Step 4: Professional details
CREATE OR REPLACE FUNCTION fn_save_step_4_professional(
    p_user_id UUID,
    p_education VARCHAR(150),
    p_employment_type "EmploymentType",
    p_occupation VARCHAR(150),
    p_income_currency VARCHAR(10),
    p_annual_income_range VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
    v_profile_id UUID;
    v_pct INTEGER;
BEGIN
    v_profile_id := fn_ensure_profile_exists(p_user_id);

    INSERT INTO "ProfileProfessional" (
        "profileId", "education", "employmentType", "occupation",
        "incomeCurrency", "annualIncomeRange", "updatedAt"
    ) VALUES (
        v_profile_id, p_education, p_employment_type, p_occupation,
        COALESCE(p_income_currency, 'INR'), p_annual_income_range, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("profileId") DO UPDATE
    SET "education" = EXCLUDED."education",
        "employmentType" = EXCLUDED."employmentType",
        "occupation" = EXCLUDED."occupation",
        "incomeCurrency" = EXCLUDED."incomeCurrency",
        "annualIncomeRange" = EXCLUDED."annualIncomeRange",
        "updatedAt" = CURRENT_TIMESTAMP;

    v_pct := fn_recalculate_profile_completion(v_profile_id);
    RETURN v_pct;
END;
$$ LANGUAGE plpgsql;

-- Save Step 5: Bio and Family details
CREATE OR REPLACE FUNCTION fn_save_step_5_family_bio(
    p_user_id UUID,
    p_family_status VARCHAR(50),
    p_about_myself TEXT,
    p_looking_for TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_profile_id UUID;
    v_pct INTEGER;
BEGIN
    v_profile_id := fn_ensure_profile_exists(p_user_id);

    INSERT INTO "ProfileFamilyBio" (
        "profileId", "familyStatus", "aboutMyself", "lookingFor", "updatedAt"
    ) VALUES (
        v_profile_id, p_family_status, p_about_myself, p_looking_for, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("profileId") DO UPDATE
    SET "familyStatus" = EXCLUDED."familyStatus",
        "aboutMyself" = EXCLUDED."aboutMyself",
        "lookingFor" = EXCLUDED."lookingFor",
        "updatedAt" = CURRENT_TIMESTAMP;

    v_pct := fn_recalculate_profile_completion(v_profile_id);
    RETURN v_pct;
END;
$$ LANGUAGE plpgsql;

-- Get complete profile JSON
CREATE OR REPLACE FUNCTION fn_get_profile_by_user_id(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'user', jsonb_build_object(
            'id', u."id",
            'name', u."name",
            'email', u."email",
            'mobile', u."mobile",
            'gender', u."gender",
            'profileCreatedBy', u."profileCreatedBy",
            'accountStatus', u."accountStatus",
            'membershipType', u."membershipType"
        ),
        'profile', (
            SELECT jsonb_build_object(
                'id', p."id",
                'userId', p."userId",
                'profileUid', p."profileUid",
                'profileComplete', p."profileCompletePct",
                'photoVerified', p."photoVerified",
                'idVerified', p."idVerified",
                'personalDetails', COALESCE(to_jsonb(pp.*) - 'profileId', '{}'::jsonb),
                'religiousDetails', COALESCE(to_jsonb(pr.*) - 'profileId', '{}'::jsonb),
                'locationDetails', COALESCE(to_jsonb(pl.*) - 'profileId', '{}'::jsonb),
                'professionalDetails', COALESCE(to_jsonb(pw.*) - 'profileId', '{}'::jsonb),
                'additionalDetails', COALESCE(to_jsonb(pf.*) - 'profileId', '{}'::jsonb)
            )
            FROM "Profiles" p
            LEFT JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
            LEFT JOIN "ProfileReligious" pr ON pr."profileId" = p."id"
            LEFT JOIN "ProfileLocations" pl ON pl."profileId" = p."id"
            LEFT JOIN "ProfileProfessional" pw ON pw."profileId" = p."id"
            LEFT JOIN "ProfileFamilyBio" pf ON pf."profileId" = p."id"
            WHERE p."userId" = u."id"
        )
    ) INTO v_result
    FROM "Users" u
    WHERE u."id" = p_user_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- 3. ADMIN WORKFLOWS & AUDIT LOGS
-- ─────────────────────────────────────────────

-- Dashboard stats
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

-- List pending profiles
CREATE OR REPLACE FUNCTION fn_admin_list_pending_profiles()
RETURNS JSONB AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'userId', u."id",
                'name', u."name",
                'email', u."email",
                'mobile', u."mobile",
                'gender', u."gender",
                'createdAt', u."createdAt",
                'profileUid', p."profileUid",
                'profileCompletePct', p."profileCompletePct",
                'location', jsonb_build_object(
                    'city', pl."city",
                    'state', pl."state",
                    'country', pl."country"
                )
            ) ORDER BY u."createdAt" DESC
        )
        FROM "Users" u
        JOIN "Profiles" p ON p."userId" = u."id"
        LEFT JOIN "ProfileLocations" pl ON pl."profileId" = p."id"
        WHERE u."accountStatus" = 'pending' AND u."role" = 'user'
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Approve profile procedure
CREATE OR REPLACE PROCEDURE sp_admin_approve_profile(
    p_target_user_id UUID,
    p_admin_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "accountStatus" = 'active',
        "rejectionReason" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    INSERT INTO "AdminAuditLog" ("adminId", "action", "targetId", "notes", "createdAt")
    VALUES (p_admin_id, 'APPROVE_PROFILE', p_target_user_id, 'Profile approved by admin', CURRENT_TIMESTAMP);
END;
$$;

-- Reject profile procedure
CREATE OR REPLACE PROCEDURE sp_admin_reject_profile(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "Users"
    SET "accountStatus" = 'rejected',
        "rejectionReason" = p_reason,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = p_target_user_id;

    INSERT INTO "AdminAuditLog" ("adminId", "action", "targetId", "notes", "createdAt")
    VALUES (p_admin_id, 'REJECT_PROFILE', p_target_user_id, p_reason, CURRENT_TIMESTAMP);
END;
$$;

-- Seed admin user
CREATE OR REPLACE FUNCTION fn_seed_admin_user(
    p_name VARCHAR(100),
    p_email VARCHAR(150),
    p_password_hash TEXT,
    p_mobile VARCHAR(15)
)
RETURNS UUID AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    INSERT INTO "Users" (
        "name", "email", "passwordHash", "mobile", "role",
        "accountStatus", "mobileVerified", "emailVerified"
    ) VALUES (
        p_name, LOWER(TRIM(p_email)), p_password_hash, p_mobile, 'admin',
        'active', true, true
    )
    ON CONFLICT ("email") DO UPDATE
    SET "name" = EXCLUDED."name",
        "passwordHash" = EXCLUDED."passwordHash",
        "role" = 'admin',
        "accountStatus" = 'active',
        "mobileVerified" = true,
        "emailVerified" = true,
        "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id" INTO v_admin_id;

    RETURN v_admin_id;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

DROP PROCEDURE IF EXISTS sp_admin_reject_profile(UUID, UUID, TEXT);
DROP PROCEDURE IF EXISTS sp_admin_approve_profile(UUID, UUID);
DROP FUNCTION IF EXISTS fn_seed_admin_user(VARCHAR(100), VARCHAR(150), TEXT, VARCHAR(15));
DROP FUNCTION IF EXISTS fn_admin_list_pending_profiles();
DROP FUNCTION IF EXISTS fn_admin_get_dashboard_stats();
DROP FUNCTION IF EXISTS fn_get_profile_by_user_id(UUID);
DROP FUNCTION IF EXISTS fn_save_step_5_family_bio(UUID, VARCHAR(50), TEXT, TEXT);
DROP FUNCTION IF EXISTS fn_save_step_4_professional(UUID, VARCHAR(150), "EmploymentType", VARCHAR(150), VARCHAR(10), VARCHAR(50));
DROP FUNCTION IF EXISTS fn_save_step_3_location(UUID, VARCHAR(100), VARCHAR(100), VARCHAR(100));
DROP FUNCTION IF EXISTS fn_save_step_2_religious(UUID, VARCHAR(50), VARCHAR(100), VARCHAR(100), BOOLEAN, VARCHAR(100), "Dosh", "Dosh");
DROP FUNCTION IF EXISTS fn_save_step_1_personal(UUID, DATE, INTEGER, INTEGER, "PhysicalStatus", "MaritalStatus", TEXT[], "EatingHabits", VARCHAR(50));
DROP FUNCTION IF EXISTS fn_recalculate_profile_completion(UUID);
DROP FUNCTION IF EXISTS fn_ensure_profile_exists(UUID);
DROP FUNCTION IF EXISTS fn_clear_user_session(UUID);
DROP FUNCTION IF EXISTS fn_get_user_session(UUID);
DROP FUNCTION IF EXISTS fn_save_user_session(UUID, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS fn_verify_user_mobile(UUID);
DROP FUNCTION IF EXISTS fn_get_user_by_identifier(TEXT);
DROP FUNCTION IF EXISTS fn_register_user(VARCHAR(100), VARCHAR(150), TEXT, VARCHAR(15), "ProfileCreatedBy", "Gender");