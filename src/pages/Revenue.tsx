import { useState, useEffect, useMemo } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDRFull, formatNumIDR, formatPercent } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Percent, TrendingUp, CreditCard, Loader2, MoreVertical, Pencil, Trash2, Download, Search, Trophy } from 'lucide-react';
import NewInvoiceDialog from '@/components/invoices/NewInvoiceDialog';
import EditInvoiceDialog from '@/components/invoices/EditInvoiceDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  net_sales: number;
  gross_profit: number;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  segment: string;
  account_name?: string;
  sales_name?: string;
}

interface DealRow {
  value: number;
  segment: string;
  expected_close_date: string;
}

const MONTHS = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
  { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

const Revenue = () => {
  const [loading, setLoading] = useState(true);
  const [allInvoices, setAllInvoices] = useState<InvoiceRow[]>([]);
  const [allDeals, setAllDeals] = useState<DealRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editInvoice, setEditInvoice] = useState<InvoiceRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  const fetchInvoices = async () => {
    setLoading(true);

    const [invoiceRes, accountsRes, dealsRes, profilesRes] = await Promise.all([
      supabase.rpc('get_segment_invoices'),
      supabase.from('accounts').select('id, name'),
      supabase.rpc('get_all_deals_pipeline'),
      supabase.rpc('get_active_sales_profiles'),
    ]);

    const accountMap = new Map((accountsRes.data || []).map((a: any) => [a.id, a.name]));
    const salesMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.full_name]));

    const allInv = (invoiceRes.data || [])
      .sort((a: any, b: any) => (b.issue_date || '').localeCompare(a.issue_date || ''))
      .map((row: any) => ({
        id: row.id,
        invoice_number: row.invoice_number,
        net_sales: row.net_sales,
        gross_profit: row.gross_profit,
        issue_date: row.issue_date,
        due_date: row.due_date,
        paid_date: row.paid_date,
        segment: row.segment,
        account_name: accountMap.get(row.account_id) || '',
        sales_name: salesMap.get(row.sales_id) || '',
      }));
    setAllInvoices(allInv);

    const wonDeals = (dealsRes.data || [])
      .filter((d: any) => ['po_secured', 'invoice_issued'].includes(d.stage))
      .map((d: any) => ({
        value: Number(d.value) || 0,
        segment: d.segment || '',
        expected_close_date: d.expected_close_date || '',
      }));
    setAllDeals(wonDeals);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [refreshKey]);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set(allInvoices.map(i => i.issue_date.slice(0, 4)));
    return Array.from(years).sort().reverse();
  }, [allInvoices]);

  // Filtered invoices
  const invoices = useMemo(() => {
    let filtered = allInvoices;

    if (filterYear !== 'all') {
      filtered = filtered.filter(i => i.issue_date.startsWith(filterYear));
    }
    if (filterMonth !== 'all') {
      filtered = filtered.filter(i => i.issue_date.slice(5, 7) === filterMonth);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.invoice_number.toLowerCase().includes(q) ||
        (i.account_name || '').toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allInvoices, filterYear, filterMonth, searchQuery]);

  // Filtered deals (using expected_close_date / PO/Won/Closed Date)
  const filteredDeals = useMemo(() => {
    let filtered = allDeals.filter(d => d.expected_close_date);
    if (filterYear !== 'all') {
      filtered = filtered.filter(d => d.expected_close_date.startsWith(filterYear));
    }
    if (filterMonth !== 'all') {
      filtered = filtered.filter(d => d.expected_close_date.slice(5, 7) === filterMonth);
    }
    return filtered;
  }, [allDeals, filterYear, filterMonth]);

  const totalWon = filteredDeals.reduce((s, d) => s + d.value, 0);
  const totalRevenue = invoices.reduce((s, i) => s + i.net_sales, 0);
  const totalGP = invoices.reduce((s, i) => s + i.gross_profit, 0);
  const marginPct = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
  const compliantInvoices = invoices.filter(i => i.net_sales > 0 && (i.gross_profit / i.net_sales) * 100 >= 17).length;
  const marginCompliance = invoices.length > 0 ? (compliantInvoices / invoices.length) * 100 : 0;

  // Build trend from invoice data grouped by month
  const monthlyMap = new Map<string, number>();
  invoices.forEach(inv => {
    const month = inv.issue_date.slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + inv.net_sales);
  });
  const trendData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ month, total: total / 1_000_000 }));

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus invoice ini?')) return;
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) { toast.error('Gagal menghapus: ' + error.message); return; }
    toast.success('Invoice dihapus');
    setRefreshKey(k => k + 1);
  };

  const exportData = (type: 'xlsx' | 'csv') => {
    const rows = invoices.map(inv => ({
      'Invoice #': inv.invoice_number,
      'Account': inv.account_name || '',
      'Net Sales': inv.net_sales,
      'Gross Profit': inv.gross_profit,
      'Margin %': inv.net_sales > 0 ? +((inv.gross_profit / inv.net_sales) * 100).toFixed(2) : 0,
      'Segment': inv.segment,
      'Issue Date': inv.issue_date,
      'Due Date': inv.due_date,
      'Paid Date': inv.paid_date || '',
      'Status': inv.paid_date ? 'Paid' : 'Outstanding',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices.${type}`);
    toast.success(`Exported as ${type.toUpperCase()}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Revenue & Margin</h2>
          <p className="text-sm text-muted-foreground">Financial performance and margin compliance</p>
        </div>
        <NewInvoiceDialog onCreated={() => setRefreshKey(k => k + 1)} />
      </div>

      {/* Period Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tahun</SelectItem>
            {availableYears.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Bulan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Bulan</SelectItem>
            {MONTHS.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nomor invoice atau nama akun..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Total Revenue by Invoice" value={formatIDRFull(totalRevenue)} change={14.2} changeLabel="vs last month" icon={DollarSign} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" tooltip="Total net_sales dari seluruh invoice berdasarkan filter periode dan segment" />
        <KPICard label="TOTAL REVENUE (WON)" value={formatIDRFull(totalWon)} icon={Trophy} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" tooltip="Gabungan nilai deals pada tahap PO Secured dan Invoice Issued dari pipeline" />
        <KPICard label="Gross Profit" value={formatIDRFull(totalGP)} icon={TrendingUp} autoFitText className="bg-kpi-emerald " borderAccent="border-l-kpi-emerald-border" tooltip="Total gross_profit dari seluruh invoice berdasarkan filter" />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} autoFitText className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" tooltip="Gross Profit ÷ Total Revenue × 100%. Threshold hijau ≥ 17%" />
        <KPICard label="Margin Compliance" value={formatPercent(marginCompliance)} status={marginCompliance >= 80 ? 'green' : 'yellow'} icon={CreditCard} autoFitText className="bg-kpi-purple " borderAccent="border-l-kpi-purple-border" tooltip="Persentase invoice yang memiliki margin ≥ 17% dari total invoice" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue Trend (in Millions)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--accent))', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Invoice Details
            {invoices.length !== allInvoices.length && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({invoices.length} dari {allInvoices.length})
              </span>
            )}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportData('xlsx')}>Export Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData('csv')}>Export CSV (.csv)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Invoice #</TableHead>
                <TableHead className="text-xs">Account Name</TableHead>
                <TableHead className="text-xs">Sales</TableHead>
                <TableHead className="text-xs">Net Sales (Rp)</TableHead>
                <TableHead className="text-xs">Gross Profit (Rp)</TableHead>
                <TableHead className="text-xs">Margin %</TableHead>
                <TableHead className="text-xs">Segment</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Tidak ada invoice ditemukan
                  </TableCell>
                </TableRow>
              )}
              {invoices.map(inv => {
                const m = inv.net_sales > 0 ? (inv.gross_profit / inv.net_sales) * 100 : 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.account_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.sales_name}</TableCell>
                    <TableCell className="text-sm">{formatNumIDR(inv.net_sales)}</TableCell>
                    <TableCell className="text-sm">{formatNumIDR(inv.gross_profit)}</TableCell>
                    <TableCell><StatusBadge status={m >= 17 ? 'green' : 'red'} label={formatPercent(m)} /></TableCell>
                    <TableCell className="text-sm">{inv.segment}</TableCell>
                    <TableCell>{inv.paid_date ? <StatusBadge status="green" label="Paid" /> : <StatusBadge status="yellow" label="Outstanding" />}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditInvoice(inv); setEditOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(inv.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditInvoiceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        invoice={editInvoice}
        onUpdated={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
};

export default Revenue;
