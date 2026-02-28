
-- Create enum for org roles
CREATE TYPE public.org_role AS ENUM ('sales_manager', 'supervisor', 'sales_person', 'representative_management');

-- Create enum for system roles  
CREATE TYPE public.system_role AS ENUM ('super_admin', 'admin', 'staff', 'viewer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  segment TEXT DEFAULT 'B2B',
  region TEXT DEFAULT '',
  supervisor_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_role org_role NOT NULL DEFAULT 'sales_person',
  system_role system_role NOT NULL DEFAULT 'viewer',
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check system role
CREATE OR REPLACE FUNCTION public.has_system_role(_user_id UUID, _role system_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND system_role = _role
  )
$$;

-- Security definer function to get user system role
CREATE OR REPLACE FUNCTION public.get_user_system_role(_user_id UUID)
RETURNS system_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT system_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Security definer function to get user org role
CREATE OR REPLACE FUNCTION public.get_user_org_role(_user_id UUID)
RETURNS org_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles RLS policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id 
    OR public.get_user_system_role(auth.uid()) IN ('super_admin', 'admin')
  );

CREATE POLICY "Only super_admin can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (
    public.has_system_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Only super_admin can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (
    public.has_system_role(auth.uid(), 'super_admin')
  );

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
