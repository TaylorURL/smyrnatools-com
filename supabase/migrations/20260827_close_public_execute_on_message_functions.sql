-- Close anon execute on the message functions, and pin their search_path.
--
-- Ten SECURITY DEFINER functions in public carried EXECUTE for PUBLIC, which
-- reaches them over `/rest/v1/rpc/<name>` with nothing but the publishable key
-- that ships in the page. SECURITY DEFINER runs them as the owner, so the
-- absence of a table grant for anon -- the thing that makes every table return
-- 401 -- protects nothing here.
--
-- The grantee is PUBLIC rather than anon, and that distinction is the whole
-- fix. Every one of these carried the leading `=X/postgres` ACL entry, which is
-- PUBLIC, and anon reaches them as a member of it. A revoke naming anon removes
-- an entry that was never there and leaves the function open; the first attempt
-- here did exactly that, and `get_messages_key()` still answered 200 afterwards.
-- authenticated and service_role hold explicit grants of their own, so revoking
-- PUBLIC does not touch them. `get_messages_key()` answered an unsigned
-- request with HTTP 200 and the key body; `decrypt_message_body` takes that key
-- the rest of the way, and `send_message` writes a message from any sender to
-- any recipient.
--
-- Nothing loses access. The browser never calls these as anon: DatabaseService
-- wraps fetch and replaces the anon-key bearer with the session JWT on every
-- request, and returns a local 401 when no JWT has been minted yet, so a real
-- call always arrives as authenticated. `handle_new_user` runs from a trigger,
-- which does not consult the caller's EXECUTE.
--
-- The search_path pinning covers the same set. A SECURITY DEFINER function with
-- a mutable search_path resolves its unqualified names against whatever the
-- caller put in front of it. The two message-body functions reach pgcrypto and
-- `get_messages_key` reads the vault, so those three keep the schemas they
-- resolve through rather than taking the bare public path.

revoke execute on function public.decrypt_message_body(bytea) from public;
revoke execute on function public.encrypt_message_body(text) from public;
revoke execute on function public.get_messages_key() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.mark_all_messages_read(uuid) from public;
revoke execute on function public.mark_conversation_read(uuid, uuid) from public;
revoke execute on function public.mark_message_read(uuid) from public;
revoke execute on function public.send_message(uuid, uuid, text, text, text, jsonb) from public;
revoke execute on function public.soft_delete_message_for_recipient(uuid) from public;
revoke execute on function public.soft_delete_message_for_sender(uuid) from public;

alter function public.decrypt_message_body(bytea) set search_path = public, extensions, pg_temp;
alter function public.encrypt_message_body(text) set search_path = public, extensions, pg_temp;
alter function public.get_messages_key() set search_path = public, vault, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.mark_all_messages_read(uuid) set search_path = public, pg_temp;
alter function public.mark_conversation_read(uuid, uuid) set search_path = public, pg_temp;
alter function public.mark_message_read(uuid) set search_path = public, pg_temp;
alter function public.send_message(uuid, uuid, text, text, text, jsonb) set search_path = public, pg_temp;
alter function public.soft_delete_message_for_recipient(uuid) set search_path = public, pg_temp;
alter function public.soft_delete_message_for_sender(uuid) set search_path = public, pg_temp;
