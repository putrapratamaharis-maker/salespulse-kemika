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
}

const SEGMENTS = ['B2B', 'B2G', 'B2C'];
const TYPES = ['Corporate', 'Government', 'SME', 'Individual', 'Distributor'];

export default function AccountManagement() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSegment, setFormSegment] = useState('B2B');
  const [formRegion, setFormRegion] = useState('');
  const [formType, setFormType] = useState('Corporate');

  const fetchAccounts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('sales_id', user.id)
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
    setFormSegment('B2B');
    setFormRegion('');
    setFormType('Corporate');
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setFormName(acc.name);
    setFormSegment(acc.segment);
    setFormRegion(acc.region);
    setFormType(acc.type);
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

    if (editingAccount) {
      const { error } = await supabase
        .from('accounts')
        .update({ name: formName.trim(), segment: formSegment, region: formRegion.trim(), type: formType })
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
        .insert({ name: formName.trim(), segment: formSegment, region: formRegion.trim(), type: formType, sales_id: user.id });
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

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.region.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase())
  );

  const segmentColor = (seg: string) => {
    if (seg === 'B2G') return 'bg-blue-500/10 text-blue-700 border-blue-200';
    if (seg === 'B2C') return 'bg-green-500/10 text-green-700 border-green-200';
    return 'bg-orange-500/10 text-orange-700 border-orange-200';
  };

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
                  <TableHead>Segment</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(acc => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={segmentColor(acc.segment)}>{acc.segment}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{acc.region || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.type}</TableCell>
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
              <Label>Nama Akun *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nama perusahaan / pelanggan" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Segment</Label>
                <Select value={formSegment} onValueChange={setFormSegment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipe</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Input value={formRegion} onChange={e => setFormRegion(e.target.value)} placeholder="Contoh: Jakarta, Surabaya" />
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
