-- ============================================================================
-- ZIPBLIND MANAGEMENT SYSTEM — SUPABASE / POSTGRESQL MIGRATION
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE public.activity_type_enum AS ENUM (
    'Pemasangan',
    'Pengukuran',
    'Survey',
    'Perbaikan',
    'Service',
    'Pengiriman',
    'Pengambilan',
    'Lainnya'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.project_status_enum AS ENUM (
    'Dijadwalkan',
    'Sedang Berjalan',
    'Selesai',
    'Tertunda',
    'Dibatalkan'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_status_enum AS ENUM (
    'Dijadwalkan',
    'Sedang Berjalan',
    'Selesai',
    'Tertunda',
    'Dibatalkan'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.photo_category_enum AS ENUM (
    'Sebelum Pemasangan',
    'Proses Pekerjaan',
    'Hasil Akhir',
    'Lainnya'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. HELPER FUNCTION FOR UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. TABLES (14 ENTITAS SESUAI SPESIFIKASI PROMPT 2)
-- ============================================================================

-- 4.1. ADMINS
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(120) NOT NULL,
  email varchar(160) NOT NULL UNIQUE,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.2. TECHNICIANS
CREATE TABLE IF NOT EXISTS public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_code varchar(30) NOT NULL UNIQUE,
  full_name varchar(120) NOT NULL,
  phone varchar(30) NOT NULL,
  specialization varchar(120),
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.3. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code varchar(30) NOT NULL UNIQUE,
  full_name varchar(150) NOT NULL,
  contact_person varchar(120),
  phone varchar(30) NOT NULL,
  email varchar(160),
  address text NOT NULL,
  city varchar(100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.4. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code varchar(40) NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  title varchar(200) NOT NULL,
  installation_address text NOT NULL,
  description text,
  status public.project_status_enum NOT NULL DEFAULT 'Dijadwalkan',
  start_date date,
  target_end_date date,
  completed_at timestamptz,
  created_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_date_check CHECK (
    target_end_date IS NULL OR start_date IS NULL OR target_end_date >= start_date
  )
);

-- 4.5. PROJECT ACTIVITIES
CREATE TABLE IF NOT EXISTS public.project_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_code varchar(40) NOT NULL UNIQUE,
  activity_type public.activity_type_enum NOT NULL,
  title varchar(200) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  scheduled_time_slot varchar(50),
  status public.activity_status_enum NOT NULL DEFAULT 'Dijadwalkan',
  notes text,
  completed_at timestamptz,
  created_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_activities_date_check CHECK (end_date >= start_date)
);

-- 4.6. ACTIVITY TECHNICIANS (MANY-TO-MANY PENUGASAN TEKNISI)
CREATE TABLE IF NOT EXISTS public.activity_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.project_activities(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE RESTRICT,
  is_lead boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_technicians_unique UNIQUE (activity_id, technician_id)
);

-- 4.7. PRODUCT CATALOG
CREATE TABLE IF NOT EXISTS public.product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  unit_label varchar(20) NOT NULL DEFAULT 'set',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.8. ACTIVITY WORK DETAILS
CREATE TABLE IF NOT EXISTS public.activity_work_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.project_activities(id) ON DELETE CASCADE,
  activity_type public.activity_type_enum NOT NULL,
  product_id uuid NOT NULL REFERENCES public.product_catalog(id) ON DELETE RESTRICT,
  quantity_sets integer NOT NULL CHECK (quantity_sets > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.9. STATUS CHANGE LOGS
CREATE TABLE IF NOT EXISTS public.status_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.project_activities(id) ON DELETE CASCADE,
  entity_type varchar(20) NOT NULL CHECK (entity_type IN ('project', 'activity')),
  old_status varchar(40),
  new_status varchar(40) NOT NULL,
  reason_notes text,
  changed_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- 4.10. PROJECT PHOTOS (OPSIONAL, DISIMPAN DI SUPABASE STORAGE)
CREATE TABLE IF NOT EXISTS public.project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.project_activities(id) ON DELETE SET NULL,
  category public.photo_category_enum NOT NULL DEFAULT 'Hasil Akhir',
  storage_bucket varchar(80) NOT NULL DEFAULT 'project-photos',
  storage_path text NOT NULL UNIQUE,
  file_name varchar(255) NOT NULL,
  mime_type varchar(80),
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  caption text,
  uploaded_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 4.11. EXECUTIVE SECRET LINKS (TOKEN DISIMPAN DALAM BENTUK SHA-256 HASH)
CREATE TABLE IF NOT EXISTS public.executive_secret_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label varchar(120) NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  token_prefix varchar(12) NOT NULL,
  can_download_reports boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  last_accessed_at timestamptz,
  created_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.12. EXECUTIVE ACCESS LOGS
CREATE TABLE IF NOT EXISTS public.executive_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_link_id uuid NOT NULL REFERENCES public.executive_secret_links(id) ON DELETE CASCADE,
  access_action varchar(40) NOT NULL CHECK (
    access_action IN ('view_dashboard', 'download_pdf', 'download_excel')
  ),
  ip_address varchar(64),
  user_agent text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

-- 4.13. ADMIN ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  action_type varchar(60) NOT NULL,
  entity_name varchar(60) NOT NULL,
  entity_id uuid,
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.14. REPORT EXPORT LOGS
CREATE TABLE IF NOT EXISTS public.report_export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_period_month date NOT NULL,
  report_title varchar(160) NOT NULL,
  export_format varchar(10) NOT NULL CHECK (export_format IN ('PDF', 'EXCEL')),
  exported_by_role varchar(20) NOT NULL CHECK (exported_by_role IN ('admin', 'executive')),
  admin_id uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  secret_link_id uuid REFERENCES public.executive_secret_links(id) ON DELETE SET NULL,
  file_storage_path text,
  exported_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_work_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_secret_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_export_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. MASTER SEED DATA: KATALOG PRODUK AWAL (BUKAN DATA OPERASIONAL PALSU)
-- ============================================================================
INSERT INTO public.product_catalog (name, unit_label, is_active)
VALUES
  ('Roller Blind', 'set', true),
  ('Zipblind', 'set', true),
  ('Vertical Blind', 'set', true),
  ('Venetian Blind', 'set', true)
ON CONFLICT (name) DO NOTHING;
