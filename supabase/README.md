# NeuroGlove Supabase Database & Security Guide

## Execution Order in Supabase SQL Editor

Run these files strictly in this order:

1. `schema.sql` — Creates tables, constraints, indexes, and primary keys.
2. `rls_policies.sql` — Enables Row Level Security (RLS) on all 7 tables and creates access policies.
3. `storage.sql` — Sets up the private `neuroglove-research` storage bucket with signed-URL policies.

---

## 1. Project Setup on Supabase

1. Go to [https://supabase.com](https://supabase.com) and create an organization/project named `neuroglove`.
2. Choose a region close to your users and save your database password.
3. Once provisioned, open **Project Settings → API**:
   - Copy **Project URL** (`https://<project-ref>.supabase.co`)
   - Copy **anon / public key** (`eyJh...`) -> Used in Frontend
   - Copy **service_role secret** (`eyJh...`) -> Used in Backend & Data Importer ONLY! Never expose this key to browser code.

---

## 2. Table Schema Overview

| Table | Purpose |
|---|---|
| `research_datasets` | Metadata, citation, and CC BY-NC-SA 4.0 licence tracking for PADS. |
| `research_subjects` | Pseudonymous research participants (PADS IDs). Separate from real patients. |
| `research_recordings` | RightWrist recording metadata (units, sampling rate, duration). |
| `sensor_readings` | High-frequency raw accelerometer ($m/s^2$) and gyroscope ($^\circ/s$) data. |
| `research_analytics` | Computed signal metrics (RMS, dominant frequency, 3–12 Hz power). |
| `research_sessions` | Clinical/research sessions mapping participants to UI timelines. |
| `profiles` | User accounts linked to Supabase Auth (`auth.users`). |

---

## 3. Row Level Security (RLS) Rules

- **Authenticated Users**: Read-only access to research datasets, participants, recordings, sensor samples, analytics, and sessions.
- **Profiles**: Authenticated users can only read, insert, and update their own profile (`auth.uid() = id`).
- **Service Role**: Backend and data importer use the service-role key to perform administrative batch inserts, data ingestion, and file management.
- **Anon/Unauthenticated**: Cannot query sensitive clinical or research tables.

---

## 4. PADS Dataset Licence Compliance

The **Parkinson's Disease Smartwatch (PADS)** dataset is provided under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.
- Attribution citation: *Varghese, J., Brenner, A., Fujarski, M., van Laar, J. A. S., Plagwitz, L., & Warnecke, T. (2024). Parkinson's Disease Smartwatch dataset (PADS) (version 1.0.0). PhysioNet. https://doi.org/10.13026/cs4p-p927*
- Raw research files are kept in the **private** bucket and never publicly redistributed.
