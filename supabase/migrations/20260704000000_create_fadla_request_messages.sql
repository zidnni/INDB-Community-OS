CREATE TABLE public.fadla_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.community_shares(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.community_share_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fadla_request_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.fadla_request_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.community_shares cs
      WHERE cs.id = share_id AND cs.owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_insert" ON public.fadla_request_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.community_shares cs
      WHERE cs.id = share_id AND cs.owner_id = auth.uid()
    )
  );

CREATE POLICY "requester_select" ON public.fadla_request_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.community_share_requests csr
      WHERE csr.id = request_id
        AND csr.requester_id = auth.uid()
        AND csr.status = 'accepted'
    )
  );

CREATE POLICY "requester_insert" ON public.fadla_request_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.community_share_requests csr
      WHERE csr.id = request_id
        AND csr.requester_id = auth.uid()
        AND csr.status = 'accepted'
    )
  );

CREATE INDEX idx_fadla_request_messages_request_id ON public.fadla_request_messages(request_id);
CREATE INDEX idx_fadla_request_messages_share_id ON public.fadla_request_messages(share_id);
CREATE INDEX idx_fadla_request_messages_created_at ON public.fadla_request_messages(created_at);

ALTER TABLE public.fadla_request_messages ADD CONSTRAINT fadla_request_messages_message_check
  CHECK (char_length(message) > 0 AND char_length(message) <= 500);
