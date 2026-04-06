import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Calculator, Upload, Download, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// ─── Types ───────────────────────────────────────────────────
interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

interface Position {
  id: string;
  position_code: string;
  position_name: string;
}

interface KPIMaster {
  id: string;
  kpi_code: string;
  kpi_name: string;
  unit_type: string;
}

interface TemplateItem {
  kpi_id: string;
  kpi_code: string;
  kpi_name: string;
  unit_type: string;
  weight_pct: number;
  baseline_annual_target_value: number | null;
  baseline_annual_target_pct: number | null;
}

interface TargetRow extends TemplateItem {
  target_value: number | null;
  target_pct: number | null;
  prev_target_value: number | null;
  prev_target_pct: number | null;
  notes: string;
  dirty: boolean;
  existing_id: string | null;
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);
const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatIDRFull(val: number | null): string {
  if (val == null) return '—';
  return 'Rp ' + val.toLocaleString('id-ID');
}

// ─── Component ───────────────────────────────────────────────
export function MonthlyKPITargets() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Reference data
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [selPositionFilter, setSelPositionFilter] = useState<string>('all');
  const [selUserId, setSelUserId] = useState<string>('');

  // Target grid
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [gridLoaded, setGridLoaded] = useState(false);

  // CSV import dialog
  const [csvDialog, setCsvDialog] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch reference data
  useEffect(() => {
    (async () => {
      const [pRes, posRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email'),
        supabase.from('positions').select('id, position_code, position_name').eq('is_active', true),
      ]);
      setProfiles((pRes.data as any) || []);
      setPositions((posRes.data as any) || []);
    })();
  }, []);

  // Filter users by position (via user_roles → org_role mapping is not direct to positions,
  // so we just show all users and let admin pick)
  const filteredUsers = useMemo(() => {
    return profiles.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [profiles]);

  // Load template + existing targets when user is selected
  const loadGrid = useCallback(async () => {
    if (!selUserId) {
      setRows([]);
      setGridLoaded(false);
      return;
    }

    setLoading(true);
    setGridLoaded(false);

    // 1. Find user's position via user_roles org_role
    // We need to map org_role → position. For now we look for active template matching any position for the year.
    // Better approach: find all active templates for the year, let admin pick or auto-detect.
    
    // Fetch all active templates for this year with items
    const { data: templates } = await supabase
      .from('kpi_templates')
      .select('*, positions(*), kpi_template_items(*, kpi_master(*))')
      .eq('year', selYear)
      .eq('is_active', true) as any;

    // Try to detect user's position from user_roles
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('org_role')
      .eq('user_id', selUserId)
      .single() as any;

    // Map org_role to position_code heuristic
    const roleToPositionCode: Record<string, string> = {};
    if (positions.length > 0) {
      // Build a flexible mapping
      for (const pos of positions) {
        const code = pos.position_code.toLowerCase();
        if (code.includes('sales_person') || code.includes('salesperson')) roleToPositionCode['sales_person'] = pos.id;
        if (code.includes('supervisor')) roleToPositionCode['supervisor'] = pos.id;
        if (code.includes('manager') || code.includes('sales_manager')) roleToPositionCode['sales_manager'] = pos.id;
        if (code.includes('rep') || code.includes('representative')) roleToPositionCode['representative_management'] = pos.id;
      }
    }

    let matchedTemplate: any = null;
    if (userRole?.org_role && roleToPositionCode[userRole.org_role]) {
      matchedTemplate = (templates || []).find((t: any) => t.position_id === roleToPositionCode[userRole.org_role]);
    }

    // Fallback: if only one template, use it
    if (!matchedTemplate && templates?.length === 1) {
      matchedTemplate = templates[0];
    }

    if (!matchedTemplate) {
      // If position filter is set, try to match
      if (selPositionFilter !== 'all') {
        matchedTemplate = (templates || []).find((t: any) => t.position_id === selPositionFilter);
      }
    }

    if (!matchedTemplate || !matchedTemplate.kpi_template_items?.length) {
      setRows([]);
      setTemplateName(matchedTemplate?.template_name || '');
      setGridLoaded(true);
      setLoading(false);
      toast({
        title: 'Template tidak ditemukan',
        description: 'Tidak ada template KPI aktif untuk user ini pada tahun yang dipilih.',
        variant: 'destructive',
      });
      return;
    }

    setTemplateName(matchedTemplate.template_name);

    // Build template items
    const templateItems: TemplateItem[] = matchedTemplate.kpi_template_items.map((ti: any) => ({
      kpi_id: ti.kpi_id,
      kpi_code: ti.kpi_master?.kpi_code ?? '',
      kpi_name: ti.kpi_master?.kpi_name ?? '',
      unit_type: ti.kpi_master?.unit_type ?? '',
      weight_pct: Number(ti.weight_pct),
      baseline_annual_target_value: ti.baseline_annual_target_value != null ? Number(ti.baseline_annual_target_value) : null,
      baseline_annual_target_pct: ti.baseline_annual_target_pct != null ? Number(ti.baseline_annual_target_pct) : null,
    }));

    // 2. Fetch existing monthly targets for this user/year/month
    const { data: existing } = await supabase
      .from('kpi_monthly_targets')
      .select('*')
      .eq('user_id', selUserId)
      .eq('year', selYear)
      .eq('month', selMonth) as any;

    const existingMap = new Map((existing || []).map((e: any) => [e.kpi_id, e]));

    // 3. Fetch previous month targets
    const prevMonth = selMonth === 1 ? 12 : selMonth - 1;
    const prevYear = selMonth === 1 ? selYear - 1 : selYear;
    const { data: prevData } = await supabase
      .from('kpi_monthly_targets')
      .select('*')
      .eq('user_id', selUserId)
      .eq('year', prevYear)
      .eq('month', prevMonth) as any;

    const prevMap = new Map((prevData || []).map((e: any) => [e.kpi_id, e]));

    // 4. Build rows
    const targetRows: TargetRow[] = templateItems.map(ti => {
      const ex = existingMap.get(ti.kpi_id) as any;
      const prev = prevMap.get(ti.kpi_id) as any;
      return {
        ...ti,
        target_value: ex?.target_value != null ? Number(ex.target_value) : null,
        target_pct: ex?.target_pct != null ? Number(ex.target_pct) : null,
        prev_target_value: prev?.target_value != null ? Number(prev.target_value) : null,
        prev_target_pct: prev?.target_pct != null ? Number(prev.target_pct) : null,
        notes: ex?.notes ?? '',
        dirty: false,
        existing_id: ex?.id ?? null,
      };
    });

    setRows(targetRows);
    setGridLoaded(true);
    setLoading(false);
  }, [selUserId, selYear, selMonth, selPositionFilter, positions, toast]);

  useEffect(() => {
    if (selUserId) loadGrid();
  }, [selUserId, selYear, selMonth, loadGrid]);

  // Update row field
  function updateRow(idx: number, field: 'target_value' | 'target_pct' | 'notes', value: any) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, dirty: true } : r));
  }

  // Auto-fill from annual baseline
  function generateFromBaseline() {
    setRows(prev => prev.map(r => {
      const isPercent = r.unit_type === '%';
      const isBinary = r.unit_type === 'Binary';
      if (isBinary) {
        return { ...r, target_value: 1, dirty: true };
      }
      if (isPercent) {
        const annual = r.baseline_annual_target_pct;
        return { ...r, target_pct: annual != null ? parseFloat((annual / 12).toFixed(2)) : null, dirty: true };
      }
      const annual = r.baseline_annual_target_value;
      return { ...r, target_value: annual != null ? parseFloat((annual / 12).toFixed(2)) : null, dirty: true };
    }));
    toast({ title: 'Target diisi dari baseline tahunan / 12' });
  }

  // Copy from previous month
  function copyFromPreviousMonth() {
    const hasAnyPrev = rows.some(r => r.prev_target_value != null || r.prev_target_pct != null);
    if (!hasAnyPrev) {
      toast({ title: 'Tidak ada data target bulan lalu', description: 'Pastikan target bulan sebelumnya sudah diisi.', variant: 'destructive' });
      return;
    }
    setRows(prev => prev.map(r => {
      const isBinary = r.unit_type === 'Binary';
      const isPercent = r.unit_type === '%';
      if (isBinary) return { ...r, target_value: 1, dirty: true };
      if (isPercent && r.prev_target_pct != null) {
        return { ...r, target_pct: r.prev_target_pct, dirty: true };
      }
      if (!isPercent && r.prev_target_value != null) {
        return { ...r, target_value: r.prev_target_value, dirty: true };
      }
      return r;
    }));
    const prevMonth = selMonth === 1 ? 12 : selMonth - 1;
    const prevMonthName = monthNames[prevMonth - 1];
    toast({ title: `Target dicopy dari ${prevMonthName}` });
  }

  // Save (upsert)
  async function handleSave() {
    if (!selUserId || !user) return;
    const dirtyRows = rows.filter(r => r.dirty);
    if (dirtyRows.length === 0) {
      toast({ title: 'Tidak ada perubahan untuk disimpan.' });
      return;
    }

    setSaving(true);

    // We need to upsert. Since supabase JS doesn't directly support ON CONFLICT with custom columns easily,
    // we'll delete existing and re-insert for dirty rows, or use individual upserts.
    const upserts = dirtyRows.map(r => ({
      user_id: selUserId,
      kpi_id: r.kpi_id,
      year: selYear,
      month: selMonth,
      target_value: r.target_value,
      target_pct: r.target_pct,
      source: 'MANUAL' as const,
      created_by: user.id,
    }));

    // Delete existing for these kpi_ids, then insert
    const kpiIds = dirtyRows.map(r => r.kpi_id);
    await supabase
      .from('kpi_monthly_targets')
      .delete()
      .eq('user_id', selUserId)
      .eq('year', selYear)
      .eq('month', selMonth)
      .in('kpi_id', kpiIds) as any;

    const { error } = await supabase
      .from('kpi_monthly_targets')
      .insert(upserts as any) as any;

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Target bulanan berhasil disimpan!' });
      // Mark all as not dirty
      setRows(prev => prev.map(r => ({ ...r, dirty: false })));
      loadGrid();
    }
    setSaving(false);
  }

  // CSV Import
  async function handleCsvImport() {
    if (!csvText.trim() || !user) return;
    setCsvImporting(true);

    const lines = csvText.trim().split('\n').map(l => l.split(',').map(c => c.trim()));
    if (lines.length < 2) {
      toast({ title: 'CSV harus memiliki header dan minimal 1 baris data.', variant: 'destructive' });
      setCsvImporting(false);
      return;
    }

    const header = lines[0].map(h => h.toLowerCase());
    const userIdIdx = header.indexOf('user_id');
    const kpiCodeIdx = header.indexOf('kpi_code');
    const yearIdx = header.indexOf('year');
    const monthIdx = header.indexOf('month');
    const targetValueIdx = header.indexOf('target_value');
    const targetPctIdx = header.indexOf('target_pct');

    if (userIdIdx === -1 || kpiCodeIdx === -1 || yearIdx === -1 || monthIdx === -1) {
      toast({ title: 'Header CSV harus berisi: user_id, kpi_code, year, month', variant: 'destructive' });
      setCsvImporting(false);
      return;
    }

    // Fetch all KPI masters for code lookup
    const { data: allKpis } = await supabase
      .from('kpi_master')
      .select('id, kpi_code')
      .eq('is_active', true) as any;
    const kpiCodeMap = new Map((allKpis || []).map((k: any) => [k.kpi_code, k.id]));

    const errors: string[] = [];
    const inserts: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length < 4) { errors.push(`Baris ${i + 1}: kolom tidak lengkap`); continue; }

      const uid = row[userIdIdx];
      const kpiCode = row[kpiCodeIdx];
      const yr = parseInt(row[yearIdx]);
      const mo = parseInt(row[monthIdx]);
      const tv = targetValueIdx >= 0 && row[targetValueIdx] ? parseFloat(row[targetValueIdx]) : null;
      const tp = targetPctIdx >= 0 && row[targetPctIdx] ? parseFloat(row[targetPctIdx]) : null;

      if (!uid || !kpiCode || isNaN(yr) || isNaN(mo) || mo < 1 || mo > 12) {
        errors.push(`Baris ${i + 1}: data tidak valid`);
        continue;
      }

      const kpiId = kpiCodeMap.get(kpiCode);
      if (!kpiId) {
        errors.push(`Baris ${i + 1}: KPI code "${kpiCode}" tidak ditemukan`);
        continue;
      }

      inserts.push({
        user_id: uid,
        kpi_id: kpiId,
        year: yr,
        month: mo,
        target_value: tv,
        target_pct: tp,
        source: 'IMPORT',
        created_by: user.id,
      });
    }

    if (errors.length > 0) {
      toast({
        title: `${errors.length} error ditemukan`,
        description: errors.slice(0, 5).join('\n'),
        variant: 'destructive',
      });
    }

    if (inserts.length > 0) {
      // Delete existing entries for these combinations first
      for (const ins of inserts) {
        await supabase
          .from('kpi_monthly_targets')
          .delete()
          .eq('user_id', ins.user_id)
          .eq('kpi_id', ins.kpi_id)
          .eq('year', ins.year)
          .eq('month', ins.month) as any;
      }

      const { error } = await supabase.from('kpi_monthly_targets').insert(inserts as any) as any;
      if (error) {
        toast({ title: 'Error import', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: `${inserts.length} target berhasil diimport!` });
        setCsvDialog(false);
        setCsvText('');
        if (selUserId) loadGrid();
      }
    }

    setCsvImporting(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = 'user_id,kpi_code,year,month,target_value,target_pct\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kpi_monthly_targets_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Get target input value for display
  function getTargetInput(row: TargetRow) {
    if (row.unit_type === 'Binary') return 1;
    if (row.unit_type === '%') return row.target_pct;
    return row.target_value;
  }

  function getPrevTarget(row: TargetRow) {
    if (row.unit_type === '%') return row.prev_target_pct != null ? `${row.prev_target_pct}%` : '—';
    if (row.unit_type === 'IDR') return formatIDRFull(row.prev_target_value);
    return row.prev_target_value != null ? row.prev_target_value.toLocaleString('id-ID') : '—';
  }

  function getBaselineDisplay(row: TargetRow) {
    if (row.unit_type === '%') return row.baseline_annual_target_pct != null ? `${row.baseline_annual_target_pct}%` : '—';
    if (row.unit_type === 'IDR') return formatIDRFull(row.baseline_annual_target_value);
    return row.baseline_annual_target_value != null ? row.baseline_annual_target_value.toLocaleString('id-ID') : '—';
  }

  const hasDirty = rows.some(r => r.dirty);
  const selectedUser = profiles.find(p => p.user_id === selUserId);

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4 text-accent" />
            Target KPI Bulanan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tahun</Label>
              <Select value={selYear.toString()} onValueChange={v => setSelYear(parseInt(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => <SelectItem key={y} value={y.toString()} className="text-sm">{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bulan</Label>
              <Select value={selMonth.toString()} onValueChange={v => setSelMonth(parseInt(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthNames.map((m, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()} className="text-sm">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Posisi (opsional)</Label>
              <Select value={selPositionFilter} onValueChange={setSelPositionFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Semua posisi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm">Semua Posisi</SelectItem>
                  {positions.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">{p.position_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">User *</Label>
              <Select value={selUserId} onValueChange={setSelUserId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih user..." /></SelectTrigger>
                <SelectContent>
                  {filteredUsers.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id} className="text-sm">
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Grid */}
      {selUserId && gridLoaded && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Target: {selectedUser?.full_name} — {monthNames[selMonth - 1]} {selYear}
                </CardTitle>
                {templateName && (
                  <p className="text-xs text-muted-foreground mt-0.5">Template: {templateName}</p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setCsvDialog(true)}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
                </Button>
                <Button variant="outline" size="sm" onClick={copyFromPreviousMonth} disabled={rows.length === 0}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy dari Bulan Lalu
                </Button>
                <Button variant="outline" size="sm" onClick={generateFromBaseline} disabled={rows.length === 0}>
                  <Calculator className="h-3.5 w-3.5 mr-1" /> Generate dari Baseline
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!hasDirty || saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Simpan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center gap-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Tidak ada KPI items ditemukan. Pastikan ada template KPI aktif untuk posisi user ini di tahun {selYear}.
                </p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">Nama KPI</TableHead>
                      <TableHead className="text-xs">Unit</TableHead>
                      <TableHead className="text-xs text-right">Bobot %</TableHead>
                      <TableHead className="text-xs text-right">Baseline Tahunan</TableHead>
                      <TableHead className="text-xs text-right">Target Bulan Ini</TableHead>
                      <TableHead className="text-xs text-right">Target Bulan Lalu</TableHead>
                      <TableHead className="text-xs">Catatan</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const isBinary = row.unit_type === 'Binary';
                      const isPercent = row.unit_type === '%';
                      return (
                        <TableRow key={row.kpi_id} className={row.dirty ? 'bg-accent/10' : ''}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-sm font-medium">
                            <div>{row.kpi_name}</div>
                            <div className="text-xs text-muted-foreground">{row.kpi_code}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{row.unit_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-right">{row.weight_pct}%</TableCell>
                          <TableCell className="text-sm text-right">{getBaselineDisplay(row)}</TableCell>
                          <TableCell className="text-right">
                            {isBinary ? (
                              <Badge variant="secondary" className="text-xs">1 (Ya/Tidak)</Badge>
                            ) : (
                              <Input
                                type="number"
                                value={isPercent ? (row.target_pct ?? '') : (row.target_value ?? '')}
                                onChange={e => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  updateRow(idx, isPercent ? 'target_pct' : 'target_value', val);
                                }}
                                className="h-8 text-sm text-right w-32"
                                placeholder={isPercent ? '%' : row.unit_type === 'IDR' ? 'Rp' : '0'}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground">
                            {getPrevTarget(row)}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.notes}
                              onChange={e => updateRow(idx, 'notes' as any, e.target.value)}
                              className="h-8 text-xs w-32"
                              placeholder="Catatan..."
                            />
                          </TableCell>
                          <TableCell>
                            {row.dirty && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* CSV Import Dialog */}
      <Dialog open={csvDialog} onOpenChange={setCsvDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Import Target dari CSV</DialogTitle>
            <DialogDescription className="text-xs">
              Upload file CSV dengan kolom: user_id, kpi_code, year, month, target_value, target_pct
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            <Textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={10}
              className="text-xs font-mono"
              placeholder="user_id,kpi_code,year,month,target_value,target_pct&#10;abc-123,KPI-001,2026,3,50000000,"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCsvDialog(false)}>Batal</Button>
            <Button size="sm" onClick={handleCsvImport} disabled={csvImporting || !csvText.trim()}>
              {csvImporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
