-- Grant the new `plan.yourtab` permission node to every role that should
-- see the role-aware "Your Plant / District / Region" section on the Plan
-- dashboard. Runs idempotently — re-executing is safe because each update
-- only appends when the permission isn't already in the role's array.
--
-- Target roles:
--   * any role whose name contains "Plant Manager"    (e.g. Plant Manager, Senior Plant Manager)
--   * any role whose name contains "District Manager"
--   * any role whose name contains "General Manager"

UPDATE users_roles
SET
    permissions = ARRAY(
        SELECT DISTINCT perm
        FROM unnest(COALESCE(permissions, ARRAY[]::text[]) || ARRAY['plan.yourtab']) AS perm
    ),
    updated_at = NOW()
WHERE
    name ILIKE '%plant manager%'
    OR name ILIKE '%district manager%'
    OR name ILIKE '%general manager%';

-- Quick verification: list affected roles and confirm the permission is present.
SELECT id, name, 'plan.yourtab' = ANY(permissions) AS has_plan_yourtab
FROM users_roles
WHERE
    name ILIKE '%plant manager%'
    OR name ILIKE '%district manager%'
    OR name ILIKE '%general manager%'
ORDER BY weight DESC NULLS LAST, name;
