import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Constants } from '@/integrations/supabase/types';

const orgRoleLabels: Record<string, string> = {
  sales_manager: 'Sales Manager',
  supervisor: 'Supervisor',
  sales_person: 'Sales Person',
  representative_management: 'Rep. Management',
};

const systemRoleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  viewer: 'Viewer',
};

type OrgRole = typeof Constants.public.Enums.org_role[number];
type SystemRole = typeof Constants.public.Enums.system_role[number];

interface UserWithRole {
  user_id: string;
  full_name: string;
  email: string;
  division: string | null;
  region: string | null;
  org_role: OrgRole | null;
  system_role: SystemRole | null;
  has_role: boolean;
}

const DIVISIONS = ['BOD', 'HR-GA', 'Sales & Marketing', 'FAT', 'WH', 'Lainnya'];

export default function UserManagement() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const isSuperAdmin = userRole?.system_role === 'super_admin';

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, division, region');

    if (pErr) {
      toast({ title: 'Error', description: pErr.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase.from('user_roles').select('user_id, org_role, system_role');
    const roleMap = new Map((roles || []).map(r => [r.user_id, r]));

    const merged: UserWithRole[] = (profiles || []).map(p => {
      const role = roleMap.get(p.user_id);
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        division: p.division,
        region: p.region,
        org_role: role?.org_role ?? null,
        system_role: role?.system_role ?? null,
        has_role: !!role,
      };
    });

    setUsers(merged);
    setLoading(false);
  }

  async function handleRoleChange(
    userId: string,
    field: 'org_role' | 'system_role',
    value: string,
    hasRole: boolean,
  ) {
    setSaving(userId + field);
    if (!hasRole) {
      const insertData: Record<string, string> = { user_id: userId, [field]: value };
      const { error } = await supabase.from('user_roles').insert(insertData as any);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(null);
        return;
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .update({ [field]: value } as any)
        .eq('user_id', userId);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(null);
        return;
      }
    }
    toast({ title: 'Role diperbarui!' });
    setSaving(null);
    fetchUsers();
  }

  if (!userRole || !['super_admin', 'admin'].includes(userRole.system_role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">User Management</h2>
        <p className="text-sm text-muted-foreground">Kelola user, role, dan divisi</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            Users & RBAC
            {!isSuperAdmin && (
              <Badge variant="outline" className="text-[10px] ml-2">Read Only</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada user terdaftar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Org Role</TableHead>
                  <TableHead className="text-xs">System Role</TableHead>
                  <TableHead className="text-xs">Divisi</TableHead>
                  <TableHead className="text-xs">Region</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell className="text-sm font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select
                          value={u.org_role ?? ''}
                          onValueChange={(v) => handleRoleChange(u.user_id, 'org_role', v, u.has_role)}
                          disabled={saving === u.user_id + 'org_role'}
                        >
                          <SelectTrigger className="h-7 text-xs w-40">
                            <SelectValue placeholder="Pilih role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Constants.public.Enums.org_role.map(r => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {orgRoleLabels[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {u.org_role ? orgRoleLabels[u.org_role] : 'Belum diassign'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select
                          value={u.system_role ?? ''}
                          onValueChange={(v) => handleRoleChange(u.user_id, 'system_role', v, u.has_role)}
                          disabled={saving === u.user_id + 'system_role'}
                        >
                          <SelectTrigger className="h-7 text-xs w-32">
                            <SelectValue placeholder="Pilih role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Constants.public.Enums.system_role.map(r => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {systemRoleLabels[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {u.system_role ? systemRoleLabels[u.system_role] : 'Belum diassign'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select
                          value={u.division ?? ''}
                          onValueChange={async (v) => {
                            setSaving(u.user_id + 'division');
                            const { error } = await supabase
                              .from('profiles')
                              .update({ division: v } as any)
                              .eq('user_id', u.user_id);
                            if (error) {
                              toast({ title: 'Error', description: error.message, variant: 'destructive' });
                            } else {
                              toast({ title: 'Divisi diperbarui!' });
                              fetchUsers();
                            }
                            setSaving(null);
                          }}
                          disabled={saving === u.user_id + 'division'}
                        >
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue placeholder="Pilih divisi..." />
                          </SelectTrigger>
                          <SelectContent>
                            {DIVISIONS.map(d => (
                              <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">{u.division || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{u.region || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
