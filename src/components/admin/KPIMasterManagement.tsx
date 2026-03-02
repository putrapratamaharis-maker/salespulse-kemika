import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';

const UNIT_TYPES = ['IDR', '%', 'Count', 'Binary', 'Score 0-100'] as const;
const CALC_TYPES = ['AUTO', 'MANUAL', 'HYBRID'] as const;
const DIRECTIONS = [
  { value: 'higher_is_better', label: 'Higher is Better' },
  { value: 'lower_is_better', label: 'Lower is Better' },
] as const;

interface KPIMaster {
  id: string;
  kpi_code: string;
  kpi_name: string;
  unit_type: string;
  calculation_type: string;
  direction: string;
  default_cap: number | null;
  threshold_green: number;
  threshold_yellow: number;
  threshold_red: number;
  definition_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  kpi_code: '',
  kpi_name: '',
  unit_type: 'Count',
  calculation_type: 'MANUAL',
  direction: 'higher_is_better',
  default_cap: '',
  threshold_green: '100',
  threshold_yellow: '80',
  threshold_red: '60',
  definition_notes: '',
};

export function KPIMasterManagement() {
  const { toast } = useToast();
  const [data, setData] = useState<KPIMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('kpi_master' as any)
      .select('*')
      .order('kpi_code');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setData((rows as any) || []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(kpi: KPIMaster) {
    setEditId(kpi.id);
    setForm({
      kpi_code: kpi.kpi_code,
      kpi_name: kpi.kpi_name,
      unit_type: kpi.unit_type,
      calculation_type: kpi.calculation_type,
      direction: kpi.direction,
      default_cap: kpi.default_cap?.toString() ?? '',
      threshold_green: kpi.threshold_green.toString(),
      threshold_yellow: kpi.threshold_yellow.toString(),
      threshold_red: kpi.threshold_red.toString(),
      definition_notes: kpi.definition_notes ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.kpi_code.trim() || !form.kpi_name.trim()) {
      toast({ title: 'Validasi', description: 'KPI Code dan KPI Name wajib diisi.', variant: 'destructive' });
      return;
    }

    // Check unique code
    const duplicate = data.find(k => k.kpi_code === form.kpi_code.trim() && k.id !== editId);
    if (duplicate) {
      toast({ title: 'Validasi', description: 'KPI Code sudah digunakan.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const payload = {
      kpi_code: form.kpi_code.trim(),
      kpi_name: form.kpi_name.trim(),
      unit_type: form.unit_type,
      calculation_type: form.calculation_type,
      direction: form.direction,
      default_cap: form.default_cap ? parseFloat(form.default_cap) : null,
      threshold_green: parseFloat(form.threshold_green) || 100,
      threshold_yellow: parseFloat(form.threshold_yellow) || 80,
      threshold_red: parseFloat(form.threshold_red) || 60,
      definition_notes: form.definition_notes || null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('kpi_master' as any).update(payload as any).eq('id', editId));
    } else {
      ({ error } = await supabase.from('kpi_master' as any).insert(payload as any));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editId ? 'KPI diperbarui!' : 'KPI berhasil ditambahkan!' });
      setDialogOpen(false);
      fetchData();
    }
    setSaving(false);
  }

  async function handleToggleActive(kpi: KPIMaster) {
    const { error } = await supabase
      .from('kpi_master' as any)
      .update({ is_active: !kpi.is_active } as any)
      .eq('id', kpi.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: kpi.is_active ? 'KPI dinonaktifkan' : 'KPI diaktifkan' });
      fetchData();
    }
  }

  const filtered = data.filter(k =>
    k.kpi_code.toLowerCase().includes(search.toLowerCase()) ||
    k.kpi_name.toLowerCase().includes(search.toLowerCase())
  );

  const dirLabel = (d: string) => d === 'higher_is_better' ? 'Higher is Better' : 'Lower is Better';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">KPI Master Management</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Tambah KPI
          </Button>
        </div>
        <div className="relative mt-2 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau nama KPI..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {search ? 'Tidak ada KPI yang cocok.' : 'Belum ada KPI. Klik "Tambah KPI" untuk memulai.'}
          </p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Kode KPI</TableHead>
                  <TableHead className="text-xs">Nama KPI</TableHead>
                  <TableHead className="text-xs">Unit</TableHead>
                  <TableHead className="text-xs">Kalkulasi</TableHead>
                  <TableHead className="text-xs">Arah</TableHead>
                  <TableHead className="text-xs">Cap (%)</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(kpi => (
                  <TableRow key={kpi.id} className={!kpi.is_active ? 'opacity-50' : ''}>
                    <TableCell className="text-sm font-mono font-medium">{kpi.kpi_code}</TableCell>
                    <TableCell className="text-sm">{kpi.kpi_name}</TableCell>
                    <TableCell className="text-sm">{kpi.unit_type}</TableCell>
                    <TableCell className="text-sm">{kpi.calculation_type}</TableCell>
                    <TableCell className="text-xs">{dirLabel(kpi.direction)}</TableCell>
                    <TableCell className="text-sm">{kpi.default_cap ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={kpi.is_active ? 'default' : 'secondary'}
                        className="text-[10px] cursor-pointer"
                        onClick={() => handleToggleActive(kpi)}
                      >
                        {kpi.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(kpi)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleToggleActive(kpi)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit KPI' : 'Tambah KPI Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kode KPI *</Label>
                <Input value={form.kpi_code} onChange={e => setForm(f => ({ ...f, kpi_code: e.target.value }))} placeholder="REV-001" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nama KPI *</Label>
                <Input value={form.kpi_name} onChange={e => setForm(f => ({ ...f, kpi_name: e.target.value }))} placeholder="Revenue Achievement" className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipe Unit</Label>
                <Select value={form.unit_type} onValueChange={v => setForm(f => ({ ...f, unit_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(u => <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kalkulasi</Label>
                <Select value={form.calculation_type} onValueChange={v => setForm(f => ({ ...f, calculation_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CALC_TYPES.map(c => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Arah</Label>
                <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value} className="text-sm">{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cap Default (%)</Label>
                <Input type="number" value={form.default_cap} onChange={e => setForm(f => ({ ...f, default_cap: e.target.value }))} placeholder="—" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Threshold 🟢</Label>
                <Input type="number" value={form.threshold_green} onChange={e => setForm(f => ({ ...f, threshold_green: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Threshold 🟡</Label>
                <Input type="number" value={form.threshold_yellow} onChange={e => setForm(f => ({ ...f, threshold_yellow: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Threshold 🔴</Label>
                <Input type="number" value={form.threshold_red} onChange={e => setForm(f => ({ ...f, threshold_red: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Catatan Definisi</Label>
              <Textarea value={form.definition_notes} onChange={e => setForm(f => ({ ...f, definition_notes: e.target.value }))} placeholder="Deskripsi dan cara perhitungan KPI..." rows={3} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editId ? 'Simpan Perubahan' : 'Tambah KPI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
