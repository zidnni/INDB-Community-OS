CREATE TABLE idea_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE idea_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read idea comments"
  ON idea_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create idea comments"
  ON idea_comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND author_id = auth.uid());

CREATE POLICY "Users can delete their own idea comments"
  ON idea_comments FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Moderators and admins can manage idea comments"
  ON idea_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('moderator', 'admin')
    )
  );
