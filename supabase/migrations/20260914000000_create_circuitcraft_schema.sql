-- ==============================================================================
-- CircuitCraft 3D: Cloud & Multi-User Production PostgreSQL Schema
-- Migration: 20260914000000_create_circuitcraft_schema.sql
-- Backend: Supabase PostgreSQL with Row Level Security (RLS)
-- Idempotent: Can be run multiple times safely without conflicts
-- ==============================================================================

-- Enable UUID and Cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Table: profiles (Extends Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'pro', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Trigger: Automatically create profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. Table: projects (Core 3D Circuit Documents)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  units TEXT NOT NULL DEFAULT 'mm',
  board JSONB NOT NULL,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  connections JSONB NOT NULL DEFAULT '[]'::jsonb,
  wire_routes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  thumbnail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects Indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON public.projects(is_public) WHERE is_public = true;

-- Projects RLS Policies (Multi-User Isolation)
DROP POLICY IF EXISTS "Users can read own projects or public projects" ON public.projects;
CREATE POLICY "Users can read own projects or public projects" 
  ON public.projects FOR SELECT 
  USING (auth.uid() = owner_id OR is_public = true);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects" 
  ON public.projects FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" 
  ON public.projects FOR UPDATE 
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects" 
  ON public.projects FOR DELETE 
  USING (auth.uid() = owner_id);

-- ------------------------------------------------------------------------------
-- 3. Table: project_versions (Historical Snapshots & Version Restores)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  note TEXT,
  document JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_versions_proj_rev ON public.project_versions(project_id, revision DESC);

-- Project Versions RLS Policies
DROP POLICY IF EXISTS "Users can view versions of accessible projects" ON public.project_versions;
CREATE POLICY "Users can view versions of accessible projects" 
  ON public.project_versions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE public.projects.id = public.project_versions.project_id 
        AND (public.projects.owner_id = auth.uid() OR public.projects.is_public = true)
    )
  );

DROP POLICY IF EXISTS "Users can insert versions for own projects" ON public.project_versions;
CREATE POLICY "Users can insert versions for own projects" 
  ON public.project_versions FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE public.projects.id = public.project_versions.project_id 
        AND public.projects.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete versions of own projects" ON public.project_versions;
CREATE POLICY "Users can delete versions of own projects" 
  ON public.project_versions FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE public.projects.id = public.project_versions.project_id 
        AND public.projects.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 4. Table: catalog_products (Hardware Marketplace & 3D Component Store)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  parameters_schema JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_catalog_products_active ON public.catalog_products(is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON public.catalog_products(category);

-- Catalog Products Policies
DROP POLICY IF EXISTS "Active catalog products are readable by everyone" ON public.catalog_products;
CREATE POLICY "Active catalog products are readable by everyone" 
  ON public.catalog_products FOR SELECT 
  USING (is_active = true);

-- ------------------------------------------------------------------------------
-- 5. Table: product_versions (Component Revisions, 3D Models & Footprints)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_versions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  version_tag TEXT NOT NULL,
  cad_model_url TEXT,
  footprint_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_product_versions_product_id ON public.product_versions(product_id);

DROP POLICY IF EXISTS "Product versions are viewable by everyone" ON public.product_versions;
CREATE POLICY "Product versions are viewable by everyone" 
  ON public.product_versions FOR SELECT 
  USING (true);

-- ------------------------------------------------------------------------------
-- 6. Table: entitlements (User Subscriptions, Pro Features, Gerber Exports)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlements (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_entitlements_user_feature ON public.entitlements(user_id, feature_key);

DROP POLICY IF EXISTS "Users can only view their own entitlements" ON public.entitlements;
CREATE POLICY "Users can only view their own entitlements" 
  ON public.entitlements FOR SELECT 
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. Table: orders (Hardware Component & PCB Fabrication Orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'cancelled')),
  total_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders(user_id, status);

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" 
  ON public.orders FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders" 
  ON public.orders FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 8. Table: order_items (Detailed line items for orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.catalog_products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

DROP POLICY IF EXISTS "Users can view items of their own orders" ON public.order_items;
CREATE POLICY "Users can view items of their own orders" 
  ON public.order_items FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE public.orders.id = public.order_items.order_id 
        AND public.orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert items for their own orders" ON public.order_items;
CREATE POLICY "Users can insert items for their own orders" 
  ON public.order_items FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE public.orders.id = public.order_items.order_id 
        AND public.orders.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 9. Table: payment_events (Audited payment gateway webhooks & ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'vnpay',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON public.payment_events(order_id);

DROP POLICY IF EXISTS "Users can view payment events for their own orders" ON public.payment_events;
CREATE POLICY "Users can view payment events for their own orders" 
  ON public.payment_events FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE public.orders.id = public.payment_events.order_id 
        AND public.orders.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- Seed Starter Catalog Data
-- ------------------------------------------------------------------------------
INSERT INTO public.catalog_products (id, sku, name, description, category, price_cents, currency, is_active)
VALUES
  ('prod-dc-src', 'PWR-9V-BATT', 'Khối Nguồn Pin 9V Chuẩn', 'Khối pin DC 9V 500mAh có jack kết nối trực tiếp lên breadboard/PCB', 'power', 45000, 'VND', true),
  ('prod-res-330', 'RES-330R-14W', 'Điện trở Carbon 330 Ohm 1/4W', 'Gói 10 chiếc điện trở 330Ω sai số 5% vạch màu Cam-Cam-Nâu-Vàng kim', 'passives', 10000, 'VND', true),
  ('prod-led-5mm', 'LED-5MM-RED', 'Đèn LED Siêu Sáng Đỏ 5mm', 'Gói 5 chiếc LED đỏ bước sóng 625nm, VF 2.0V, IF 20mA', 'semiconductors', 15000, 'VND', true),
  ('prod-sw-spst', 'SW-SPST-TOGGLE', 'Công tắc gạt SPST Mini', 'Công tắc cơ học đơn cực 2 vị trí tiếp xúc mạ bạc', 'switches', 12000, 'VND', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_versions (id, product_id, version_tag, cad_model_url, footprint_data)
VALUES
  ('ver-dc-src-v1', 'prod-dc-src', '1.0.0', '/models/battery_9v.glb', '{"pinSpacing": 5.08, "package": "BOX"}'::jsonb),
  ('ver-res-330-v1', 'prod-res-330', '1.0.0', '/models/resistor_axial.glb', '{"pinSpacing": 7.62, "package": "AXIAL-0.3"}'::jsonb),
  ('ver-led-5mm-v1', 'prod-led-5mm', '1.0.0', '/models/led_5mm.glb', '{"pinSpacing": 2.54, "package": "RADIAL-5MM"}'::jsonb),
  ('ver-sw-spst-v1', 'prod-sw-spst', '1.0.0', '/models/switch_spst.glb', '{"pinSpacing": 2.54, "package": "DIP-2"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
