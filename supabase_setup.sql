-- 1. Create the orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    order_code text UNIQUE NOT NULL,
    order_details jsonb, -- gunakan 'order_details' agar konsisten dengan front-end dan lebih deskriptif
    total_amount numeric NOT NULL,
    shipping_address jsonb,
    status text DEFAULT 'Menunggu Konfirmasi'::text NOT NULL,
    shipping_receipt text
);

-- 2. Enable Row Level Security (RLS) on the table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for users
-- Users can see their own orders
CREATE POLICY "Allow individual read access" ON public.orders
FOR SELECT USING (auth.uid() = user_id);

-- Users can create new orders
CREATE POLICY "Allow individual insert access" ON public.orders
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Create policies for an admin role
-- This assumes you have a custom 'claims' set up for an admin role.
-- A common way is to check a custom claim like 'claims_admin'.
-- For simplicity, this example assumes an admin can do anything.
-- NOTE: You MUST define how to identify an admin. A common way is a separate table of admin user_ids.

-- Let's create a table to hold admin user IDs for a more secure approach
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);

-- Function to check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Admin policy: Admins can see and update all orders
CREATE POLICY "Allow admin full access" ON public.orders
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 5. Set up Supabase Realtime for the 'orders' table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
