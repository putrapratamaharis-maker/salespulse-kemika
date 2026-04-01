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
import { Loader2, Save, Upload, Download, Plus, Trash2, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  month: string; // YYYY-MM
  revenue_target: number;
  margin_target: number;
  dirty: boolean;
  isNew: boolean;
}

interface SegmentSummary {
  segment: string;
  totalRevenue: number;
  totalMargin: number;
  count: number;
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selSegment, setSelSegment] = useState<string>('ALL');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addSegment, setAddSegment] = useState('B2B');

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // ─── Load profiles ─────────────────────────────────────────
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email, segment').eq('is_active', true).order('full_name');
      setProfiles(data || []);
    }
    loadProfiles();
  }, []);

  // ─── Load targets ─────────────────────────────────────────
  const monthStr = `${selYear}-${String(selMonth).padStart(2, '0')}`;

  const loadTargets = useCallback(async () => {
    setLoading(true);
    const query = supabase.from('targets').select('*').eq('month', monthStr);
    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Map to rows with profile info
    const rows: TargetRow[] = (data || []).map((t: any) => {
      const profile = profiles.find(p => p.user_id === t.user_id);
      return {
        id: t.id,
        user_id: t.user_id,
        full_name: profile?.full_name || t.user_id,
        segment: t.segment,
        month: t.month,
        revenue_target: t.revenue_target || 0,
        margin_target: t.margin_target || 0,
        dirty: false,
        isNew: false,
      };
    });

    setTargets(rows);
    setLoading(false);
  }, [monthStr, profiles, toast]);

  useEffect(() => {
    if (profiles.length > 0) loadTargets();
  }, [loadTargets, profiles.length]);

  // ─── Filtered rows ────────────────────────────────────────
  const filteredTargets = useMemo(() => {
    if (selSegment === 'ALL') return targets;
    return targets.filter(t => t.segment === selSegment);
  }, [targets, selSegment]);

  // ─── Summaries ────────────────────────────────────────────
  const summaries = useMemo((): SegmentSummary[] => {
    const map: Record<string, SegmentSummary> = {};
    targets.forEach(t => {
      if (!map[t.segment]) map[t.segment] = { segment: t.segment, totalRevenue: 0, totalMargin: 0, count: 0 };
      map[t.segment].totalRevenue += t.revenue_target;
      map[t.segment].totalMargin += t.margin_target;
      map[t.segment].count += 1;
    });
    return SEGMENTS.map(s => map[s] || { segment: s, totalRevenue: 0, totalMargin: 0, count: 0 });
  }, [targets]);

  const grandTotal = useMemo(() => ({
    revenue: targets.reduce((s, t) => s + t.revenue_target, 0),
    margin: targets.length > 0 ? targets.reduce((s, t) => s + t.margin_target, 0) / targets.length : 0,
    count: targets.length,
  }), [targets]);

  // ─── Edit handlers ────────────────────────────────────────
  const updateField = (idx: number, field: 'revenue_target' | 'margin_target', value: number) => {
    setTargets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value, dirty: true } : t));
  };

  const removeRow = (idx: number) => {
    setTargets(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Add target ───────────────────────────────────────────
  const handleAdd = () => {
    if (!addUserId) {
      toast({ title: 'Pilih user', variant: 'destructive' });
      return;
    }
    // Check duplicate
    const exists = targets.find(t => t.user_id === addUserId && t.segment === addSegment);
    if (exists) {
      toast({ title: 'Duplikat', description: 'Target untuk user & segment ini sudah ada', variant: 'destructive' });
      return;
    }
    const profile = profiles.find(p => p.user_id === addUserId);
    setTargets(prev => [...prev, {
      id: null,
      user_id: addUserId,
      full_name: profile?.full_name || '',
      segment: addSegment,
      month: monthStr,
      revenue_target: 0,
      margin_target: 0,
      dirty: true,
      isNew: true,
    }]);
    setShowAddForm(false);
    setAddUserId('');
  };

  // ─── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    const dirtyRows = targets.filter(t => t.dirty);
    if (dirtyRows.length === 0) {
      toast({ title: 'Tidak ada perubahan' });
      return;
    }
    setSaving(true);

    for (const row of dirtyRows) {
      if (row.isNew || !row.id) {
        const { error } = await supabase.from('targets').insert({
          user_id: row.user_id,
          segment: row.segment,
          month: row.month,
          revenue_target: row.revenue_target,
          margin_target: row.margin_target,
        });
        if (error) {
          toast({ title: 'Error insert', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase.from('targets').update({
          revenue_target: row.revenue_target,
          margin_target: row.margin_target,
        }).eq('id', row.id);
        if (error) {
          toast({ title: 'Error update', description: error.message, variant: 'destructive' });
          setSaving(false);
          return;
        }
      }
    }

    toast({ title: 'Tersimpan', description: `${dirtyRows.length} target berhasil disimpan` });
    setSaving(false);
    loadTargets();
  };

  // ─── Delete ───────────────────────────────────────────────
  const handleDelete = async (row: TargetRow, idx: number) => {
    if (row.id) {
      const { error } = await supabase.from('targets').delete().eq('id', row.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }
    removeRow(idx);
    toast({ title: 'Dihapus' });
  };

  // ─── Bulk import ──────────────────────────────────────────
  const handleImport = async () => {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      toast({ title: 'Data kosong', variant: 'destructive' });
      return;
    }

    let imported = 0;
    let errors = 0;

    for (const line of lines) {
      const cols = line.split(/[,\t;]/).map(c => c.trim());
      // Format: email, segment, revenue_target, margin_target
      if (cols.length < 4) { errors++; continue; }

      const [email, segment, revStr, marginStr] = cols;
      const profile = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      if (!profile) { errors++; continue; }
      if (!SEGMENTS.includes(segment)) { errors++; continue; }

      const revenue = parseFloat(revStr);
      const margin = parseFloat(marginStr);
      if (isNaN(revenue) || isNaN(margin)) { errors++; continue; }

      // Check duplicate in current targets
      const existing = targets.find(t => t.user_id === profile.user_id && t.segment === segment);
      if (existing) {
        // Update existing
        setTargets(prev => prev.map(t =>
          t.user_id === profile.user_id && t.segment === segment
            ? { ...t, revenue_target: revenue, margin_target: margin, dirty: true }
            : t
        ));
      } else {
        setTargets(prev => [...prev, {
          id: null,
          user_id: profile.user_id,
          full_name: profile.full_name,
          segment,
          month: monthStr,
          revenue_target: revenue,
          margin_target: margin,
          dirty: true,
          isNew: true,
        }]);
      }
      imported++;
    }

    toast({
      title: 'Import selesai',
      description: `${imported} baris berhasil, ${errors} baris error`,
      variant: errors > 0 ? 'destructive' : 'default',
    });
    setShowImport(false);
    setImportText('');
  };

  // ─── Export CSV ───────────────────────────────────────────
  const handleExport = () => {
    const header = 'Email,Segment,Revenue Target,Margin Target';
    const rows = targets.map(t => {
      const profile = profiles.find(p => p.user_id === t.user_id);
      return `${profile?.email || ''},${t.segment},${t.revenue_target},${t.margin_target}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue_targets_${monthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Available users for add ──────────────────────────────
  const availableUsers = useMemo(() => {
    return profiles.filter(p => !targets.find(t => t.user_id === p.user_id && t.segment === addSegment));
  }, [profiles, targets, addSegment]);

  const dirtyCount = targets.filter(t => t.dirty).length;

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summaries.map(s => (
          <Card key={s.segment} className="border-l-4 border-l-primary/50">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> {s.segment}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-sm font-bold text-foreground">{formatIDR(s.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Margin avg: {s.count > 0 ? (s.totalMargin / s.count).toFixed(1) : 0}% · {s.count} user</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> TOTAL
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-sm font-bold text-foreground">{formatIDR(grandTotal.revenue)}</p>
            <p className="text-xs text-muted-foreground">Margin avg: {grandTotal.margin.toFixed(1)}% · {grandTotal.count} entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Revenue Targets — {monthLabel(monthStr)}
            </CardTitle>
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
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter Row */}
          <div className="flex flex-wrap gap-3 mb-4">
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
            <div className="space-y-1">
              <Label className="text-xs">Bulan</Label>
              <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthNames.map((n, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
                  ) : (
                    filteredTargets.map((row, idx) => {
                      const realIdx = targets.indexOf(row);
                      return (
                        <TableRow key={`${row.user_id}-${row.segment}`} className={row.dirty ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{row.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{row.segment}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-7 text-xs w-full"
                              value={row.revenue_target || ''}
                              onChange={e => updateField(realIdx, 'revenue_target', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-7 text-xs w-full"
                              value={row.margin_target || ''}
                              onChange={e => updateField(realIdx, 'margin_target', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              step="0.1"
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(row, realIdx)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Target Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Tambah Revenue Target</DialogTitle>
            <DialogDescription className="text-xs">Pilih user dan segment untuk menambahkan target baru pada {monthLabel(monthStr)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Segment</Label>
              <Select value={addSegment} onValueChange={setAddSegment}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
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

      {/* Bulk Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Import Revenue Targets</DialogTitle>
            <DialogDescription className="text-xs">
              Paste data CSV dengan format: <code className="bg-muted px-1 rounded">email, segment, revenue_target, margin_target</code>
              <br />Contoh: <code className="bg-muted px-1 rounded text-[10px]">john@company.com, B2B, 500000000, 17.5</code>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-[150px] text-xs font-mono"
            placeholder={`john@company.com, B2B, 500000000, 17.5\njane@company.com, B2G, 750000000, 20`}
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => { setShowImport(false); setImportText(''); }}>Batal</Button>
            <Button size="sm" onClick={handleImport}>
              <Upload className="h-3 w-3 mr-1" /> Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
