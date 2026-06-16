-- Enable realtime replication for community_shares so that
-- confirmation status updates propagate to all participants.
alter publication supabase_realtime add table public.community_shares;
