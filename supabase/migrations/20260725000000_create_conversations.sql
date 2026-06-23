-- 20260725000000_create_conversations.sql
-- Unified Conversations / Inbox system
-- Supports: graatek, idea (future: direct, support)

-- ── conversations ──────────────────────────────────────────────
CREATE TABLE conversations (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type      TEXT NOT NULL CHECK (type IN ('graatek', 'idea')),
  graatek_id UUID REFERENCES community_shares(id) ON DELETE SET NULL,
  idea_id    UUID REFERENCES ideas(id) ON DELETE SET NULL,
  title     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_conv_graatek ON conversations(graatek_id) WHERE graatek_id IS NOT NULL;
CREATE UNIQUE INDEX idx_conv_idea    ON conversations(idea_id)    WHERE idea_id IS NOT NULL;

-- ── conversation_participants ─────────────────────────────────
CREATE TABLE conversation_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ,
  unread_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_cp_user         ON conversation_participants(user_id);
CREATE INDEX idx_cp_conversation ON conversation_participants(conversation_id);

-- ── conversation_messages ─────────────────────────────────────
CREATE TABLE conversation_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);

CREATE INDEX idx_cm_conversation ON conversation_messages(conversation_id, created_at ASC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- conversations: participants can view
CREATE POLICY "conv_participants_select"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = id AND user_id = auth.uid()
    )
  );

-- conversations: service role insert/update (no user inserts)
CREATE POLICY "conv_service_insert"
  ON conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "conv_service_update"
  ON conversations FOR UPDATE USING (true);

-- conversation_participants: view own rows
CREATE POLICY "cp_select_own"
  ON conversation_participants FOR SELECT
  USING (user_id = auth.uid());

-- conversation_participants: update own rows (mark read)
CREATE POLICY "cp_update_own"
  ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- conversation_participants: service insert
CREATE POLICY "cp_service_insert"
  ON conversation_participants FOR INSERT WITH CHECK (true);

-- conversation_messages: participants can select
CREATE POLICY "cm_participants_select"
  ON conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversation_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- conversation_messages: participants can insert own
CREATE POLICY "cm_participants_insert_own"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversation_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- conversation_messages: sender can update read_at
CREATE POLICY "cm_sender_update_read"
  ON conversation_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- ── realtime publication ──────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;

-- ── helper: get-or-create conversation for a Graatek ──────────
CREATE OR REPLACE FUNCTION ensure_graatek_conversation(p_share_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv_id UUID;
  v_owner_id UUID;
  v_requester_id UUID;
  v_title TEXT;
BEGIN
  SELECT id INTO v_conv_id FROM conversations WHERE graatek_id = p_share_id LIMIT 1;
  IF v_conv_id IS NOT NULL THEN
    UPDATE conversations SET archived_at = NULL WHERE id = v_conv_id AND archived_at IS NOT NULL;
    RETURN v_conv_id;
  END IF;

  SELECT cs.owner_id, csr.requester_id, COALESCE(cs.title, '')
  INTO v_owner_id, v_requester_id, v_title
  FROM community_shares cs
  JOIN community_share_requests csr ON csr.id = cs.accepted_request_id
  WHERE cs.id = p_share_id AND csr.status = 'accepted';

  IF v_owner_id IS NULL OR v_requester_id IS NULL THEN
    RAISE EXCEPTION 'No accepted request for share %', p_share_id;
  END IF;

  INSERT INTO conversations (type, graatek_id, title)
  VALUES ('graatek', p_share_id, v_title)
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_owner_id), (v_conv_id, v_requester_id)
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;

-- ── helper: get-or-create conversation for an Idea ────────────
CREATE OR REPLACE FUNCTION ensure_idea_conversation(p_idea_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv_id UUID;
  v_author_id UUID;
  v_title TEXT;
BEGIN
  SELECT id INTO v_conv_id FROM conversations WHERE idea_id = p_idea_id LIMIT 1;
  IF v_conv_id IS NOT NULL THEN
    UPDATE conversations SET archived_at = NULL WHERE id = v_conv_id AND archived_at IS NOT NULL;
    RETURN v_conv_id;
  END IF;

  SELECT author_id, COALESCE(title, '') INTO v_author_id, v_title
  FROM ideas WHERE id = p_idea_id;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Idea % not found', p_idea_id;
  END IF;

  INSERT INTO conversations (type, idea_id, title)
  VALUES ('idea', p_idea_id, v_title)
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_author_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT v_conv_id, ip.user_id
  FROM idea_participants ip
  WHERE ip.idea_id = p_idea_id AND ip.status = 'accepted'
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;

-- ── helper: add participant to conversation ───────────────────
CREATE OR REPLACE FUNCTION add_conversation_participant(p_conv_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (p_conv_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── helper: archive conversation ──────────────────────────────
CREATE OR REPLACE FUNCTION archive_conversation(p_conv_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE conversations SET archived_at = now() WHERE id = p_conv_id;
END;
$$;

-- ── RPC: increment unread count for all participants except sender ──
CREATE OR REPLACE FUNCTION increment_conv_unread(p_conv_id UUID, p_except_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = p_conv_id AND user_id != p_except_user;
END;
$$;

-- ── RPC: get user's inbox list ────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_inbox(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  type TEXT,
  graatek_id UUID,
  idea_id UUID,
  title TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count BIGINT,
  other_user_id UUID,
  other_username TEXT,
  other_full_name TEXT,
  other_avatar_url TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH my_participations AS (
    SELECT cp.conversation_id, cp.unread_count, cp.last_read_at
    FROM conversation_participants cp
    WHERE cp.user_id = p_user_id
  ),
  latest_messages AS (
    SELECT DISTINCT ON (cm.conversation_id)
      cm.conversation_id,
      cm.message AS last_message_text,
      cm.created_at AS last_message_at,
      cm.sender_id AS last_message_sender_id
    FROM conversation_messages cm
    ORDER BY cm.conversation_id, cm.created_at DESC
  ),
  other_participant AS (
    SELECT DISTINCT ON (cp.conversation_id)
      cp.conversation_id,
      cp.user_id AS other_user_id,
      p.username AS other_username,
      p.full_name AS other_full_name,
      p.avatar_url AS other_avatar_url
    FROM conversation_participants cp
    LEFT JOIN profiles p ON p.id = cp.user_id
    WHERE cp.user_id != p_user_id
  )
  SELECT
    c.id,
    c.type,
    c.graatek_id,
    c.idea_id,
    c.title,
    c.archived_at,
    c.created_at,
    lm.last_message_text,
    lm.last_message_at,
    lm.last_message_sender_id,
    mp.unread_count::BIGINT,
    op.other_user_id,
    op.other_username,
    op.other_full_name,
    op.other_avatar_url
  FROM my_participations mp
  JOIN conversations c ON c.id = mp.conversation_id
  LEFT JOIN latest_messages lm ON lm.conversation_id = c.id
  LEFT JOIN other_participant op ON op.conversation_id = c.id
  ORDER BY COALESCE(lm.last_message_at, c.created_at) DESC;
END;
$$;

-- ── BACKFILL: existing Graatek discussions ────────────────────
DO $$
DECLARE
  v_conv UUID;
  v_rec RECORD;
BEGIN
  FOR v_rec IN (
    SELECT DISTINCT cs.id AS share_id, cs.owner_id, csr.requester_id, COALESCE(cs.title, '') AS title,
           cs.accepted_request_id
    FROM community_shares cs
    JOIN community_share_requests csr ON csr.id = cs.accepted_request_id
    WHERE csr.status = 'accepted'
  )
  LOOP
    INSERT INTO conversations (type, graatek_id, title)
    VALUES ('graatek', v_rec.share_id, v_rec.title)
    RETURNING id INTO v_conv;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv, v_rec.owner_id), (v_conv, v_rec.requester_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO conversation_messages (conversation_id, sender_id, message, created_at)
    SELECT v_conv, fm.sender_id, fm.message, fm.created_at
    FROM fadla_request_messages fm
    WHERE fm.share_id = v_rec.share_id AND fm.request_id = v_rec.accepted_request_id
    ORDER BY fm.created_at ASC;
  END LOOP;
END $$;

-- ── BACKFILL: existing Idea discussions ───────────────────────
DO $$
DECLARE
  v_conv UUID;
  v_rec RECORD;
BEGIN
  FOR v_rec IN (
    SELECT DISTINCT i.id, i.author_id, COALESCE(i.title, '') AS title
    FROM idea_messages im
    JOIN ideas i ON i.id = im.idea_id
  )
  LOOP
    INSERT INTO conversations (type, idea_id, title)
    VALUES ('idea', v_rec.id, v_rec.title)
    RETURNING id INTO v_conv;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv, v_rec.author_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO conversation_participants (conversation_id, user_id)
    SELECT v_conv, ip.user_id
    FROM idea_participants ip
    WHERE ip.idea_id = v_rec.id AND ip.status = 'accepted'
    ON CONFLICT DO NOTHING;

    INSERT INTO conversation_messages (conversation_id, sender_id, message, created_at)
    SELECT v_conv, im.sender_id, im.message, im.created_at
    FROM idea_messages im
    WHERE im.idea_id = v_rec.id
    ORDER BY im.created_at ASC;
  END LOOP;

  -- also create conversations for Ideas with accepted participants but no messages
  FOR v_rec IN (
    SELECT DISTINCT i.id, i.author_id, COALESCE(i.title, '') AS title
    FROM idea_participants ip
    JOIN ideas i ON i.id = ip.idea_id
    WHERE ip.status = 'accepted'
    AND NOT EXISTS (SELECT 1 FROM idea_messages im WHERE im.idea_id = i.id)
  )
  LOOP
    INSERT INTO conversations (type, idea_id, title)
    VALUES ('idea', v_rec.id, v_rec.title)
    RETURNING id INTO v_conv;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv, v_rec.author_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO conversation_participants (conversation_id, user_id)
    SELECT v_conv, ip.user_id
    FROM idea_participants ip
    WHERE ip.idea_id = v_rec.id AND ip.status = 'accepted'
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
