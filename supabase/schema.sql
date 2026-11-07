-- ==============================================================================
-- CAKEFLOW CLOUD DATABASE SCHEMA
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create Bakers Table
CREATE TABLE IF NOT EXISTS public.bakers (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT DEFAULT '100% Eggless & Fresh',
  phone TEXT NOT NULL,
  upi_id TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  google_maps_url TEXT,
  secret_token TEXT UNIQUE NOT NULL,
  default_token_amount INT DEFAULT 100,
  pin TEXT DEFAULT '1234',
  max_daily_cakes INT DEFAULT 4,
  menu_items JSONB DEFAULT '[]'::jsonb,
  addon_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration if table already exists
ALTER TABLE public.bakers ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '1234';
ALTER TABLE public.bakers ADD COLUMN IF NOT EXISTS max_daily_cakes INT DEFAULT 4;
ALTER TABLE public.bakers ADD COLUMN IF NOT EXISTS menu_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.bakers ADD COLUMN IF NOT EXISTS addon_items JSONB DEFAULT '[]'::jsonb;

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  baker_id TEXT REFERENCES public.bakers(id) ON DELETE CASCADE,
  flavour TEXT NOT NULL,
  weight TEXT NOT NULL,
  is_eggless BOOLEAN DEFAULT true,
  total_price INT NOT NULL,
  token_amount INT NOT NULL,
  balance_amount INT NOT NULL,
  delivery_date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  fulfilment_type TEXT DEFAULT 'pickup',
  delivery_address TEXT,
  cake_message TEXT,
  reference_image TEXT,
  reference_images JSONB DEFAULT '[]'::jsonb,
  addons JSONB DEFAULT '[]'::jsonb,
  special_notes TEXT,
  status TEXT DEFAULT 'pending_token',
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.bakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow public read & write operations with publishable anon key
CREATE POLICY "Allow public read bakers" ON public.bakers FOR SELECT USING (true);
CREATE POLICY "Allow public insert bakers" ON public.bakers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update bakers" ON public.bakers FOR UPDATE USING (true);

CREATE POLICY "Allow public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update orders" ON public.orders FOR UPDATE USING (true);

-- 4. Seed Initial Store Profile (SugarBloom Studio)
INSERT INTO public.bakers (
  id, slug, name, tagline, phone, upi_id, pickup_address, google_maps_url, secret_token, default_token_amount
) VALUES (
  'baker-1',
  'sugarbloom',
  'SugarBloom Cake Studio',
  '100% Eggless & Freshly Baked Artisan Cakes',
  '919876543210',
  'sugarbloom@okhdfcbank',
  'Shop 4, 12th Main Road, Indiranagar, Bengaluru, Karnataka 560038',
  'https://maps.google.com/?q=Indiranagar+Bangalore',
  'sugarbloom_pos_key',
  100
) ON CONFLICT (id) DO NOTHING;

