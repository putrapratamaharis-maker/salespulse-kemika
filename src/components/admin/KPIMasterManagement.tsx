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
const KPI_CATEGORIES = ['GROWTH', 'PROFITABILITY', 'COMPLIANCE', 'PRODUCTIVITY', 'DISCIPLINE'] as const;

const CATEGORY_DEFAULTS: Record<string, { score_cap_pct: string; green_threshold_pct: string; yellow_threshold_pct: string }> = {
  GROWTH: { score_cap_pct: '120', green_threshold_pct: '100', yellow_threshold_pct: '90' },
  PROFITABILITY: { score_cap_pct: '110', green_threshold_pct: '100', yellow_threshold_pct: '90' },
  COMPLIANCE: { score_cap_pct: '100', green_threshold_pct: '100', yellow_threshold_pct: '90' },
  PRODUCTIVITY: { score_cap_pct: '120', green_threshold_pct: '100', yellow_threshold_pct: '90' },
  DISCIPLINE: { score_cap_pct: '100', green_threshold_pct: '100', yellow_threshold_pct: '90' },
};

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
  kpi_category: string | null;
  score_cap_pct: number;
  green_threshold_pct: number;
  yellow_threshold_pct: number;
  red_threshold_pct: number;
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
  kpi_category: '',
  score_cap_pct: '100',
  green_threshold_pct: '100',
  yellow_threshold_pct: '90',
};

export function KPIMasterManagement() {
  const { toast } = useToast();
  const [data, setData] = useState<KPIMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
      kpi_category: kpi.kpi_category ?? '',
      score_cap_pct: kpi.score_cap_pct.toString(),
      green_threshold_pct: kpi.green_threshold_pct.toString(),
      yellow_threshold_pct: kpi.yellow_threshold_pct.toString(),
    });
    setDialogOpen(true);
  }

  function handleCategoryChange(category: string) {
    const defaults = CATEGORY_DEFAULTS[category];
    if (defaults && !editId) {
      setForm(f => ({ ...f, kpi_category: category, ...defaults }));
    } else {
      setForm(f => ({ ...f, kpi_category: category }));
    }
  }

  async function handleSave() {
    if (!form.kpi_code.trim() || !form.kpi_name.trim()) {
      toast({ title: 'Validasi', description: 'KPI Code dan KPI Name wajib diisi.', variant: 'destructive' });
      return;
    }

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
      kpi_category: form.kpi_category || null,
      score_cap_pct: parseFloat(form.score_cap_pct) || 100,
      green_threshold_pct: parseFloat(form.green_threshold_pct) || 100,
      yellow_threshold_pct: parseFloat(form.yellow_threshold_pct) || 90,
      red_threshold_pct: 0,
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

  const filtered = data.filter(k => {
    const matchesSearch = k.kpi_code.toLowerCase().includes(search.toLowerCase()) ||
      k.kpi_name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || k.kpi_category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

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
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kode atau nama KPI..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-sm">Semua Kategori</SelectItem>
              {KPI_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
            </SelectContent>
          </Select>
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
                  <TableHead className="text-xs">Kode</TableHead>
                  <TableHead className="text-xs">Nama KPI</TableHead>
                  <TableHead className="text-xs">Kategori</TableHead>
                  <TableHead className="text-xs">Unit</TableHead>
                  <TableHead className="text-xs">Cap (%)</TableHead>
                  <TableHead className="text-xs">🟢 / 🟡</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(kpi => (
                  <TableRow key={kpi.id} className={!kpi.is_active ? 'opacity-50' : ''}>
                    <TableCell className="text-sm font-mono font-medium">{kpi.kpi_code}</TableCell>
                    <TableCell className="text-sm">{kpi.kpi_name}</TableCell>
                    <TableCell className="text-xs">
                      {kpi.kpi_category ? (
                        <Badge variant="outline" className="text-[10px]">{kpi.kpi_category}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">{kpi.unit_type}</TableCell>
                    <TableCell className="text-sm">{kpi.score_cap_pct}%</TableCell>
                    <TableCell className="text-xs">{kpi.green_threshold_pct}% / {kpi.yellow_threshold_pct}%</TableCell>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <Label className="text-xs">Kategori</Label>
                <Select value={form.kpi_category} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    {KPI_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Arah</Label>
                <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(d => <SelectItem key={d.value} value={d.value} className="text-sm">{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Score Cap (%)</Label>
                <Input type="number" value={form.score_cap_pct} onChange={e => setForm(f => ({ ...f, score_cap_pct: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Green Threshold (%) 🟢</Label>
                <Input type="number" value={form.green_threshold_pct} onChange={e => setForm(f => ({ ...f, green_threshold_pct: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yellow Threshold (%) 🟡</Label>
                <Input type="number" value={form.yellow_threshold_pct} onChange={e => setForm(f => ({ ...f, yellow_threshold_pct: e.target.value }))} className="h-9 text-sm" />
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
