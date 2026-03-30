import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Shield, Loader2, MoreVertical, Pencil, KeyRound, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const ORG_ROLES = [
  { value: 'ceo_director', label: 'CEO / Director' },
  { value: 'commissioner', label: 'Commissioner' },
  { value: 'representative_management', label: 'Rep. Management' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'staff_operational', label: 'Staff & Operational' },
  // Legacy values kept for backward compat display
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'sales_person', label: 'Sales Person' },
];

const SYSTEM_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'User / Staff / Operator' },
  { value: 'viewer', label: 'Viewer' },
];

const DIVISIONS = ['BOD', 'HR-GA', 'Sales & Marketing', 'FAT', 'WH', 'Lainnya'];

const orgLabel = (v: string | null) => ORG_ROLES.find(r => r.value === v)?.label ?? v ?? '—';
const sysLabel = (v: string | null) => SYSTEM_ROLES.find(r => r.value === v)?.label ?? v ?? '—';

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  division: string | null;
  org_role: string | null;
  system_role: string | null;
  is_active: boolean;
  created_at: string;
  has_role: boolean;
}

export default function UserManagement() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editDivision, setEditDivision] = useState('');
  const [editOrgRole, setEditOrgRole] = useState('');
  const [editSystemRole, setEditSystemRole] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const isSuperAdmin = userRole?.system_role === 'super_admin';

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, division, is_active, created_at');

    if (pErr) {
      toast({ title: 'Error', description: pErr.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase.from('user_roles').select('user_id, org_role, system_role');
    const roleMap = new Map((roles || []).map(r => [r.user_id, r]));

    const merged: UserRow[] = (profiles || []).map(p => {
      const role = roleMap.get(p.user_id);
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        division: p.division,
        org_role: role?.org_role ?? null,
        system_role: role?.system_role ?? null,
        is_active: (p as any).is_active ?? true,
        created_at: p.created_at,
        has_role: !!role,
      };
    });

    setUsers(merged);
    setLoading(false);
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEditDivision(u.division || '');
    setEditOrgRole(u.org_role || '');
    setEditSystemRole(u.system_role || '');
    setEditIsActive(u.is_active);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editUser) return;
    setSaving(true);

    // Update profile (division, is_active)
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ division: editDivision || null, is_active: editIsActive } as any)
      .eq('user_id', editUser.user_id);

    if (profileErr) {
      toast({ title: 'Error', description: profileErr.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Update or insert role
    if (editOrgRole || editSystemRole) {
      const roleData: Record<string, string> = {};
      if (editOrgRole) roleData.org_role = editOrgRole;
      if (editSystemRole) roleData.system_role = editSystemRole;

      if (!editUser.has_role) {
        const { error } = await supabase.from('user_roles').insert({ user_id: editUser.user_id, ...roleData } as any);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from('user_roles')
          .update(roleData as any)
          .eq('user_id', editUser.user_id);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }
      }
    }

    toast({ title: 'User diperbarui!' });
    setSaving(false);
    setEditOpen(false);
    fetchUsers();
  }

  async function handleResetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Link reset password terkirim', description: `Email dikirim ke ${email}` });
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Yakin ingin menghapus user ini? Aksi ini tidak dapat dibatalkan.')) return;
    // Delete role first, then profile
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'User dihapus' });
      fetchUsers();
    }
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
        <p className="text-sm text-muted-foreground">Kelola user, role, divisi, dan status akses</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Users & RBAC
            <Badge variant="secondary" className="text-[10px] ml-2">{users.length} users</Badge>
            {!isSuperAdmin && (
              <Badge variant="outline" className="text-[10px] ml-1">Read Only</Badge>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Division</TableHead>
                    <TableHead className="text-xs">Org Role</TableHead>
                    <TableHead className="text-xs">System Role</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Created</TableHead>
                    {isSuperAdmin && <TableHead className="text-xs text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.user_id}>
                      <TableCell className="text-sm font-medium">{u.full_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.division || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {orgLabel(u.org_role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sysLabel(u.system_role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={u.is_active
                            ? 'border-green-500 text-green-600 bg-green-50 text-xs'
                            : 'border-muted text-muted-foreground text-xs'}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(u.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(u.email)}>
                                <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(u.user_id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={editUser.full_name} disabled className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={editUser.email} disabled className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Division</Label>
                <Select value={editDivision} onValueChange={setEditDivision}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Pilih divisi..." /></SelectTrigger>
                  <SelectContent>
                    {DIVISIONS.map(d => (
                      <SelectItem key={d} value={d} className="text-sm">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Org Role</Label>
                <Select value={editOrgRole} onValueChange={setEditOrgRole}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Pilih org role..." /></SelectTrigger>
                  <SelectContent>
                    {ORG_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-sm">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">System Role</Label>
                <Select value={editSystemRole} onValueChange={setEditSystemRole}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Pilih system role..." /></SelectTrigger>
                  <SelectContent>
                    {SYSTEM_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value} className="text-sm">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={editIsActive ? 'active' : 'inactive'} onValueChange={v => setEditIsActive(v === 'active')}>
                  <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-sm">Active</SelectItem>
                    <SelectItem value="inactive" className="text-sm">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Batal</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                  {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
