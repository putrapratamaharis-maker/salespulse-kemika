import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Play, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);
const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface KPIResult {
  user_id: string;
  full_name: string;
  total_score: number;
  status: string;
  calculated_at: string;
  kpi_count: number;
}

export function KPICalculationEngine() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<KPIResult[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCalculation() {
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-kpi', {
        body: { year: selYear, month: selMonth },
      });

      if (error) throw error;

      toast({
        title: 'Kalkulasi Selesai ✓',
        description: data.message,
      });

      setLastRun(new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
      await loadResults();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Gagal menjalankan kalkulasi KPI',
        variant: 'destructive',
      });
    } finally {
      setCalculating(false);
    }
  }

  async function loadResults() {
    setLoading(true);
    try {
      // Get totals
      const { data: totals } = await supabase
        .from('kpi_total_score_monthly')
        .select('*')
        .eq('year', selYear)
        .eq('month', selMonth)
        .order('total_score', { ascending: false });

      // Get result counts per user
      const { data: resultCounts } = await supabase
        .from('kpi_results_monthly')
        .select('user_id')
        .eq('year', selYear)
        .eq('month', selMonth);

      // Get profile names
      const userIds = (totals || []).map(t => t.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds.length > 0 ? userIds : ['none']);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      // Count KPIs per user
      const countMap = new Map<string, number>();
      for (const r of (resultCounts || [])) {
        countMap.set(r.user_id, (countMap.get(r.user_id) || 0) + 1);
      }

      const mapped: KPIResult[] = (totals || []).map(t => ({
        user_id: t.user_id,
        full_name: profileMap.get(t.user_id) || '—',
        total_score: Number(t.total_score),
        status: t.status as string,
        calculated_at: t.calculated_at,
        kpi_count: countMap.get(t.user_id) || 0,
      }));

      setResults(mapped);
      if (mapped.length > 0) {
        setLastRun(new Date(mapped[0].calculated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'EXCELLENT':
        return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">Excellent</Badge>;
      case 'ON_TRACK':
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">On Track</Badge>;
      default:
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Need Improvement</Badge>;
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            KPI Calculation Engine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Tahun</Label>
              <Select value={String(selYear)} onValueChange={v => setSelYear(Number(v))}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Bulan</Label>
              <Select value={String(selMonth)} onValueChange={v => setSelMonth(Number(v))}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={runCalculation}
              disabled={calculating}
              className="gap-1"
            >
              {calculating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {calculating ? 'Menghitung...' : 'Hitung KPI'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadResults}
              disabled={loading}
              className="gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Muat Hasil
            </Button>
          </div>

          {lastRun && (
            <p className="text-xs text-muted-foreground">
              Kalkulasi terakhir: {lastRun}
            </p>
          )}

          {/* Results Table */}
          {results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Nama</TableHead>
                  <TableHead className="text-xs text-right">Total Score</TableHead>
                  <TableHead className="text-xs text-center">KPI Items</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, idx) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="text-sm">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-sm text-right font-mono font-semibold">
                      {r.total_score.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-sm text-center">{r.kpi_count}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Belum ada hasil kalkulasi untuk periode ini.</p>
              <p className="text-xs">Klik "Hitung KPI" untuk menjalankan kalkulasi.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
