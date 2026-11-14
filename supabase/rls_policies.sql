-- ============================================================
-- NeuroGlove Row Level Security Policies
-- 
-- Apply AFTER schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.research_datasets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_subjects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_analytics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;

-- 1. research_datasets
DROP POLICY IF EXISTS "Authenticated users can read datasets" ON public.research_datasets;
CREATE POLICY "Authenticated users can read datasets"
  ON public.research_datasets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage datasets" ON public.research_datasets;
CREATE POLICY "Service role can manage datasets"
  ON public.research_datasets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. research_subjects
DROP POLICY IF EXISTS "Authenticated users can read subjects" ON public.research_subjects;
CREATE POLICY "Authenticated users can read subjects"
  ON public.research_subjects FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage subjects" ON public.research_subjects;
CREATE POLICY "Service role can manage subjects"
  ON public.research_subjects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. research_recordings
DROP POLICY IF EXISTS "Authenticated users can read recordings" ON public.research_recordings;
CREATE POLICY "Authenticated users can read recordings"
  ON public.research_recordings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage recordings" ON public.research_recordings;
CREATE POLICY "Service role can manage recordings"
  ON public.research_recordings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. sensor_readings
DROP POLICY IF EXISTS "Authenticated users can read sensor readings" ON public.sensor_readings;
CREATE POLICY "Authenticated users can read sensor readings"
  ON public.sensor_readings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage sensor readings" ON public.sensor_readings;
CREATE POLICY "Service role can manage sensor readings"
  ON public.sensor_readings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. research_analytics
DROP POLICY IF EXISTS "Authenticated users can read analytics" ON public.research_analytics;
CREATE POLICY "Authenticated users can read analytics"
  ON public.research_analytics FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage analytics" ON public.research_analytics;
CREATE POLICY "Service role can manage analytics"
  ON public.research_analytics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. research_sessions
DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.research_sessions;
CREATE POLICY "Authenticated users can read sessions"
  ON public.research_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage sessions" ON public.research_sessions;
CREATE POLICY "Service role can manage sessions"
  ON public.research_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. profiles (User owns their profile)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;
CREATE POLICY "Service role can manage profiles"
  ON public.profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto profile creation trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
