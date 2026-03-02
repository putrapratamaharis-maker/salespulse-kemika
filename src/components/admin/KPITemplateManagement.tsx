import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Copy, Loader2, Search, Trash2, ArrowLeft, Scale } from 'lucide-react';

// Types
interface Position {
  id: string;
  position_code: string;
  position_name: string;
  is_active: boolean;
}

interface KPIMaster {
  id: string;
  kpi_code: string;
  kpi_name: string;
  unit_type: string;
  is_active: boolean;
}

interface TemplateItem {
  id?: string;
  kpi_id: string;
  kpi_code: string;
  kpi_name: string;
  unit_type: string;
  weight_pct: number;
  baseline_annual_target_value: number | null;
  baseline_annual_target_pct: number | null;
  notes: string;
}

interface Template {
  id: string;
  template_name: string;
  position_id: string;
  year: number;
  is_active: boolean;
  created_at: string;
  positions?: Position;
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

export function KPITemplateManagement() {
  const { toast } = useToast();

  // Data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [kpiMasters, setKpiMasters] = useState<KPIMaster[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Editor state
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPositionId, setFormPositionId] = useState('');
  const [formYear, setFormYear] = useState(currentYear);
  const [formActive, setFormActive] = useState(true);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Duplicate dialog
  const [dupDialog, setDupDialog] = useState(false);
  const [dupTemplateId, setDupTemplateId] = useState<string | null>(null);
  const [dupYear, setDupYear] = useState(currentYear + 1);
  const [dupPositionId, setDupPositionId] = useState('');
  const [dupName, setDupName] = useState('');

  // Position management dialog
  const [posDialog, setPosDialog] = useState(false);
  const [posCode, setPosCode] = useState('');
  const [posName, setPosName] = useState('');
  const [posSaving, setPosSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [tRes, pRes, kRes] = await Promise.all([
      supabase.from('kpi_templates' as any).select('*, positions(*)').order('year', { ascending: false }),
      supabase.from('positions' as any).select('*').order('position_name'),
      supabase.from('kpi_master' as any).select('id, kpi_code, kpi_name, unit_type, is_active').eq('is_active', true).order('kpi_code'),
    ]);
    setTemplates((tRes.data as any) || []);
    setPositions((pRes.data as any) || []);
    setKpiMasters((kRes.data as any) || []);
    setLoading(false);
  }

  // Filtered templates
  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (filterYear !== 'all' && t.year !== parseInt(filterYear)) return false;
      if (filterPosition !== 'all' && t.position_id !== filterPosition) return false;
      if (search && !t.template_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [templates, filterYear, filterPosition, search]);

  function getPositionName(posId: string) {
    return positions.find(p => p.id === posId)?.position_name ?? '—';
  }

  function totalWeight() {
    return items.reduce((sum, i) => sum + (i.weight_pct || 0), 0);
  }

  // Open editor
  function openCreate() {
    setEditId(null);
    setFormName('');
    setFormPositionId('');
    setFormYear(currentYear);
    setFormActive(true);
    setItems([]);
    setView('editor');
  }

  async function openEdit(template: Template) {
    setEditId(template.id);
    setFormName(template.template_name);
    setFormPositionId(template.position_id);
    setFormYear(template.year);
    setFormActive(template.is_active);

    // Fetch items
    const { data: rows } = await supabase
      .from('kpi_template_items' as any)
      .select('*, kpi_master(*)')
      .eq('template_id', template.id);

    const loadedItems: TemplateItem[] = ((rows as any) || []).map((r: any) => ({
      id: r.id,
      kpi_id: r.kpi_id,
      kpi_code: r.kpi_master?.kpi_code ?? '',
      kpi_name: r.kpi_master?.kpi_name ?? '',
      unit_type: r.kpi_master?.unit_type ?? '',
      weight_pct: Number(r.weight_pct),
      baseline_annual_target_value: r.baseline_annual_target_value != null ? Number(r.baseline_annual_target_value) : null,
      baseline_annual_target_pct: r.baseline_annual_target_pct != null ? Number(r.baseline_annual_target_pct) : null,
      notes: r.notes ?? '',
    }));
    setItems(loadedItems);
    setView('editor');
  }

  // Add KPI item
  function addKpiItem(kpiId: string) {
    if (items.find(i => i.kpi_id === kpiId)) {
      toast({ title: 'KPI sudah ada dalam template ini.', variant: 'destructive' });
      return;
    }
    const kpi = kpiMasters.find(k => k.id === kpiId);
    if (!kpi) return;
    setItems(prev => [...prev, {
      kpi_id: kpi.id,
      kpi_code: kpi.kpi_code,
      kpi_name: kpi.kpi_name,
      unit_type: kpi.unit_type,
      weight_pct: 0,
      baseline_annual_target_value: null,
      baseline_annual_target_pct: null,
      notes: '',
    }]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof TemplateItem, value: any) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function normalizeWeights() {
    if (items.length === 0) return;
    const equal = parseFloat((100 / items.length).toFixed(2));
    const remainder = parseFloat((100 - equal * items.length).toFixed(2));
    setItems(prev => prev.map((item, i) => ({
      ...item,
      weight_pct: i === 0 ? equal + remainder : equal,
    })));
  }

  // Save
  async function handleSave() {
    if (!formName.trim()) {
      toast({ title: 'Nama template wajib diisi.', variant: 'destructive' });
      return;
    }
    if (!formPositionId) {
      toast({ title: 'Posisi/Jabatan wajib dipilih.', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Tambahkan minimal 1 KPI item.', variant: 'destructive' });
      return;
    }
    const tw = totalWeight();
    if (Math.abs(tw - 100) > 0.01) {
      toast({ title: `Total bobot harus 100%. Saat ini: ${tw.toFixed(2)}%`, variant: 'destructive' });
      return;
    }

    // Check one active per position+year
    if (formActive) {
      const conflict = templates.find(t =>
        t.position_id === formPositionId &&
        t.year === formYear &&
        t.is_active &&
        t.id !== editId
      );
      if (conflict) {
        toast({
          title: 'Konflik Template',
          description: `Sudah ada template aktif untuk posisi & tahun ini: "${conflict.template_name}". Nonaktifkan terlebih dahulu.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    const templatePayload = {
      template_name: formName.trim(),
      position_id: formPositionId,
      year: formYear,
      is_active: formActive,
    };

    let templateId = editId;
    if (editId) {
      const { error } = await supabase.from('kpi_templates' as any).update(templatePayload as any).eq('id', editId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      // Delete old items
      await supabase.from('kpi_template_items' as any).delete().eq('template_id', editId);
    } else {
      const { data, error } = await supabase.from('kpi_templates' as any).insert(templatePayload as any).select('id').single();
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      templateId = (data as any).id;
    }

    // Insert items
    const itemPayloads = items.map(item => ({
      template_id: templateId,
      kpi_id: item.kpi_id,
      weight_pct: item.weight_pct,
      baseline_annual_target_value: item.baseline_annual_target_value,
      baseline_annual_target_pct: item.baseline_annual_target_pct,
      notes: item.notes || null,
    }));

    const { error: iErr } = await supabase.from('kpi_template_items' as any).insert(itemPayloads as any);
    if (iErr) { toast({ title: 'Error', description: iErr.message, variant: 'destructive' }); setSaving(false); return; }

    toast({ title: editId ? 'Template diperbarui!' : 'Template berhasil dibuat!' });
    setSaving(false);
    setView('list');
    fetchAll();
  }

  // Duplicate
  function openDuplicate(template: Template) {
    setDupTemplateId(template.id);
    setDupName(template.template_name + ' (Copy)');
    setDupYear(template.year + 1);
    setDupPositionId(template.position_id);
    setDupDialog(true);
  }

  async function handleDuplicate() {
    if (!dupTemplateId || !dupName.trim() || !dupPositionId) return;
    setSaving(true);

    // Fetch source items
    const { data: srcItems } = await supabase
      .from('kpi_template_items' as any)
      .select('*')
      .eq('template_id', dupTemplateId);

    // Create new template
    const { data: newT, error: tErr } = await supabase
      .from('kpi_templates' as any)
      .insert({ template_name: dupName.trim(), position_id: dupPositionId, year: dupYear, is_active: false } as any)
      .select('id')
      .single();

    if (tErr) { toast({ title: 'Error', description: tErr.message, variant: 'destructive' }); setSaving(false); return; }

    if (srcItems && (srcItems as any[]).length > 0) {
      const newItems = (srcItems as any[]).map(i => ({
        template_id: (newT as any).id,
        kpi_id: i.kpi_id,
        weight_pct: i.weight_pct,
        baseline_annual_target_value: i.baseline_annual_target_value,
        baseline_annual_target_pct: i.baseline_annual_target_pct,
        notes: i.notes,
      }));
      await supabase.from('kpi_template_items' as any).insert(newItems as any);
    }

    toast({ title: 'Template berhasil diduplikasi!' });
    setSaving(false);
    setDupDialog(false);
    fetchAll();
  }

  // Toggle active
  async function handleToggleActive(template: Template) {
    if (!template.is_active) {
      // Check conflict
      const conflict = templates.find(t =>
        t.position_id === template.position_id &&
        t.year === template.year &&
        t.is_active &&
        t.id !== template.id
      );
      if (conflict) {
        toast({
          title: 'Konflik',
          description: `Sudah ada template aktif: "${conflict.template_name}". Nonaktifkan terlebih dahulu.`,
          variant: 'destructive',
        });
        return;
      }
    }
    await supabase.from('kpi_templates' as any).update({ is_active: !template.is_active } as any).eq('id', template.id);
    toast({ title: template.is_active ? 'Template dinonaktifkan' : 'Template diaktifkan' });
    fetchAll();
  }

  // Add position
  async function handleAddPosition() {
    if (!posCode.trim() || !posName.trim()) {
      toast({ title: 'Kode dan nama posisi wajib diisi.', variant: 'destructive' });
      return;
    }
    setPosSaving(true);
    const { error } = await supabase.from('positions' as any).insert({ position_code: posCode.trim(), position_name: posName.trim() } as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Posisi berhasil ditambahkan!' });
      setPosCode('');
      setPosName('');
      setPosDialog(false);
      fetchAll();
    }
    setPosSaving(false);
  }

  // Available KPIs (not yet added)
  const availableKpis = kpiMasters.filter(k => !items.find(i => i.kpi_id === k.id));

  // ==================== RENDER ====================

  if (view === 'editor') {
    const tw = totalWeight();
    const isValid = Math.abs(tw - 100) <= 0.01;
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView('list')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-sm font-semibold">
              {editId ? 'Edit Template KPI' : 'Buat Template KPI Baru'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama Template *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="KPI Sales Person 2026" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Posisi/Jabatan *</Label>
              <div className="flex gap-1">
                <Select value={formPositionId} onValueChange={setFormPositionId}>
                  <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Pilih posisi..." /></SelectTrigger>
                  <SelectContent>
                    {positions.filter(p => p.is_active).map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-sm">{p.position_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setPosDialog(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tahun *</Label>
              <Select value={formYear.toString()} onValueChange={v => setFormYear(parseInt(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => <SelectItem key={y} value={y.toString()} className="text-sm">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status Aktif</Label>
              <div className="flex items-center gap-2 h-9">
                <Switch checked={formActive} onCheckedChange={setFormActive} />
                <span className="text-sm text-muted-foreground">{formActive ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
          </div>

          {/* KPI Item Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">KPI Items</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={normalizeWeights} disabled={items.length === 0}>
                  <Scale className="h-3.5 w-3.5 mr-1" /> Normalisasi Bobot
                </Button>
                <Select onValueChange={addKpiItem}>
                  <SelectTrigger className="h-8 text-xs w-52">
                    <SelectValue placeholder="+ Tambah KPI..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableKpis.length === 0 ? (
                      <SelectItem value="_none" disabled className="text-xs text-muted-foreground">Semua KPI sudah ditambahkan</SelectItem>
                    ) : (
                      availableKpis.map(k => (
                        <SelectItem key={k.id} value={k.id} className="text-xs">{k.kpi_code} — {k.kpi_name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada KPI. Gunakan dropdown di atas untuk menambahkan.</p>
            ) : (
              <div className="overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-24">Kode</TableHead>
                      <TableHead className="text-xs">Nama KPI</TableHead>
                      <TableHead className="text-xs w-20">Unit</TableHead>
                      <TableHead className="text-xs w-24">Bobot %</TableHead>
                      <TableHead className="text-xs w-36">Target Tahunan</TableHead>
                      <TableHead className="text-xs w-48">Catatan</TableHead>
                      <TableHead className="text-xs w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-mono">{item.kpi_code}</TableCell>
                        <TableCell className="text-sm">{item.kpi_name}</TableCell>
                        <TableCell className="text-xs">{item.unit_type}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={item.weight_pct}
                            onChange={e => updateItem(idx, 'weight_pct', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm w-20"
                          />
                        </TableCell>
                        <TableCell>
                          {item.unit_type === '%' || item.unit_type === 'Score 0-100' ? (
                            <Input
                              type="number"
                              value={item.baseline_annual_target_pct ?? ''}
                              onChange={e => updateItem(idx, 'baseline_annual_target_pct', e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="Target %"
                              className="h-8 text-sm w-28"
                            />
                          ) : (
                            <Input
                              type="number"
                              value={item.baseline_annual_target_value ?? ''}
                              onChange={e => updateItem(idx, 'baseline_annual_target_value', e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder={item.unit_type === 'IDR' ? 'Rp ...' : 'Target'}
                              className="h-8 text-sm w-28"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.notes}
                            onChange={e => updateItem(idx, 'notes', e.target.value)}
                            placeholder="Opsional"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className={`flex items-center justify-between p-3 rounded-md border ${isValid ? 'bg-accent/20 border-accent' : 'bg-destructive/10 border-destructive'}`}>
            <span className={`text-sm font-semibold ${isValid ? 'text-accent-foreground' : 'text-destructive'}`}>
              Total Bobot: {tw.toFixed(2)}%
              {!isValid && ' (harus 100%)'}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView('list')}>Batal</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editId ? 'Simpan Perubahan' : 'Buat Template'}
              </Button>
            </div>
          </div>
        </CardContent>

        {/* Add Position Dialog */}
        <Dialog open={posDialog} onOpenChange={setPosDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Tambah Posisi Baru</DialogTitle>
              <DialogDescription>Masukkan kode dan nama posisi/jabatan.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Kode Posisi *</Label>
                <Input value={posCode} onChange={e => setPosCode(e.target.value)} placeholder="SP" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Posisi *</Label>
                <Input value={posName} onChange={e => setPosName(e.target.value)} placeholder="Sales Person" className="h-9 text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPosDialog(false)}>Batal</Button>
              <Button onClick={handleAddPosition} disabled={posSaving}>
                {posSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Tambah
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  // ==================== LIST VIEW ====================
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">KPI Templates</CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Buat Template
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari template..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm w-48"
            />
          </div>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="h-9 text-sm w-28"><SelectValue placeholder="Tahun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Semua Tahun</SelectItem>
              {yearOptions.map(y => <SelectItem key={y} value={y.toString()} className="text-sm">{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPosition} onValueChange={setFilterPosition}>
            <SelectTrigger className="h-9 text-sm w-40"><SelectValue placeholder="Posisi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Semua Posisi</SelectItem>
              {positions.map(p => <SelectItem key={p.id} value={p.id} className="text-sm">{p.position_name}</SelectItem>)}
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
            {search || filterYear !== 'all' || filterPosition !== 'all' ? 'Tidak ada template yang cocok.' : 'Belum ada template. Klik "Buat Template" untuk memulai.'}
          </p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nama Template</TableHead>
                  <TableHead className="text-xs">Posisi</TableHead>
                  <TableHead className="text-xs">Tahun</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} className={!t.is_active ? 'opacity-50' : ''}>
                    <TableCell className="text-sm font-medium">{t.template_name}</TableCell>
                    <TableCell className="text-sm">{(t as any).positions?.position_name ?? getPositionName(t.position_id)}</TableCell>
                    <TableCell className="text-sm">{t.year}</TableCell>
                    <TableCell>
                      <Badge
                        variant={t.is_active ? 'default' : 'secondary'}
                        className="text-[10px] cursor-pointer"
                        onClick={() => handleToggleActive(t)}
                      >
                        {t.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDuplicate(t)} title="Duplikat">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Duplicate Dialog */}
      <Dialog open={dupDialog} onOpenChange={setDupDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Duplikat Template</DialogTitle>
            <DialogDescription>Salin template ke tahun atau posisi lain.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama Template Baru</Label>
              <Input value={dupName} onChange={e => setDupName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tahun</Label>
              <Select value={dupYear.toString()} onValueChange={v => setDupYear(parseInt(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => <SelectItem key={y} value={y.toString()} className="text-sm">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Posisi</Label>
              <Select value={dupPositionId} onValueChange={setDupPositionId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih posisi..." /></SelectTrigger>
                <SelectContent>
                  {positions.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">{p.position_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupDialog(false)}>Batal</Button>
            <Button onClick={handleDuplicate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Duplikat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
