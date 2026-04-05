import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { Loader2, Save, Upload, Download, Plus, Trash2, DollarSign, TrendingUp, BarChart3, Users, Calendar, CalendarRange, User, FileSpreadsheet, FileDown, MoreVertical, Eye, Pencil, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { formatIDR } from '@/types/sales';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────
interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  segment: string | null;
}

interface TargetRow {
  id: string | null;
  user_id: string;
  full_name: string;
  segment: string;
  month: string;
  revenue_target: number;
  margin_target: number;
  dirty: boolean;
  isNew: boolean;
}

const SEGMENTS = ['B2G', 'B2B', 'B2C'];
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const monthNamesFull = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${monthNamesFull[parseInt(mo) - 1]} ${y}`;
}

// ─── Component ───────────────────────────────────────────────
export function RevenueTargetManagement() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [allYearTargets, setAllYearTargets] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState<'monthly' | 'annually' | 'individual'>('monthly');
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selSegment, setSelSegment] = useState<string>('ALL');
  const [selUserId, setSelUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addSegment, setAddSegment] = useState('B2B');
  const [addMonth, setAddMonth] = useState('');
  const [addRevenue, setAddRevenue] = useState(0);
  const [addMargin, setAddMargin] = useState(17);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [showTemplateImport, setShowTemplateImport] = useState(false);
  const [templateImportText, setTemplateImportText] = useState('');

  // View/Edit detail dialog
  const [detailRow, setDetailRow] = useState<TargetRow | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [editRevenue, setEditRevenue] = useState(0);
  const [editMargin, setEditMargin] = useState(0);

  // ─── Load profiles ─────────────────────────────────────────
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email, segment').eq('is_active', true).order('full_name');
      setProfiles(data || []);
    }
    loadProfiles();
  }, []);

  const monthStr = selMonth > 0 ? `${selYear}-${String(selMonth).padStart(2, '0')}` : '';

  // ─── Load targets ─────────────────────────────────────────
  const loadTargets = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('targets').select('*');
    if (selMonth > 0) {
      query = query.eq('month', `${selYear}-${String(selMonth).padStart(2, '0')}`);
    } else {
      // Load all months for selected year
      const monthPatterns = Array.from({ length: 12 }, (_, i) => `${selYear}-${String(i + 1).padStart(2, '0')}`);
      query = query.in('month', monthPatterns);
    }
    const { data, error } = await query;
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setLoading(false); return; }
    const rows: TargetRow[] = (data || []).map((t: any) => {
      const profile = profiles.find(p => p.user_id === t.user_id);
      return { id: t.id, user_id: t.user_id, full_name: profile?.full_name || t.user_id, segment: t.segment, month: t.month, revenue_target: t.revenue_target || 0, margin_target: t.margin_target || 0, dirty: false, isNew: false };
    });
    setTargets(rows);
    setLoading(false);
  }, [selYear, selMonth, profiles, toast]);

  const loadAllYearTargets = useCallback(async () => {
    const monthPatterns = Array.from({ length: 12 }, (_, i) => `${selYear}-${String(i + 1).padStart(2, '0')}`);
    const { data, error } = await supabase.from('targets').select('*').in('month', monthPatterns);
    if (error) return;
    const rows: TargetRow[] = (data || []).map((t: any) => {
      const profile = profiles.find(p => p.user_id === t.user_id);
      return { id: t.id, user_id: t.user_id, full_name: profile?.full_name || t.user_id, segment: t.segment, month: t.month, revenue_target: t.revenue_target || 0, margin_target: t.margin_target || 0, dirty: false, isNew: false };
    });
    setAllYearTargets(rows);
  }, [selYear, profiles]);

  useEffect(() => { if (profiles.length > 0) loadTargets(); }, [loadTargets, profiles.length]);
  useEffect(() => { if (profiles.length > 0) loadAllYearTargets(); }, [loadAllYearTargets, profiles.length]);
  useEffect(() => { if (viewMode === 'individual' && !selUserId && profiles.length > 0) setSelUserId(profiles[0].user_id); }, [viewMode, selUserId, profiles]);

  // ─── Computed data ────────────────────────────────────────
  const activeData = viewMode === 'monthly' ? targets : allYearTargets;

  const filteredTargets = useMemo(() => {
    let data = viewMode === 'monthly' ? targets : allYearTargets;
    if (selSegment !== 'ALL') data = data.filter(t => t.segment === selSegment);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(t => t.full_name.toLowerCase().includes(q));
    }
    return data;
  }, [targets, allYearTargets, selSegment, viewMode, searchQuery]);

  const individualMonthlyMatrix = useMemo(() => {
    if (viewMode !== 'individual' || !selUserId) return {};
    const result: Record<string, Record<string, { revenue: number; margin: number; id: string | null }>> = {};
    const userTargets = allYearTargets.filter(t => t.user_id === selUserId);
    const segments = selSegment === 'ALL' ? SEGMENTS : [selSegment];
    segments.forEach(seg => {
      result[seg] = {};
      for (let i = 0; i < 12; i++) {
        const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
        const row = userTargets.find(t => t.segment === seg && t.month === m);
        result[seg][m] = { revenue: row?.revenue_target || 0, margin: row?.margin_target || 0, id: row?.id || null };
      }
    });
    return result;
  }, [allYearTargets, selUserId, selSegment, selYear, viewMode]);

  const segmentSummaries = useMemo(() => {
    const src = viewMode === 'monthly' ? targets : allYearTargets;
    return SEGMENTS.map(seg => {
      const rows = src.filter(t => t.segment === seg);
      return {
        segment: seg,
        revenue: rows.reduce((s, t) => s + t.revenue_target, 0),
        avgMargin: rows.length > 0 ? rows.reduce((s, t) => s + t.margin_target, 0) / rows.length : 0,
        userCount: new Set(rows.map(r => r.user_id)).size,
      };
    });
  }, [targets, allYearTargets, viewMode]);

  const grandTotal = useMemo(() => ({
    revenue: activeData.reduce((s, t) => s + t.revenue_target, 0),
    avgMargin: activeData.length > 0 ? activeData.reduce((s, t) => s + t.margin_target, 0) / activeData.length : 0,
    userCount: new Set(activeData.map(r => r.user_id)).size,
    entryCount: activeData.length,
  }), [activeData]);

  const annualIndividualSummary = useMemo(() => {
    if (viewMode !== 'annually') return [];
    const map: Record<string, { user_id: string; full_name: string; segments: Record<string, number>; totalRevenue: number; avgMargin: number; count: number }> = {};
    allYearTargets.forEach(t => {
      if (!map[t.user_id]) map[t.user_id] = { user_id: t.user_id, full_name: t.full_name, segments: {}, totalRevenue: 0, avgMargin: 0, count: 0 };
      map[t.user_id].segments[t.segment] = (map[t.user_id].segments[t.segment] || 0) + t.revenue_target;
      map[t.user_id].totalRevenue += t.revenue_target;
      map[t.user_id].avgMargin += t.margin_target;
      map[t.user_id].count += 1;
    });
    return Object.values(map).map(u => ({ ...u, avgMargin: u.count > 0 ? u.avgMargin / u.count : 0 })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [allYearTargets, viewMode]);

  const segmentMonthlyBreakdown = useMemo(() => {
    if (viewMode !== 'annually') return {};
    const result: Record<string, { month: string; revenue: number }[]> = {};
    SEGMENTS.forEach(seg => {
      result[seg] = Array.from({ length: 12 }, (_, i) => {
        const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
        const rows = allYearTargets.filter(t => t.segment === seg && t.month === m);
        return { month: m, revenue: rows.reduce((s, t) => s + t.revenue_target, 0) };
      });
    });
    return result;
  }, [allYearTargets, selYear, viewMode]);

  const individualTotals = useMemo(() => {
    const userTargets = allYearTargets.filter(t => t.user_id === selUserId);
    const filtered = selSegment === 'ALL' ? userTargets : userTargets.filter(t => t.segment === selSegment);
    return {
      revenue: filtered.reduce((s, t) => s + t.revenue_target, 0),
      avgMargin: filtered.length > 0 ? filtered.reduce((s, t) => s + t.margin_target, 0) / filtered.length : 0,
      entries: filtered.length,
    };
  }, [allYearTargets, selUserId, selSegment]);

  // ─── Handlers ─────────────────────────────────────────────
  const updateField = (idx: number, field: 'revenue_target' | 'margin_target', value: number) => {
    setTargets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value, dirty: true } : t));
  };

  const handleAdd = async () => {
    if (!addUserId) { toast({ title: 'Pilih user', variant: 'destructive' }); return; }
    const targetMonth = addMonth || monthStr;
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) { toast({ title: 'Pilih bulan', variant: 'destructive' }); return; }
    
    // Check duplicate
    const { data: existing } = await supabase.from('targets').select('id').eq('user_id', addUserId).eq('segment', addSegment).eq('month', targetMonth).maybeSingle();
    if (existing) { toast({ title: 'Duplikat', description: 'Target untuk user, segment & bulan ini sudah ada', variant: 'destructive' }); return; }
    
    setSaving(true);
    const { error } = await supabase.from('targets').insert({ user_id: addUserId, segment: addSegment, month: targetMonth, revenue_target: addRevenue, margin_target: addMargin });
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    
    toast({ title: 'Target ditambahkan', description: `${profiles.find(p => p.user_id === addUserId)?.full_name} — ${addSegment} — ${targetMonth}` });
    setShowAddForm(false);
    setAddUserId('');
    setAddRevenue(0);
    setAddMargin(17);
    loadTargets();
    loadAllYearTargets();
  };

  const handleSave = async () => {
    const dirtyRows = targets.filter(t => t.dirty);
    if (dirtyRows.length === 0) { toast({ title: 'Tidak ada perubahan' }); return; }
    setSaving(true);
    for (const row of dirtyRows) {
      if (row.isNew || !row.id) {
        const { error } = await supabase.from('targets').insert({ user_id: row.user_id, segment: row.segment, month: row.month, revenue_target: row.revenue_target, margin_target: row.margin_target });
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      } else {
        const { error } = await supabase.from('targets').update({ revenue_target: row.revenue_target, margin_target: row.margin_target }).eq('id', row.id);
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      }
    }
    toast({ title: 'Tersimpan', description: `${dirtyRows.length} target berhasil disimpan` });
    setSaving(false);
    loadTargets();
    loadAllYearTargets();
  };

  const handleDelete = async (row: TargetRow) => {
    if (row.id) {
      const { error } = await supabase.from('targets').delete().eq('id', row.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    }
    setTargets(prev => prev.filter(t => t !== row));
    toast({ title: 'Dihapus' });
    loadAllYearTargets();
  };

  const handleEditSave = async () => {
    if (!detailRow) return;
    setSaving(true);
    if (detailRow.id) {
      const { error } = await supabase.from('targets').update({ revenue_target: editRevenue, margin_target: editMargin }).eq('id', detailRow.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setSaving(false); return; }
    }
    toast({ title: 'Tersimpan' });
    setSaving(false);
    setDetailRow(null);
    loadTargets();
    loadAllYearTargets();
  };

  const openDetail = (row: TargetRow, mode: 'view' | 'edit') => {
    setDetailRow(row);
    setDetailMode(mode);
    setEditRevenue(row.revenue_target);
    setEditMargin(row.margin_target);
  };

  // ─── Import/Export ────────────────────────────────────────
  const handleImport = async () => {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) { toast({ title: 'Data kosong', variant: 'destructive' }); return; }
    let imported = 0, errors = 0;
    for (const line of lines) {
      const cols = line.split(/[,\t;]/).map(c => c.trim());
      if (cols.length < 4) { errors++; continue; }
      const [email, segment, revStr, marginStr] = cols;
      const profile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      if (!profile || !SEGMENTS.includes(segment)) { errors++; continue; }
      const revenue = parseFloat(revStr), margin = parseFloat(marginStr);
      if (isNaN(revenue) || isNaN(margin)) { errors++; continue; }
      const existing = targets.find(t => t.user_id === profile.user_id && t.segment === segment);
      if (existing) {
        setTargets(prev => prev.map(t => t.user_id === profile.user_id && t.segment === segment ? { ...t, revenue_target: revenue, margin_target: margin, dirty: true } : t));
      } else {
        setTargets(prev => [...prev, { id: null, user_id: profile.user_id, full_name: profile.full_name, segment, month: monthStr, revenue_target: revenue, margin_target: margin, dirty: true, isNew: true }]);
      }
      imported++;
    }
    toast({ title: 'Import selesai', description: `${imported} berhasil, ${errors} error`, variant: errors > 0 ? 'destructive' : 'default' });
    setShowImport(false);
    setImportText('');
  };

  const exportToXlsx = (data: Record<string, any>[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 18) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Targets');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const src = viewMode === 'monthly' ? targets : allYearTargets;
    const data = src.map(t => {
      const p = profiles.find(pr => pr.user_id === t.user_id);
      return { Email: p?.email || '', Nama: t.full_name, Segment: t.segment, Bulan: t.month, 'Revenue Target': t.revenue_target, 'Margin Target (%)': t.margin_target };
    });
    exportToXlsx(data, `sales_targets_${viewMode === 'monthly' ? monthStr : selYear}.xlsx`);
    toast({ title: 'Export Excel berhasil' });
  };

  const handleTemplateExport = (filled: boolean) => {
    let data: Record<string, any>[] = [];
    if (filled) {
      allYearTargets.forEach(t => {
        const p = profiles.find(pr => pr.user_id === t.user_id);
        data.push({ Email: p?.email || '', Nama: t.full_name, Segment: t.segment, 'Bulan (YYYY-MM)': t.month, 'Revenue Target': t.revenue_target, 'Margin Target (%)': t.margin_target });
      });
    } else {
      profiles.forEach(p => {
        SEGMENTS.forEach(seg => {
          for (let i = 1; i <= 12; i++) {
            const m = `${selYear}-${String(i).padStart(2, '0')}`;
            data.push({ Email: p.email, Nama: p.full_name, Segment: seg, 'Bulan (YYYY-MM)': m, 'Revenue Target': 0, 'Margin Target (%)': 0 });
          }
        });
      });
    }
    exportToXlsx(data, filled ? `sales_targets_filled_${selYear}.xlsx` : `sales_targets_template_${selYear}.xlsx`);
    toast({ title: filled ? 'Data exported (.xlsx)' : 'Template downloaded (.xlsx)' });
  };

  const handleTemplateImport = async (file?: File) => {
    let lines: string[] = [];
    if (file) {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      lines = csv.split('\n').filter(l => l.trim());
    } else {
      lines = templateImportText.trim().split('\n').filter(l => l.trim());
    }
    if (lines.length === 0) { toast({ title: 'Data kosong', variant: 'destructive' }); return; }
    let startIdx = 0;
    if (lines[0].toLowerCase().includes('email') && lines[0].toLowerCase().includes('segment')) startIdx = 1;
    setSaving(true);
    let imported = 0, errors = 0;
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(/[,\t;]/).map(c => c.trim());
      if (cols.length < 5) { errors++; continue; }
      const email = cols[0], segment = cols[2], monthVal = cols[3], revStr = cols[4], marginStr = cols.length >= 6 ? cols[5] : '0';
      const profile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      if (!profile || !SEGMENTS.includes(segment) || !/^\d{4}-\d{2}$/.test(monthVal)) { errors++; continue; }
      const revenue = parseFloat(revStr), margin = parseFloat(marginStr);
      if (isNaN(revenue) || (revenue === 0 && (isNaN(margin) || margin === 0))) continue;
      const { data: existing } = await supabase.from('targets').select('id').eq('user_id', profile.user_id).eq('segment', segment).eq('month', monthVal).maybeSingle();
      if (existing) {
        await supabase.from('targets').update({ revenue_target: revenue, margin_target: isNaN(margin) ? 0 : margin }).eq('id', existing.id);
      } else {
        await supabase.from('targets').insert({ user_id: profile.user_id, segment, month: monthVal, revenue_target: revenue, margin_target: isNaN(margin) ? 0 : margin });
      }
      imported++;
    }
    setSaving(false);
    toast({ title: 'Import selesai', description: `${imported} berhasil, ${errors} error`, variant: errors > 0 ? 'destructive' : 'default' });
    setShowTemplateImport(false);
    setTemplateImportText('');
    loadTargets();
    loadAllYearTargets();
  };

  const availableUsers = useMemo(() => profiles.filter(p => !targets.find(t => t.user_id === p.user_id && t.segment === addSegment)), [profiles, targets, addSegment]);
  const dirtyCount = targets.filter(t => t.dirty).length;
  const selectedProfile = profiles.find(p => p.user_id === selUserId);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-9 text-sm px-4">
              <Download className="h-4 w-4 mr-2" /> Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleTemplateExport(false)}>
              <FileDown className="h-3.5 w-3.5 mr-2" /> Download Template Kosong
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTemplateExport(true)} disabled={allYearTargets.length === 0}>
              <Download className="h-3.5 w-3.5 mr-2" /> Export Data ({selYear})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="outline" className="h-9 text-sm px-4" onClick={() => setShowTemplateImport(true)}>
          <Upload className="h-4 w-4 mr-2" /> Import
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-sm px-4" onClick={handleExportCSV} disabled={activeData.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Ekspor
        </Button>
        <Button size="sm" className="h-9 text-sm px-4" onClick={() => { setAddMonth(monthStr); setShowAddForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Tambah
        </Button>
        {dirtyCount > 0 && (
          <Button size="sm" className="h-9 text-sm px-4 ml-auto" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan ({dirtyCount})
          </Button>
        )}
      </div>

      {/* ═══ SUMMARY CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Total Revenue</p>
            <p className="text-sm font-bold">{formatIDR(grandTotal.revenue)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-chart-2">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Avg Margin</p>
            <p className="text-sm font-bold">{grandTotal.avgMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-chart-3">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Jumlah Sales</p>
            <p className="text-sm font-bold">{grandTotal.userCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-chart-4">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Entries</p>
            <p className="text-sm font-bold">{grandTotal.entryCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ SALES TARGET TABLE CARD ═══ */}
      {viewMode !== 'individual' && (
        <Card>
          <CardHeader className="pb-2 pt-3 space-y-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Sales Target Summary
            </CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tampilan</Label>
                <Select value={viewMode} onValueChange={v => setViewMode(v as any)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly"><span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Bulanan</span></SelectItem>
                    <SelectItem value="annually"><span className="flex items-center gap-1.5"><CalendarRange className="h-3 w-3" /> Tahunan</span></SelectItem>
                    <SelectItem value="individual"><span className="flex items-center gap-1.5"><User className="h-3 w-3" /> Per Sales</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tahun</Label>
                <Select value={String(selYear)} onValueChange={v => setSelYear(Number(v))}>
                  <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Bulan</Label>
                <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Semua</SelectItem>
                    {monthNamesFull.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Segment</Label>
                <Select value={selSegment} onValueChange={setSelSegment}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua</SelectItem>
                    {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cari</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="h-8 text-xs pl-7 w-[150px]" placeholder="Nama sales..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t rounded-b-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Bulan</TableHead>
                    <TableHead className="text-[10px]">Segment</TableHead>
                    <TableHead className="text-[10px]">Sales Person</TableHead>
                    <TableHead className="text-[10px] text-right">Revenue Target</TableHead>
                    <TableHead className="text-[10px] text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTargets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Belum ada data target.</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredTargets.map((row, idx) => (
                        <TableRow
                          key={`${row.user_id}-${row.segment}-${row.month}-${idx}`}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelSegment(selSegment === row.segment ? 'ALL' : row.segment)}
                        >
                          <TableCell className="text-xs py-1.5">{monthLabel(row.month)}</TableCell>
                          <TableCell className="py-1.5">
                            <Badge variant={selSegment === row.segment ? 'default' : 'outline'} className="text-[10px]">{row.segment}</Badge>
                          </TableCell>
                          <TableCell className="text-xs py-1.5">{row.full_name}</TableCell>
                          <TableCell className="text-xs font-medium text-right py-1.5">{formatIDR(row.revenue_target)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{row.margin_target.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3} className="text-xs py-1.5 font-bold">Total ({filteredTargets.length} entries, {new Set(filteredTargets.map(r => r.user_id)).size} sales)</TableCell>
                        <TableCell className="text-xs font-bold text-right py-1.5">{formatIDR(filteredTargets.reduce((s, t) => s + t.revenue_target, 0))}</TableCell>
                        <TableCell className="text-xs font-bold text-right py-1.5">
                          {filteredTargets.length > 0 ? (filteredTargets.reduce((s, t) => s + t.margin_target, 0) / filteredTargets.length).toFixed(1) : '0.0'}%
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ INDIVIDUAL VIEW ═══ */}
      {viewMode === 'individual' && selUserId && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" /> {selectedProfile?.full_name} — Revenue Target {selYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Revenue Matrix */}
            <div className="border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] w-[60px]">Seg</TableHead>
                    {monthNames.map((n, i) => <TableHead key={i} className="text-[10px] text-center px-1">{n}</TableHead>)}
                    <TableHead className="text-[10px] text-center font-bold px-1">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(individualMonthlyMatrix).map(([seg, months]) => {
                    const segTotal = Object.values(months).reduce((s, m) => s + m.revenue, 0);
                    return (
                      <TableRow key={seg}>
                        <TableCell className="py-1.5"><Badge variant="outline" className="text-[10px]">{seg}</Badge></TableCell>
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                          const val = months[m];
                          return <TableCell key={i} className="text-[10px] text-center px-1 py-1.5">{val && val.revenue > 0 ? formatIDR(val.revenue) : <span className="text-muted-foreground">-</span>}</TableCell>;
                        })}
                        <TableCell className="text-[10px] text-center font-bold px-1 py-1.5">{formatIDR(segTotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {selSegment === 'ALL' && (
                    <TableRow className="bg-muted/50">
                      <TableCell className="text-[10px] font-bold py-1.5">ALL</TableCell>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                        const total = Object.values(individualMonthlyMatrix).reduce((s, months) => s + (months[m]?.revenue || 0), 0);
                        return <TableCell key={i} className="text-[10px] text-center font-bold px-1 py-1.5">{total > 0 ? formatIDR(total) : '-'}</TableCell>;
                      })}
                      <TableCell className="text-[10px] text-center font-bold px-1 py-1.5">{formatIDR(individualTotals.revenue)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Margin Matrix */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Margin Target (%)</p>
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-[60px]">Seg</TableHead>
                      {monthNames.map((n, i) => <TableHead key={i} className="text-[10px] text-center px-1">{n}</TableHead>)}
                      <TableHead className="text-[10px] text-center font-bold px-1">Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(individualMonthlyMatrix).map(([seg, months]) => {
                      const vals = Object.values(months).filter(m => m.margin > 0);
                      const avg = vals.length > 0 ? vals.reduce((s, m) => s + m.margin, 0) / vals.length : 0;
                      return (
                        <TableRow key={seg}>
                          <TableCell className="py-1.5"><Badge variant="outline" className="text-[10px]">{seg}</Badge></TableCell>
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                            const val = months[m];
                            return <TableCell key={i} className="text-[10px] text-center px-1 py-1.5">{val && val.margin > 0 ? `${val.margin.toFixed(1)}%` : <span className="text-muted-foreground">-</span>}</TableCell>;
                          })}
                          <TableCell className="text-[10px] text-center font-bold px-1 py-1.5">{avg > 0 ? `${avg.toFixed(1)}%` : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ MONTHLY VIEW - Editable Table ═══ */}
      {viewMode === 'monthly' && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Target Individu — {monthLabel(monthStr)}
              {dirtyCount > 0 && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">{dirtyCount} unsaved</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-[30px]">#</TableHead>
                      <TableHead className="text-[10px]">Nama Sales</TableHead>
                      <TableHead className="text-[10px] w-[70px]">Segment</TableHead>
                      <TableHead className="text-[10px] w-[170px]">Revenue Target (Rp)</TableHead>
                      <TableHead className="text-[10px] w-[110px]">Margin (%)</TableHead>
                      <TableHead className="text-[10px] w-[50px] text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTargets.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Belum ada target. Klik "Tambah" untuk mulai.</TableCell></TableRow>
                    ) : filteredTargets.map((row, idx) => {
                      const realIdx = targets.indexOf(row);
                      return (
                        <TableRow key={`${row.user_id}-${row.segment}`} className={row.dirty ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                          <TableCell className="text-[10px] text-muted-foreground py-1.5">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium py-1.5">{row.full_name}</TableCell>
                          <TableCell className="py-1.5"><Badge variant="outline" className="text-[10px]">{row.segment}</Badge></TableCell>
                          <TableCell className="py-1.5">
                            <Input type="number" className="h-7 text-xs" value={row.revenue_target || ''} onChange={e => updateField(realIdx, 'revenue_target', parseFloat(e.target.value) || 0)} placeholder="0" />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input type="number" className="h-7 text-xs" value={row.margin_target || ''} onChange={e => updateField(realIdx, 'margin_target', parseFloat(e.target.value) || 0)} placeholder="0" step="0.1" />
                          </TableCell>
                          <TableCell className="py-1.5 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3.5 w-3.5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDetail(row, 'view')}><Eye className="h-3.5 w-3.5 mr-2" /> Lihat Detail</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDetail(row, 'edit')}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(row)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {/* ═══ ANNUAL VIEW ═══ */}
      {viewMode === 'annually' && (
        <></>
      )}

      {/* ═══ DIALOGS ═══ */}
      {/* View/Edit Detail */}
      <Dialog open={!!detailRow} onOpenChange={open => { if (!open) setDetailRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{detailMode === 'view' ? 'Detail Target' : 'Edit Target'}</DialogTitle>
            <DialogDescription className="text-xs">{detailRow?.full_name} — {detailRow?.segment} — {detailRow?.month ? monthLabel(detailRow.month) : ''}</DialogDescription>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Revenue Target (Rp)</Label>
                {detailMode === 'view' ? (
                  <p className="text-sm font-bold">{formatIDR(detailRow.revenue_target)}</p>
                ) : (
                  <Input type="number" className="h-8 text-xs" value={editRevenue || ''} onChange={e => setEditRevenue(parseFloat(e.target.value) || 0)} />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margin Target (%)</Label>
                {detailMode === 'view' ? (
                  <p className="text-sm font-bold">{detailRow.margin_target.toFixed(1)}%</p>
                ) : (
                  <Input type="number" className="h-8 text-xs" value={editMargin || ''} onChange={e => setEditMargin(parseFloat(e.target.value) || 0)} step="0.1" />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {detailMode === 'view' ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setDetailRow(null)}>Tutup</Button>
                <Button size="sm" onClick={() => setDetailMode('edit')}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setDetailMode('view')}>Batal</Button>
                <Button size="sm" onClick={handleEditSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Simpan
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Target */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Tambah Target Baru</DialogTitle>
            <DialogDescription className="text-xs">Input manual target revenue dan margin untuk sales person</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Segment</Label>
                <Select value={addSegment} onValueChange={setAddSegment}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bulan</Label>
                <Select value={addMonth || monthStr} onValueChange={setAddMonth}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                      return <SelectItem key={m} value={m}>{monthNamesFull[i]} {selYear}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sales Person</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih sales..." /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name} ({p.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Revenue Target (Rp)</Label>
                <Input type="number" className="h-8 text-xs" placeholder="0" value={addRevenue || ''} onChange={e => setAddRevenue(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margin Target (%)</Label>
                <Input type="number" className="h-8 text-xs" placeholder="17" value={addMargin || ''} onChange={e => setAddMargin(parseFloat(e.target.value) || 0)} step="0.1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Batal</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />} Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import (monthly) */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Import Target — {monthLabel(monthStr)}</DialogTitle>
            <DialogDescription className="text-xs">Format: <code className="bg-muted px-1 rounded text-[10px]">email, segment, revenue, margin</code></DialogDescription>
          </DialogHeader>
          <Textarea className="min-h-[120px] text-xs font-mono" placeholder={`john@co.com, B2B, 500000000, 17.5`} value={importText} onChange={e => setImportText(e.target.value)} />
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => { setShowImport(false); setImportText(''); }}>Batal</Button>
            <Button size="sm" onClick={handleImport}><Upload className="h-3 w-3 mr-1" /> Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Import */}
      <Dialog open={showTemplateImport} onOpenChange={setShowTemplateImport}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Import dari Template</DialogTitle>
            <DialogDescription className="text-xs">
              Upload file Excel (.xlsx) atau paste data CSV. Format: <code className="bg-muted px-1 rounded text-[10px]">Email, Nama, Segment, Bulan (YYYY-MM), Revenue, Margin (%)</code>
              <br /><span className="text-muted-foreground">Download template kosong terlebih dahulu, isi, lalu upload atau paste di sini. Data existing akan di-update (upsert).</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Upload File Excel (.xlsx)</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" className="text-xs mt-1" onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleTemplateImport(file);
              }} />
            </div>
            <div className="relative">
              <div className="absolute inset-x-0 top-0 flex items-center justify-center -mt-1.5">
                <span className="bg-background px-2 text-[10px] text-muted-foreground">atau paste data</span>
              </div>
            </div>
            <Textarea className="min-h-[120px] text-xs font-mono"
              placeholder={`Email,Nama,Segment,Bulan,Revenue,Margin\njohn@co.com,John,B2B,${selYear}-01,500000000,17.5`}
              value={templateImportText} onChange={e => setTemplateImportText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => { setShowTemplateImport(false); setTemplateImportText(''); }}>Batal</Button>
            <Button size="sm" onClick={() => handleTemplateImport()} disabled={saving || !templateImportText.trim()}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />} Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
