-- ============================================================
-- FADLA: Recipient + owner handover confirmations
-- Keeps reserved items visible until both sides confirm handover,
-- then allows the owner to complete and archive the item.
-- ============================================================

alter table public.community_shares
  add column if not exists accepted_request_id uuid references public.community_share_requests(id) on delete set null;

alter table public.community_share_requests
  add column if not exists collected_at timestamptz,
  add column if not exists handed_over_at timestamptz;

create index if not exists idx_community_shares_accepted_request
  on public.community_shares(accepted_request_id)
  where accepted_request_id is not null;

create index if not exists idx_community_share_requests_handover
  on public.community_share_requests(share_id, status, collected_at, handed_over_at);
