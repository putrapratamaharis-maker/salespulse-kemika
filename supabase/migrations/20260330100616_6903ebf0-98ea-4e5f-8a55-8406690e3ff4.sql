
-- Migrate sales_manager -> manager and sales_person -> staff_operational in user_roles
UPDATE public.user_roles SET org_role = 'manager' WHERE org_role = 'sales_manager';
UPDATE public.user_roles SET org_role = 'staff_operational' WHERE org_role = 'sales_person';
