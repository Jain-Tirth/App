-- Up Migration

-- Login and refresh read the member once and take the session version from
-- that row, so issuing tokens needs no second query on "Users".

DROP FUNCTION IF EXISTS fn_get_user_by_identifier(TEXT);

CREATE FUNCTION fn_get_user_by_identifier(
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
    "gender" "Gender",
    "sessionVersion" INTEGER
) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT
        u."id", u."name", u."email", u."passwordHash", u."mobile",
        u."mobileVerified", u."emailVerified", u."role", u."membershipType",
        u."accountStatus", u."rejectionReason", u."profileCreatedBy", u."gender",
        u."sessionVersion"
    FROM "Users" u
    WHERE u."email" = LOWER(TRIM(p_identifier))
       OR u."mobile" = TRIM(p_identifier)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

DROP FUNCTION IF EXISTS fn_get_user_by_identifier(TEXT);

CREATE FUNCTION fn_get_user_by_identifier(
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
