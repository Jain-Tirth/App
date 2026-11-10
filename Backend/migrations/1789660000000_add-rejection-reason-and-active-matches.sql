-- Migration: add rejection reason to profile query & create active matches discovery function

-- 1. Update fn_get_profile_by_user_id to include rejectionReason
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
            'rejectionReason', u."rejectionReason",
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

-- 2. Create function to discover active matches for community members
CREATE OR REPLACE FUNCTION fn_get_active_matches(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_gender "Gender";
    v_matches JSONB;
BEGIN
    SELECT "gender" INTO v_user_gender FROM "Users" WHERE "id" = p_user_id;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_matches
    FROM (
        SELECT 
            u."id" AS "userId",
            p."profileUid",
            u."name",
            u."gender",
            pp."dateOfBirth",
            pp."heightCm",
            pp."maritalStatus",
            pr."religion",
            pr."caste",
            pr."subcaste",
            pl."city",
            pl."state",
            pl."country",
            pw."education",
            pw."occupation",
            pw."employmentType",
            pw."annualIncomeRange",
            pf."familyStatus",
            pf."aboutMyself",
            pf."lookingFor",
            p."photoVerified"
        FROM "Users" u
        JOIN "Profiles" p ON p."userId" = u."id"
        LEFT JOIN "ProfilePersonal" pp ON pp."profileId" = p."id"
        LEFT JOIN "ProfileReligious" pr ON pr."profileId" = p."id"
        LEFT JOIN "ProfileLocations" pl ON pl."profileId" = p."id"
        LEFT JOIN "ProfileProfessional" pw ON pw."profileId" = p."id"
        LEFT JOIN "ProfileFamilyBio" pf ON pf."profileId" = p."id"
        WHERE u."accountStatus" = 'active'
          AND u."id" != p_user_id
          AND (
              v_user_gender IS NULL 
              OR u."gender" IS NULL 
              OR u."gender" != v_user_gender
          )
        ORDER BY p."updatedAt" DESC
        LIMIT 50
    ) sub;

    RETURN v_matches;
END;
$$ LANGUAGE plpgsql;
