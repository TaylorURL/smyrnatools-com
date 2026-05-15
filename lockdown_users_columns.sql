-- Replace the broad SELECT grant on public.users with an explicit column allowlist
-- so password_hash and salt are unreadable by the authenticated role.
-- Verified safe: only useMyAccountLoad.js (`email`), ManagerDetailView.jsx
-- (`id, email`), and UserService.js (`id, email, last_login_at, created_at, updated_at`)
-- read users directly. All other access goes through edge functions (service_role).

BEGIN;

REVOKE SELECT ON TABLE public.users FROM authenticated;
GRANT SELECT (id, email, created_at, updated_at, last_login_at)
    ON public.users TO authenticated;

COMMIT;

-- Verify with:
--   curl -s -w "\n%{http_code}\n" \
--     "https://db.smyrnatools.com/rest/v1/users?select=password_hash&limit=1" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT"
--   Expected: 401/403 with code 42501 permission denied for column password_hash
