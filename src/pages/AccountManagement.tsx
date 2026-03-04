import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  segment: string;
  region: string;
  type: string;
  sales_id: string;
  created_at: string;
  pic_name: string;
  pic_contact: string;
  pic_email: string;
  status: string;
}

const TYPES = ['Corporate', 'Government', 'SME', 'Individual', 'Distributor', 'NGO', 'Others'];
const STATUSES = ['Active', 'Non-Active'];
const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
  'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Barat', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya',
];

export default function AccountManagement() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPicName, setFormPicName] = useState('');
  const [formPicContact, setFormPicContact] = useState('');
  const [formPicEmail, setFormPicEmail] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formType, setFormType] = useState('Corporate');
  const [formStatus, setFormStatus] = useState('Active');

  const allowedRoles = ['super_admin', 'admin', 'staff'];
  const hasAccess = userRole && allowedRoles.includes(userRole.system_role);

  const fetchAccounts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name');
    if (error) {
      toast({ title: 'Gagal memuat akun', description: error.message, variant: 'destructive' });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, [user]);

  const openCreate = () => {
    setEditingAccount(null);
    setFormName('');
    setFormPicName('');
    setFormPicContact('');
    setFormPicEmail('');
    setFormRegion('');
    setFormType('Corporate');
    setFormStatus('Active');
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setFormName(acc.name);
    setFormPicName(acc.pic_name || '');
    setFormPicContact(acc.pic_contact || '');
    setFormPicEmail(acc.pic_email || '');
    setFormRegion(acc.region);
    setFormType(acc.type);
    setFormStatus(acc.status || 'Active');
    setDialogOpen(true);
  };

  const openDelete = (acc: Account) => {
    setDeletingAccount(acc);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: 'Nama akun wajib diisi', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setSaving(true);

    const payload = {
      name: formName.trim(),
      pic_name: formPicName.trim(),
      pic_contact: formPicContact.trim(),
      pic_email: formPicEmail.trim(),
      region: formRegion,
      type: formType,
      status: formStatus,
    };

    if (editingAccount) {
      const { error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('id', editingAccount.id);
      if (error) {
        toast({ title: 'Gagal mengupdate', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Akun berhasil diupdate' });
        setDialogOpen(false);
        fetchAccounts();
      }
    } else {
      const { error } = await supabase
        .from('accounts')
        .insert({ ...payload, sales_id: user.id });
      if (error) {
        toast({ title: 'Gagal menambahkan', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Akun berhasil ditambahkan' });
        setDialogOpen(false);
        fetchAccounts();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    setSaving(true);
    const { error } = await supabase.from('accounts').delete().eq('id', deletingAccount.id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Akun berhasil dihapus' });
      setDeleteDialogOpen(false);
      fetchAccounts();
    }
    setSaving(false);
  };

  const usedRegions = [...new Set(accounts.map(a => a.region).filter(Boolean))].sort();
  const usedTypes = [...new Set(accounts.map(a => a.type).filter(Boolean))].sort();

  const filtered = accounts.filter(a => {
    const matchesSearch = search === '' ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.region.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()) ||
      (a.pic_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (a.status || 'Active') === filterStatus;
    const matchesRegion = filterRegion === 'all' || a.region === filterRegion;
    const matchesType = filterType === 'all' || a.type === filterType;
    return matchesSearch && matchesStatus && matchesRegion && matchesType;
  });

  const statusColor = (s: string) => {
    if (s === 'Active') return 'bg-green-500/10 text-green-700 border-green-200';
    return 'bg-red-500/10 text-red-700 border-red-200';
  };

  if (authLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">Memuat...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground">Halaman ini hanya dapat diakses oleh Super Admin, Admin, dan Staff.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manajemen Akun</h1>
          <p className="text-sm text-muted-foreground">Kelola daftar pelanggan & prospek Anda</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Tambah Akun
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Daftar Akun ({filtered.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari akun..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {usedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Region</SelectItem>
                {usedRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterStatus !== 'all' || filterRegion !== 'all' || filterType !== 'all') && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterStatus('all'); setFilterRegion('all'); setFilterType('all'); }}>
                Reset Filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {accounts.length === 0 ? 'Belum ada akun. Klik "Tambah Akun" untuk memulai.' : 'Tidak ada akun yang cocok dengan pencarian.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Akun</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(acc => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.pic_name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.region || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(acc.status || 'Active')}>{acc.status || 'Active'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDelete(acc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Akun Pelanggan/Customer *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nama perusahaan / instansi" />
            </div>
            <div className="space-y-1.5">
              <Label>Nama PIC</Label>
              <Input value={formPicName} onChange={e => setFormPicName(e.target.value)} placeholder="Nama Person in Charge" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nomor Contact</Label>
                <Input value={formPicContact} onChange={e => setFormPicContact(e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="email" value={formPicEmail} onChange={e => setFormPicEmail(e.target.value)} placeholder="email@contoh.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipe</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Region (Provinsi)</Label>
              <Select value={formRegion} onValueChange={setFormRegion}>
                <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Akun</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Yakin ingin menghapus akun <strong>{deletingAccount?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? 'Menghapus...' : 'Hapus'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
