-- ============================================================
-- NeuroGlove Supabase Schema
-- PostgreSQL via Supabase
-- 
-- Apply this in Supabase SQL Editor in this order.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: research_datasets
-- Stores metadata about imported research datasets (e.g. PADS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.research_datasets (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_name       TEXT NOT NULL,
  source_url         TEXT,
  version            TEXT,
  citation           TEXT,
  licence            TEXT,
  description        TEXT,
  sampling_frequency NUMERIC,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.research_datasets IS 'Metadata for imported public research datasets. PADS: CC BY-NC-SA 4.0.';

-- ============================================================
-- TABLE: research_subjects
-- Pseudonymous research participants from imported datasets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.research_subjects (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id           UUID NOT NULL REFERENCES public.research_datasets(id) ON DELETE CASCADE,
  external_subject_id  TEXT NOT NULL,
  participant_code      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (dataset_id, external_subject_id)
);

COMMENT ON TABLE public.research_subjects IS 'Pseudonymous research participants. Not real patients. For research data only.';

CREATE INDEX IF NOT EXISTS idx_research_subjects_dataset_id ON public.research_subjects (dataset_id);

-- ============================================================
-- TABLE: research_recordings
-- Individual sensor recordings (initially: RightWrist only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.research_recordings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id            UUID NOT NULL REFERENCES public.research_datasets(id) ON DELETE CASCADE,
  subject_id            UUID NOT NULL REFERENCES public.research_subjects(id) ON DELETE CASCADE,
  external_recording_id TEXT,
  observation_id        TEXT,
  side                  TEXT CHECK (side IN ('left', 'right', 'unknown')),
  sensor_location       TEXT,
  task                  TEXT,
  sampling_rate         NUMERIC,
  duration_seconds      NUMERIC,
  accelerometer_unit    TEXT DEFAULT 'm/s²',
  gyroscope_unit        TEXT DEFAULT '°/s',
  storage_path          TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.research_recordings IS 'Sensor recordings from PADS dataset. Only RightWrist recordings imported initially. Units preserved from original dataset.';

CREATE INDEX IF NOT EXISTS idx_research_recordings_subject_id    ON public.research_recordings (subject_id);
CREATE INDEX IF NOT EXISTS idx_research_recordings_dataset_id    ON public.research_recordings (dataset_id);
CREATE INDEX IF NOT EXISTS idx_research_recordings_sensor_location ON public.research_recordings (sensor_location);
CREATE INDEX IF NOT EXISTS idx_research_recordings_task          ON public.research_recordings (task);

-- ============================================================
-- TABLE: sensor_readings
-- Raw accelerometer and gyroscope samples per recording
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sensor_readings (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recording_id     UUID NOT NULL REFERENCES public.research_recordings(id) ON DELETE CASCADE,
  sample_index     BIGINT NOT NULL,
  timestamp_offset NUMERIC,
  accelerometer_x  DOUBLE PRECISION,
  accelerometer_y  DOUBLE PRECISION,
  accelerometer_z  DOUBLE PRECISION,
  gyroscope_x      DOUBLE PRECISION,
  gyroscope_y      DOUBLE PRECISION,
  gyroscope_z      DOUBLE PRECISION,
  UNIQUE (recording_id, sample_index)
);

COMMENT ON TABLE public.sensor_readings IS 'Raw sensor samples. Units defined in parent research_recordings row. No fabricated values.';
COMMENT ON COLUMN public.sensor_readings.timestamp_offset IS 'Time offset in seconds from recording start. Null if not provided in source data.';
COMMENT ON COLUMN public.sensor_readings.accelerometer_x IS 'Accelerometer X axis. Unit defined in research_recordings.accelerometer_unit (default m/s²).';
COMMENT ON COLUMN public.sensor_readings.gyroscope_x IS 'Gyroscope X axis. Unit defined in research_recordings.gyroscope_unit (default °/s).';

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recording_id  ON public.sensor_readings (recording_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sample_index  ON public.sensor_readings (sample_index);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_rec_sample    ON public.sensor_readings (recording_id, sample_index);

-- ============================================================
-- TABLE: research_analytics
-- Computed signal processing results per recording
-- ============================================================
CREATE TABLE IF NOT EXISTS public.research_analytics (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id              UUID NOT NULL REFERENCES public.research_recordings(id) ON DELETE CASCADE,
  rms                       DOUBLE PRECISION,
  dominant_frequency        DOUBLE PRECISION,
  tremor_related_frequency  DOUBLE PRECISION,
  movement_intensity        DOUBLE PRECISION,
  signal_magnitude          DOUBLE PRECISION,
  frequency_features        JSONB,
  filtering_method          TEXT,
  algorithm_version         TEXT,
  calculated_at             TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.research_analytics IS 'Computed analytics from signal processing. Research use only. Not clinical tremor severity scores.';
COMMENT ON COLUMN public.research_analytics.rms IS 'Root Mean Square of signal magnitude vector (m/s²).';
COMMENT ON COLUMN public.research_analytics.dominant_frequency IS 'Frequency with highest power spectral density (Hz).';
COMMENT ON COLUMN public.research_analytics.tremor_related_frequency IS 'Fraction of power in 3-12 Hz band (Parkinson research band). Not a clinical diagnosis.';
COMMENT ON COLUMN public.research_analytics.movement_intensity IS 'Mean absolute value of signal (m/s²).';

CREATE INDEX IF NOT EXISTS idx_research_analytics_recording_id ON public.research_analytics (recording_id);

-- ============================================================
-- TABLE: research_sessions
-- Links subjects, recordings and task metadata for the UI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.research_sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id       UUID REFERENCES public.research_subjects(id) ON DELETE SET NULL,
  recording_id     UUID REFERENCES public.research_recordings(id) ON DELETE SET NULL,
  task             TEXT,
  start_time       TIMESTAMPTZ,
  end_time         TIMESTAMPTZ,
  duration_seconds NUMERIC,
  data_source      TEXT DEFAULT 'PUBLIC_RESEARCH' CHECK (data_source IN ('PUBLIC_RESEARCH', 'DEMO', 'LIVE_HARDWARE')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.research_sessions IS 'UI-facing session records linking participants to recordings. data_source keeps research/demo/hardware separate.';

CREATE INDEX IF NOT EXISTS idx_research_sessions_subject_id   ON public.research_sessions (subject_id);
CREATE INDEX IF NOT EXISTS idx_research_sessions_recording_id ON public.research_sessions (recording_id);

-- ============================================================
-- TABLE: profiles
-- Application user profiles linked to Supabase Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  role       TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'clinician', 'caregiver', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'App user profiles. Passwords managed by Supabase Auth — never stored here.';
