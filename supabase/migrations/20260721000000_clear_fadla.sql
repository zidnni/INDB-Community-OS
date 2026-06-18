-- Clear all Fadla (community_shares) content
-- Child tables cascade via ON DELETE CASCADE
-- Storage cleanup requires the dashboard (Storage → fadla-media → Select All → Delete)

delete from public.fadla_request_messages;
delete from public.community_share_requests;
delete from public.community_shares;
