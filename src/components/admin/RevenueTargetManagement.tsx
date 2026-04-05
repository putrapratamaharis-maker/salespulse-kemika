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
import { Loader2, Save, Upload, Download, Plus, Trash2, DollarSign, TrendingUp, BarChart3, Users, Calendar, CalendarRange, User, FileSpreadsheet, FileDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatIDR } from '@/types/sales';

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
const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${monthNames[parseInt(mo) - 1]} ${y}`;
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

  // View mode: monthly | annually | individual
  const [viewMode, setViewMode] = useState<'monthly' | 'annually' | 'individual'>('monthly');

  // Filters
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selSegment, setSelSegment] = useState<string>('ALL');
  const [selUserId, setSelUserId] = useState<string>('');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addSegment, setAddSegment] = useState('B2B');

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Template import
  const [showTemplateImport, setShowTemplateImport] = useState(false);
  const [templateImportText, setTemplateImportText] = useState('');

  // ─── Load profiles ─────────────────────────────────────────
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email, segment').eq('is_active', true).order('full_name');
      setProfiles(data || []);
    }
    loadProfiles();
  }, []);

  const monthStr = `${selYear}-${String(selMonth).padStart(2, '0')}`;

  // ─── Load targets for selected month ──────────────────────
  const loadTargets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('targets').select('*').eq('month', monthStr);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const rows: TargetRow[] = (data || []).map((t: any) => {
      const profile = profiles.find(p => p.user_id === t.user_id);
      return {
        id: t.id, user_id: t.user_id, full_name: profile?.full_name || t.user_id,
        segment: t.segment, month: t.month,
        revenue_target: t.revenue_target || 0, margin_target: t.margin_target || 0,
        dirty: false, isNew: false,
      };
    });
    setTargets(rows);
    setLoading(false);
  }, [monthStr, profiles, toast]);

  // ─── Load all year targets for annual view ────────────────
  const loadAllYearTargets = useCallback(async () => {
    const monthPatterns = Array.from({ length: 12 }, (_, i) => `${selYear}-${String(i + 1).padStart(2, '0')}`);
    const { data, error } = await supabase.from('targets').select('*').in('month', monthPatterns);
    if (error) return;
    const rows: TargetRow[] = (data || []).map((t: any) => {
      const profile = profiles.find(p => p.user_id === t.user_id);
      return {
        id: t.id, user_id: t.user_id, full_name: profile?.full_name || t.user_id,
        segment: t.segment, month: t.month,
        revenue_target: t.revenue_target || 0, margin_target: t.margin_target || 0,
        dirty: false, isNew: false,
      };
    });
    setAllYearTargets(rows);
  }, [selYear, profiles]);

  useEffect(() => {
    if (profiles.length > 0) loadTargets();
  }, [loadTargets, profiles.length]);

  useEffect(() => {
    if (profiles.length > 0) loadAllYearTargets();
  }, [loadAllYearTargets, profiles.length]);

  // Auto-select first user when switching to individual view
  useEffect(() => {
    if (viewMode === 'individual' && !selUserId && profiles.length > 0) {
      setSelUserId(profiles[0].user_id);
    }
  }, [viewMode, selUserId, profiles]);

  // ─── Active data based on view mode ───────────────────────
  const activeData = viewMode === 'monthly' ? targets : allYearTargets;

  // ─── Filtered rows for individual table ───────────────────
  const filteredTargets = useMemo(() => {
    const data = viewMode === 'monthly' ? targets : allYearTargets;
    if (selSegment === 'ALL') return data;
    return data.filter(t => t.segment === selSegment);
  }, [targets, allYearTargets, selSegment, viewMode]);

  // ─── Individual user targets (all months of selected year) ─
  const individualUserTargets = useMemo(() => {
    if (viewMode !== 'individual' || !selUserId) return [];
    let data = allYearTargets.filter(t => t.user_id === selUserId);
    if (selSegment !== 'ALL') data = data.filter(t => t.segment === selSegment);
    return data.sort((a, b) => a.month.localeCompare(b.month));
  }, [allYearTargets, selUserId, selSegment, viewMode]);

  // Individual user monthly matrix (segment x month)
  const individualMonthlyMatrix = useMemo(() => {
    if (viewMode !== 'individual' || !selUserId) return {};
    const result: Record<string, Record<string, { revenue: number; margin: number }>> = {};
    const userTargets = allYearTargets.filter(t => t.user_id === selUserId);
    const segments = selSegment === 'ALL' ? SEGMENTS : [selSegment];
    segments.forEach(seg => {
      result[seg] = {};
      for (let i = 0; i < 12; i++) {
        const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
        const row = userTargets.find(t => t.segment === seg && t.month === m);
        result[seg][m] = { revenue: row?.revenue_target || 0, margin: row?.margin_target || 0 };
      }
    });
    return result;
  }, [allYearTargets, selUserId, selSegment, selYear, viewMode]);

  const individualTotals = useMemo(() => {
    const userTargets = allYearTargets.filter(t => t.user_id === selUserId);
    const filtered = selSegment === 'ALL' ? userTargets : userTargets.filter(t => t.segment === selSegment);
    return {
      revenue: filtered.reduce((s, t) => s + t.revenue_target, 0),
      avgMargin: filtered.length > 0 ? filtered.reduce((s, t) => s + t.margin_target, 0) / filtered.length : 0,
      entries: filtered.length,
    };
  }, [allYearTargets, selUserId, selSegment]);

  // ─── Section 2: Segment summaries ─────────────────────────
  const segmentSummaries = useMemo(() => {
    if (viewMode === 'monthly') {
      return SEGMENTS.map(seg => {
        const rows = targets.filter(t => t.segment === seg);
        return {
          segment: seg,
          revenue: rows.reduce((s, t) => s + t.revenue_target, 0),
          avgMargin: rows.length > 0 ? rows.reduce((s, t) => s + t.margin_target, 0) / rows.length : 0,
          userCount: new Set(rows.map(r => r.user_id)).size,
        };
      });
    } else {
      return SEGMENTS.map(seg => {
        const rows = allYearTargets.filter(t => t.segment === seg);
        return {
          segment: seg,
          revenue: rows.reduce((s, t) => s + t.revenue_target, 0),
          avgMargin: rows.length > 0 ? rows.reduce((s, t) => s + t.margin_target, 0) / rows.length : 0,
          userCount: new Set(rows.map(r => r.user_id)).size,
        };
      });
    }
  }, [targets, allYearTargets, viewMode]);

  // ─── Segment monthly breakdown for annual view ────────────
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

  // ─── Section 3: Grand total ───────────────────────────────
  const grandTotal = useMemo(() => {
    const data = activeData;
    return {
      revenue: data.reduce((s, t) => s + t.revenue_target, 0),
      avgMargin: data.length > 0 ? data.reduce((s, t) => s + t.margin_target, 0) / data.length : 0,
      userCount: new Set(data.map(r => r.user_id)).size,
      entryCount: data.length,
    };
  }, [activeData]);

  // ─── Annual individual summary (grouped by user) ──────────
  const annualIndividualSummary = useMemo(() => {
    if (viewMode !== 'annually') return [];
    const map: Record<string, { user_id: string; full_name: string; segments: Record<string, number>; totalRevenue: number; avgMargin: number; count: number }> = {};
    allYearTargets.forEach(t => {
      if (!map[t.user_id]) {
        map[t.user_id] = { user_id: t.user_id, full_name: t.full_name, segments: {}, totalRevenue: 0, avgMargin: 0, count: 0 };
      }
      map[t.user_id].segments[t.segment] = (map[t.user_id].segments[t.segment] || 0) + t.revenue_target;
      map[t.user_id].totalRevenue += t.revenue_target;
      map[t.user_id].avgMargin += t.margin_target;
      map[t.user_id].count += 1;
    });
    return Object.values(map).map(u => ({
      ...u,
      avgMargin: u.count > 0 ? u.avgMargin / u.count : 0,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [allYearTargets, viewMode]);

  // ─── Edit handlers ────────────────────────────────────────
  const updateField = (idx: number, field: 'revenue_target' | 'margin_target', value: number) => {
    setTargets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value, dirty: true } : t));
  };

  const handleAdd = () => {
    if (!addUserId) { toast({ title: 'Pilih user', variant: 'destructive' }); return; }
    const exists = targets.find(t => t.user_id === addUserId && t.segment === addSegment);
    if (exists) { toast({ title: 'Duplikat', description: 'Target untuk user & segment ini sudah ada', variant: 'destructive' }); return; }
    const profile = profiles.find(p => p.user_id === addUserId);
    setTargets(prev => [...prev, {
      id: null, user_id: addUserId, full_name: profile?.full_name || '',
      segment: addSegment, month: monthStr,
      revenue_target: 0, margin_target: 0, dirty: true, isNew: true,
    }]);
    setShowAddForm(false);
    setAddUserId('');
  };

  const handleSave = async () => {
    const dirtyRows = targets.filter(t => t.dirty);
    if (dirtyRows.length === 0) { toast({ title: 'Tidak ada perubahan' }); return; }
    setSaving(true);
    for (const row of dirtyRows) {
      if (row.isNew || !row.id) {
        const { error } = await supabase.from('targets').insert({
          user_id: row.user_id, segment: row.segment, month: row.month,
          revenue_target: row.revenue_target, margin_target: row.margin_target,
        });
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      } else {
        const { error } = await supabase.from('targets').update({
          revenue_target: row.revenue_target, margin_target: row.margin_target,
        }).eq('id', row.id);
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      }
    }
    toast({ title: 'Tersimpan', description: `${dirtyRows.length} target berhasil disimpan` });
    setSaving(false);
    loadTargets();
    loadAllYearTargets();
  };

  const handleDelete = async (row: TargetRow, idx: number) => {
    if (row.id) {
      const { error } = await supabase.from('targets').delete().eq('id', row.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    }
    setTargets(prev => prev.filter((_, i) => i !== idx));
    toast({ title: 'Dihapus' });
  };

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
        setTargets(prev => prev.map(t => t.user_id === profile.user_id && t.segment === segment
          ? { ...t, revenue_target: revenue, margin_target: margin, dirty: true } : t));
      } else {
        setTargets(prev => [...prev, {
          id: null, user_id: profile.user_id, full_name: profile.full_name,
          segment, month: monthStr, revenue_target: revenue, margin_target: margin, dirty: true, isNew: true,
        }]);
      }
      imported++;
    }
    toast({ title: 'Import selesai', description: `${imported} berhasil, ${errors} error`, variant: errors > 0 ? 'destructive' : 'default' });
    setShowImport(false);
    setImportText('');
  };

  const handleExport = () => {
    const header = 'Email,Segment,Revenue Target,Margin Target';
    const rows = targets.map(t => {
      const p = profiles.find(pr => pr.user_id === t.user_id);
      return `${p?.email || ''},${t.segment},${t.revenue_target},${t.margin_target}`;
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `revenue_targets_${monthStr}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Template Export: Download blank or filled template ───
  const handleTemplateExport = (filled: boolean) => {
    const header = 'Email,Nama,Segment,Bulan (YYYY-MM),Revenue Target,Margin Target (%)';
    let rows: string[] = [];
    if (filled) {
      // Export all year targets as template
      allYearTargets.forEach(t => {
        const p = profiles.find(pr => pr.user_id === t.user_id);
        rows.push(`${p?.email || ''},${t.full_name},${t.segment},${t.month},${t.revenue_target},${t.margin_target}`);
      });
    } else {
      // Blank template: one row per user x segment x month
      profiles.forEach(p => {
        SEGMENTS.forEach(seg => {
          for (let i = 1; i <= 12; i++) {
            const m = `${selYear}-${String(i).padStart(2, '0')}`;
            rows.push(`${p.email},${p.full_name},${seg},${m},0,0`);
          }
        });
      });
    }
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filled ? `sales_targets_filled_${selYear}.csv` : `sales_targets_template_${selYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Template diunduh', description: filled ? 'Template berisi data saat ini' : 'Template kosong siap diisi' });
  };

  // ─── Template Import: bulk import multi-month data ────────
  const handleTemplateImport = async () => {
    const lines = templateImportText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) { toast({ title: 'Data kosong', variant: 'destructive' }); return; }

    // Skip header if present
    let startIdx = 0;
    if (lines[0].toLowerCase().includes('email') && lines[0].toLowerCase().includes('segment')) {
      startIdx = 1;
    }

    setSaving(true);
    let imported = 0, errors = 0, skipped = 0;
    const errorDetails: string[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(/[,\t;]/).map(c => c.trim());
      if (cols.length < 5) { errors++; errorDetails.push(`Baris ${i + 1}: kolom kurang dari 5`); continue; }

      const email = cols[0];
      const segment = cols[2];
      const monthVal = cols[3];
      const revStr = cols[4];
      const marginStr = cols.length >= 6 ? cols[5] : '0';

      const profile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      if (!profile) { errors++; errorDetails.push(`Baris ${i + 1}: email "${email}" tidak ditemukan`); continue; }
      if (!SEGMENTS.includes(segment)) { errors++; errorDetails.push(`Baris ${i + 1}: segment "${segment}" tidak valid`); continue; }
      if (!/^\d{4}-\d{2}$/.test(monthVal)) { errors++; errorDetails.push(`Baris ${i + 1}: format bulan "${monthVal}" tidak valid`); continue; }

      const revenue = parseFloat(revStr);
      const margin = parseFloat(marginStr);
      if (isNaN(revenue)) { errors++; errorDetails.push(`Baris ${i + 1}: revenue tidak valid`); continue; }
      if (revenue === 0 && margin === 0) { skipped++; continue; }

      // Upsert: check if target already exists
      const { data: existing } = await supabase.from('targets')
        .select('id').eq('user_id', profile.user_id).eq('segment', segment).eq('month', monthVal).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('targets').update({
          revenue_target: revenue, margin_target: isNaN(margin) ? 0 : margin,
        }).eq('id', existing.id);
        if (error) { errors++; errorDetails.push(`Baris ${i + 1}: ${error.message}`); continue; }
      } else {
        const { error } = await supabase.from('targets').insert({
          user_id: profile.user_id, segment, month: monthVal,
          revenue_target: revenue, margin_target: isNaN(margin) ? 0 : margin,
        });
        if (error) { errors++; errorDetails.push(`Baris ${i + 1}: ${error.message}`); continue; }
      }
      imported++;
    }

    setSaving(false);
    toast({
      title: 'Template Import selesai',
      description: `${imported} berhasil, ${skipped} dilewati (kosong), ${errors} error`,
      variant: errors > 0 ? 'destructive' : 'default',
    });
    if (errorDetails.length > 0) {
      console.warn('Template import errors:', errorDetails);
    }
    setShowTemplateImport(false);
    setTemplateImportText('');
    loadTargets();
    loadAllYearTargets();
  };

  const availableUsers = useMemo(() => {
    return profiles.filter(p => !targets.find(t => t.user_id === p.user_id && t.segment === addSegment));
  }, [profiles, targets, addSegment]);

  const dirtyCount = targets.filter(t => t.dirty).length;

  const selectedProfile = profiles.find(p => p.user_id === selUserId);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* View Mode Toggle + Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tampilan</Label>
          <Select value={viewMode} onValueChange={v => setViewMode(v as 'monthly' | 'annually' | 'individual')}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly"><span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Monthly</span></SelectItem>
              <SelectItem value="annually"><span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" /> Annually</span></SelectItem>
              <SelectItem value="individual"><span className="flex items-center gap-1"><User className="h-3 w-3" /> Per Individu</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tahun</Label>
          <Select value={String(selYear)} onValueChange={v => setSelYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {viewMode === 'monthly' && (
          <div className="space-y-1">
            <Label className="text-xs">Bulan</Label>
            <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {viewMode === 'individual' && (
          <div className="space-y-1">
            <Label className="text-xs">Sales Person</Label>
            <Select value={selUserId} onValueChange={setSelUserId}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Pilih user..." /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Segment</Label>
          <Select value={selSegment} onValueChange={setSelSegment}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Template buttons - always visible */}
        <div className="flex items-end gap-2 ml-auto">
          <Button size="sm" variant="outline" onClick={() => handleTemplateExport(false)} title="Download template kosong">
            <FileDown className="h-3 w-3 mr-1" /> Template Kosong
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleTemplateExport(true)} disabled={allYearTargets.length === 0} title="Download template berisi data">
            <FileSpreadsheet className="h-3 w-3 mr-1" /> Export Data
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTemplateImport(true)} title="Import dari template CSV">
            <Upload className="h-3 w-3 mr-1" /> Import Template
          </Button>
        </div>
      </div>

      {/* ═══ INDIVIDUAL VIEW ═══ */}
      {viewMode === 'individual' && selUserId && (
        <>
          {/* Summary card */}
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4" /> {selectedProfile?.full_name || 'User'} — Target Tahun {selYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue Target</p>
                  <p className="text-lg font-bold text-foreground">{formatIDR(individualTotals.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Margin Target</p>
                  <p className="text-lg font-bold text-foreground">{individualTotals.avgMargin.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Entries</p>
                  <p className="text-lg font-bold text-foreground">{individualTotals.entries}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly x Segment matrix */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Detail Revenue per Bulan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Segment</TableHead>
                      {monthNames.map((n, i) => <TableHead key={i} className="text-xs text-center">{n.substring(0, 3)}</TableHead>)}
                      <TableHead className="text-xs text-center font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(individualMonthlyMatrix).map(([seg, months]) => {
                      const segTotal = Object.values(months).reduce((s, m) => s + m.revenue, 0);
                      return (
                        <TableRow key={seg}>
                          <TableCell><Badge variant="outline" className="text-[10px]">{seg}</Badge></TableCell>
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                            const val = months[m];
                            return (
                              <TableCell key={i} className="text-xs text-center">
                                {val && val.revenue > 0 ? formatIDR(val.revenue) : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-xs text-center font-bold">{formatIDR(segTotal)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {selSegment === 'ALL' && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell className="text-xs font-bold">TOTAL</TableCell>
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                          const monthTotal = Object.values(individualMonthlyMatrix).reduce((s, months) => s + (months[m]?.revenue || 0), 0);
                          return <TableCell key={i} className="text-xs text-center font-bold">{monthTotal > 0 ? formatIDR(monthTotal) : '-'}</TableCell>;
                        })}
                        <TableCell className="text-xs text-center font-bold">{formatIDR(individualTotals.revenue)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Margin detail table */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Detail Margin Target per Bulan (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Segment</TableHead>
                      {monthNames.map((n, i) => <TableHead key={i} className="text-xs text-center">{n.substring(0, 3)}</TableHead>)}
                      <TableHead className="text-xs text-center font-bold">Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(individualMonthlyMatrix).map(([seg, months]) => {
                      const vals = Object.values(months).filter(m => m.margin > 0);
                      const avg = vals.length > 0 ? vals.reduce((s, m) => s + m.margin, 0) / vals.length : 0;
                      return (
                        <TableRow key={seg}>
                          <TableCell><Badge variant="outline" className="text-[10px]">{seg}</Badge></TableCell>
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                            const val = months[m];
                            return (
                              <TableCell key={i} className="text-xs text-center">
                                {val && val.margin > 0 ? `${val.margin.toFixed(1)}%` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-xs text-center font-bold">{avg > 0 ? `${avg.toFixed(1)}%` : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ MONTHLY / ANNUALLY VIEWS ═══ */}
      {viewMode !== 'individual' && (
        <>
          {/* ═══ SECTION 3: Grand Total ═══ */}
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Target Total {viewMode === 'monthly' ? monthLabel(monthStr) : selYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue Target</p>
                  <p className="text-lg font-bold text-foreground">{formatIDR(grandTotal.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Margin Target</p>
                  <p className="text-lg font-bold text-foreground">{grandTotal.avgMargin.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Jumlah Sales</p>
                  <p className="text-lg font-bold text-foreground">{grandTotal.userCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Entries</p>
                  <p className="text-lg font-bold text-foreground">{grandTotal.entryCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ═══ SECTION 2: Per Segment Summary ═══ */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Ringkasan per Segment {viewMode === 'monthly' ? `— ${monthLabel(monthStr)}` : `— Tahun ${selYear}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'monthly' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {segmentSummaries.map(s => (
                    <Card key={s.segment} className="border-l-4 border-l-primary/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">{s.segment}</Badge>
                          <span className="text-xs text-muted-foreground">{s.userCount} user</span>
                        </div>
                        <p className="text-sm font-bold">{formatIDR(s.revenue)}</p>
                        <p className="text-xs text-muted-foreground">Avg Margin: {s.avgMargin.toFixed(1)}%</p>
                        {grandTotal.revenue > 0 && (
                          <p className="text-xs text-primary mt-1">{((s.revenue / grandTotal.revenue) * 100).toFixed(1)}% dari total</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Segment</TableHead>
                        {monthNames.map((n, i) => <TableHead key={i} className="text-xs text-center">{n.substring(0, 3)}</TableHead>)}
                        <TableHead className="text-xs text-center font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selSegment === 'ALL' ? SEGMENTS : [selSegment]).map(seg => {
                        const breakdown = segmentMonthlyBreakdown[seg] || [];
                        const segData = segmentSummaries.find(s => s.segment === seg);
                        return (
                          <TableRow key={seg}>
                            <TableCell><Badge variant="outline" className="text-[10px]">{seg}</Badge></TableCell>
                            {breakdown.map((b, i) => (
                              <TableCell key={i} className="text-xs text-center">{b.revenue > 0 ? formatIDR(b.revenue) : '-'}</TableCell>
                            ))}
                            <TableCell className="text-xs text-center font-bold">{formatIDR(segData?.revenue || 0)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {selSegment === 'ALL' && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="text-xs font-bold">TOTAL</TableCell>
                          {Array.from({ length: 12 }, (_, i) => {
                            const m = `${selYear}-${String(i + 1).padStart(2, '0')}`;
                            const monthTotal = allYearTargets.filter(t => t.month === m).reduce((s, t) => s + t.revenue_target, 0);
                            return <TableCell key={i} className="text-xs text-center font-bold">{monthTotal > 0 ? formatIDR(monthTotal) : '-'}</TableCell>;
                          })}
                          <TableCell className="text-xs text-center font-bold">{formatIDR(grandTotal.revenue)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SECTION 1: Individual Target Input ═══ */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Target Individu {viewMode === 'monthly' ? `— ${monthLabel(monthStr)}` : `— Tahun ${selYear}`}
                </CardTitle>
                {viewMode === 'monthly' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {dirtyCount > 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        {dirtyCount} unsaved
                      </Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Tambah
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
                      <Upload className="h-3 w-3 mr-1" /> Import
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExport} disabled={targets.length === 0}>
                      <Download className="h-3 w-3 mr-1" /> Export
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || dirtyCount === 0}>
                      {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                      Simpan
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : viewMode === 'monthly' ? (
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[30px]">#</TableHead>
                        <TableHead className="text-xs">Nama</TableHead>
                        <TableHead className="text-xs w-[80px]">Segment</TableHead>
                        <TableHead className="text-xs w-[180px]">Revenue Target (Rp)</TableHead>
                        <TableHead className="text-xs w-[120px]">Margin Target (%)</TableHead>
                        <TableHead className="text-xs w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTargets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                            Belum ada target untuk periode ini. Klik "Tambah" atau "Import" untuk mulai.
                          </TableCell>
                        </TableRow>
                      ) : filteredTargets.map((row, idx) => {
                        const realIdx = targets.indexOf(row);
                        return (
                          <TableRow key={`${row.user_id}-${row.segment}`} className={row.dirty ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="text-xs font-medium">{row.full_name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{row.segment}</Badge></TableCell>
                            <TableCell>
                              <Input type="number" className="h-7 text-xs w-full" value={row.revenue_target || ''}
                                onChange={e => updateField(realIdx, 'revenue_target', parseFloat(e.target.value) || 0)} placeholder="0" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="h-7 text-xs w-full" value={row.margin_target || ''}
                                onChange={e => updateField(realIdx, 'margin_target', parseFloat(e.target.value) || 0)} placeholder="0" step="0.1" />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(row, realIdx)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                /* Annual individual summary */
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[30px]">#</TableHead>
                        <TableHead className="text-xs">Nama</TableHead>
                        {SEGMENTS.map(s => <TableHead key={s} className="text-xs text-center">{s}</TableHead>)}
                        <TableHead className="text-xs text-center font-bold">Total Revenue</TableHead>
                        <TableHead className="text-xs text-center">Avg Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {annualIndividualSummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                            Belum ada target untuk tahun {selYear}.
                          </TableCell>
                        </TableRow>
                      ) : annualIndividualSummary
                        .filter(u => selSegment === 'ALL' || Object.keys(u.segments).includes(selSegment))
                        .map((u, idx) => (
                        <TableRow key={u.user_id}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{u.full_name}</TableCell>
                          {SEGMENTS.map(s => (
                            <TableCell key={s} className="text-xs text-center">{u.segments[s] ? formatIDR(u.segments[s]) : '-'}</TableCell>
                          ))}
                          <TableCell className="text-xs text-center font-bold">{formatIDR(u.totalRevenue)}</TableCell>
                          <TableCell className="text-xs text-center">{u.avgMargin.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Target Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Tambah Revenue Target</DialogTitle>
            <DialogDescription className="text-xs">Pilih user dan segment untuk {monthLabel(monthStr)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Segment</Label>
              <Select value={addSegment} onValueChange={setAddSegment}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">User</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih user..." /></SelectTrigger>
                <SelectContent>
                  {availableUsers.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Batal</Button>
            <Button size="sm" onClick={handleAdd}>Tambah</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog (monthly) */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Import Revenue Targets</DialogTitle>
            <DialogDescription className="text-xs">
              Format: <code className="bg-muted px-1 rounded">email, segment, revenue_target, margin_target</code>
            </DialogDescription>
          </DialogHeader>
          <Textarea className="min-h-[150px] text-xs font-mono" placeholder={`john@co.com, B2B, 500000000, 17.5`}
            value={importText} onChange={e => setImportText(e.target.value)} />
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => { setShowImport(false); setImportText(''); }}>Batal</Button>
            <Button size="sm" onClick={handleImport}><Upload className="h-3 w-3 mr-1" /> Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Import Dialog (multi-month) */}
      <Dialog open={showTemplateImport} onOpenChange={setShowTemplateImport}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Import dari Template CSV</DialogTitle>
            <DialogDescription className="text-xs">
              Paste data CSV dengan format: <code className="bg-muted px-1 rounded">Email, Nama, Segment, Bulan (YYYY-MM), Revenue Target, Margin Target (%)</code>
              <br />
              <span className="text-muted-foreground mt-1 inline-block">
                Tip: Download "Template Kosong" terlebih dahulu, isi datanya, lalu paste di sini. Header akan otomatis dilewati.
                Data yang sudah ada akan di-update (upsert).
              </span>
            </DialogDescription>
          </DialogHeader>
          <Textarea className="min-h-[200px] text-xs font-mono" 
            placeholder={`Email,Nama,Segment,Bulan (YYYY-MM),Revenue Target,Margin Target (%)\njohn@co.com,John Doe,B2B,${selYear}-01,500000000,17.5\njohn@co.com,John Doe,B2B,${selYear}-02,600000000,18.0`}
            value={templateImportText} onChange={e => setTemplateImportText(e.target.value)} />
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => { setShowTemplateImport(false); setTemplateImportText(''); }}>Batal</Button>
            <Button size="sm" onClick={handleTemplateImport} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
              Import Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
