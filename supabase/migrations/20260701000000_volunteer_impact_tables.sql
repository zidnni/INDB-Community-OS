-- Volunteer Opportunities table
CREATE TABLE IF NOT EXISTS volunteer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '🙋',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  organizer TEXT NOT NULL DEFAULT 'I ❤️ NDB',
  organizer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  location TEXT NOT NULL DEFAULT 'نواذيبو',
  date TEXT NOT NULL DEFAULT 'قريباً',
  duration TEXT NOT NULL DEFAULT 'مرن',
  category TEXT NOT NULL DEFAULT 'community',
  volunteers_needed INTEGER NOT NULL DEFAULT 10,
  volunteers_joined INTEGER NOT NULL DEFAULT 0,
  skills TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'full', 'completed', 'cancelled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Volunteer Applications table
CREATE TABLE IF NOT EXISTS volunteer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, user_id)
);

-- Volunteer Attendance table
CREATE TABLE IF NOT EXISTS volunteer_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES volunteer_applications(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hours NUMERIC(5,1) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unmarked' CHECK (status IN ('confirmed', 'absent', 'unmarked')),
  confirmed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Impact Events table
CREATE TABLE IF NOT EXISTS impact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'donation_verified',
    'volunteer_activity_completed',
    'graatek_exchange_completed',
    'idea_completed',
    'memory_published'
  )),
  reference_id TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_status ON volunteer_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_category ON volunteer_opportunities(category);
CREATE INDEX IF NOT EXISTS idx_volunteer_opportunities_ends_at ON volunteer_opportunities(ends_at);
CREATE INDEX IF NOT EXISTS idx_volunteer_applications_user_id ON volunteer_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_applications_opportunity_id ON volunteer_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_applications_status ON volunteer_applications(status);
CREATE INDEX IF NOT EXISTS idx_volunteer_attendance_user_id ON volunteer_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_attendance_opportunity_id ON volunteer_attendance(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_attendance_status ON volunteer_attendance(status);
CREATE INDEX IF NOT EXISTS idx_impact_events_user_id ON impact_events(user_id);
CREATE INDEX IF NOT EXISTS idx_impact_events_event_type ON impact_events(event_type);
CREATE INDEX IF NOT EXISTS idx_impact_events_created_at ON impact_events(created_at);

-- Enable RLS
ALTER TABLE volunteer_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for volunteer_opportunities
CREATE POLICY "Anyone can view open volunteer opportunities"
  ON volunteer_opportunities FOR SELECT
  USING (status IN ('open', 'in_progress'));

CREATE POLICY "Admins can manage volunteer opportunities"
  ON volunteer_opportunities FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS policies for volunteer_applications
CREATE POLICY "Users can view own applications"
  ON volunteer_applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all applications"
  ON volunteer_applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can create own applications"
  ON volunteer_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update applications"
  ON volunteer_applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS policies for volunteer_attendance
CREATE POLICY "Users can view own attendance"
  ON volunteer_attendance FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage attendance"
  ON volunteer_attendance FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS policies for impact_events
CREATE POLICY "Users can view own impact events"
  ON impact_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all impact events"
  ON impact_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "System can insert impact events"
  ON impact_events FOR INSERT
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_volunteer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volunteer_opportunities_updated_at
  BEFORE UPDATE ON volunteer_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_volunteer_updated_at();

CREATE TRIGGER volunteer_applications_updated_at
  BEFORE UPDATE ON volunteer_applications
  FOR EACH ROW EXECUTE FUNCTION update_volunteer_updated_at();

CREATE TRIGGER volunteer_attendance_updated_at
  BEFORE UPDATE ON volunteer_attendance
  FOR EACH ROW EXECUTE FUNCTION update_volunteer_updated_at();
