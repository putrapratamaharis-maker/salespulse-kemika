
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);
CREATE INDEX idx_audit_logs_changed_by ON public.audit_logs(changed_by);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read audit logs
CREATE POLICY "Super admins can read audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (get_user_system_role(auth.uid()) = 'super_admin'::system_role);

-- System (triggers) can insert via security definer function
CREATE POLICY "System can insert audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create the audit trigger function
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changed_fields text[];
  _old jsonb;
  _new jsonb;
  _record_id text;
  _key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD);
    _record_id := OLD.id::text;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, _record_id, 'DELETE', _old, auth.uid(), now());
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW);
    _record_id := NEW.id::text;
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by, changed_at)
    VALUES (TG_TABLE_NAME, _record_id, 'INSERT', _new, auth.uid(), now());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _record_id := NEW.id::text;
    _changed_fields := ARRAY[]::text[];
    FOR _key IN SELECT jsonb_object_keys(_new)
    LOOP
      IF _old->_key IS DISTINCT FROM _new->_key THEN
        _changed_fields := _changed_fields || _key;
      END IF;
    END LOOP;
    -- Only log if something actually changed (ignore updated_at only changes)
    IF array_length(_changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, changed_by, changed_at)
      VALUES (TG_TABLE_NAME, _record_id, 'UPDATE', _old, _new, _changed_fields, auth.uid(), now());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers to master data tables
CREATE TRIGGER audit_accounts AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_product_categories AFTER INSERT OR UPDATE OR DELETE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_units AFTER INSERT OR UPDATE OR DELETE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
