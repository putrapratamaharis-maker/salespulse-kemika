import { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Search, Calendar as CalendarIcon, FolderOpen, Loader2, Copy, Download, Printer, ArrowLeft, Info, ChevronDown, FileSpreadsheet, FileText as FilePdf, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatIDR } from '@/types/sales';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const reportTypes = [
  { id: 'revenue-summary', name: 'Revenue Summary' },
  { id: 'pipeline-status', name: 'Pipeline Status' },
  { id: 'activity-log', name: 'Activity Log' },
  { id: 'ar-aging', name: 'AR Aging Report' },
  { id: 'product-sales', name: 'Product Sales Report' },
];

const periodOptions = [
  { id: 'this-month', name: 'This Month' },
  { id: 'last-month', name: 'Last Month' },
  { id: 'this-quarter', name: 'This Quarter' },
  { id: 'last-quarter', name: 'Last Quarter' },
  { id: 'this-year', name: 'This Year' },
  { id: 'custom', name: 'Custom' },
];

const segmentOptions = [
  { id: 'all', name: 'All Segments' },
  { id: 'B2G', name: 'B2G' },
  { id: 'B2B', name: 'B2B' },
  { id: 'B2C', name: 'B2C' },
];

function computeDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case 'this-month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last-month': {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'this-quarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'last-quarter': {
      const prevQ = subQuarters(now, 1);
      return { from: startOfQuarter(prevQ), to: endOfQuarter(prevQ) };
    }
    case 'this-year':
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfMonth(now), to: now };
  }
}

interface ReportRow {
  [key: string]: string | number | null;
}

interface GeneratedReport {
  type: string;
  name: string;
  columns: string[];
  rows: ReportRow[];
  generatedAt: string;
  filters: {
    reportType: string;
    period: string;
    segment: string;
    salesPerson: string;
    dateFrom: string;
    dateTo: string;
  };
}

export default function StatementReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedReportType, setSelectedReportType] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('last-month');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedSales, setSelectedSales] = useState('all');
  const [salesProfiles, setSalesProfiles] = useState<{ user_id: string; full_name: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewReport, setPreviewReport] = useState<GeneratedReport | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(computeDateRange('last-month'));
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  useEffect(() => {
    supabase.rpc('get_active_sales_profiles').then(({ data }) => {
      if (data) setSalesProfiles(data);
    });
  }, []);

  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      setDateRange(computeDateRange(selectedPeriod));
    }
  }, [selectedPeriod]);

  const formatDateDisplay = (d: Date) => format(d, 'dd MMM yyyy', { locale: idLocale });

  const handleClearFilter = () => {
    setSelectedReportType('');
    setSelectedPeriod('last-month');
    setSelectedSegment('all');
    setSelectedSales('all');
    setDateRange(computeDateRange('last-month'));
  };

  const buildSegmentFilter = () => selectedSegment !== 'all' ? selectedSegment : null;
  const buildSalesFilter = () => selectedSales !== 'all' ? selectedSales : null;

  const getSalesName = (id: string) => {
    if (id === 'all') return 'All Sales';
    return salesProfiles.find(s => s.user_id === id)?.full_name || id;
  };

  const getSegmentName = (id: string) => {
    return segmentOptions.find(s => s.id === id)?.name || id;
  };

  const getReportTypeName = (id: string) => {
    return reportTypes.find(r => r.id === id)?.name || id;
  };

  // --- Report generators ---
  const generateRevenueSummary = async (from: string, to: string): Promise<GeneratedReport> => {
    let query = supabase.from('invoices').select('invoice_number, net_sales, gross_profit, issue_date, segment, account_id, sales_id, paid_date')
      .gte('issue_date', from).lte('issue_date', to);
    const seg = buildSegmentFilter();
    if (seg) query = query.eq('segment', seg);
    const salesF = buildSalesFilter();
    if (salesF) query = query.eq('sales_id', salesF);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []).map(inv => ({
      'Invoice #': inv.invoice_number, 'Issue Date': inv.issue_date,
      'Net Sales': inv.net_sales, 'Gross Profit': inv.gross_profit,
      'Segment': inv.segment, 'Status': inv.paid_date ? 'Paid' : 'Unpaid',
    }));
    return { type: 'revenue-summary', name: `Revenue Summary`, columns: ['Invoice #', 'Issue Date', 'Net Sales', 'Gross Profit', 'Segment', 'Status'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'Revenue Summary', period: selectedPeriod, segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
  };

  const generatePipelineStatus = async (from: string, to: string): Promise<GeneratedReport> => {
    let query = supabase.from('deals').select('name, stage, value, probability, expected_close_date, segment, days_in_stage')
      .gte('expected_close_date', from).lte('expected_close_date', to);
    const seg = buildSegmentFilter();
    if (seg) query = query.eq('segment', seg);
    const salesF = buildSalesFilter();
    if (salesF) query = query.eq('sales_id', salesF);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []).map(d => ({
      'Deal Name': d.name, 'Stage': d.stage, 'Value': d.value,
      'Probability': `${d.probability}%`, 'Expected Close': d.expected_close_date,
      'Segment': d.segment, 'Days in Stage': d.days_in_stage,
    }));
    return { type: 'pipeline-status', name: `Pipeline Status`, columns: ['Deal Name', 'Stage', 'Value', 'Probability', 'Expected Close', 'Segment', 'Days in Stage'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'Pipeline Status', period: selectedPeriod, segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
  };

  const generateActivityLog = async (from: string, to: string): Promise<GeneratedReport> => {
    let query = supabase.from('sales_activities').select('type, activity_date, notes, outcome, purpose')
      .gte('activity_date', from).lte('activity_date', to);
    const salesF = buildSalesFilter();
    if (salesF) query = query.eq('sales_id', salesF);
    const { data, error } = await query.order('activity_date', { ascending: false });
    if (error) throw error;
    const rows = (data || []).map(a => ({
      'Date': a.activity_date, 'Type': a.type, 'Purpose': a.purpose || '-',
      'Outcome': a.outcome || '-', 'Notes': a.notes || '-',
    }));
    return { type: 'activity-log', name: `Activity Log`, columns: ['Date', 'Type', 'Purpose', 'Outcome', 'Notes'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'Activity Log', period: selectedPeriod, segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
  };

  const generateARAging = async (): Promise<GeneratedReport> => {
    let query = supabase.from('invoices').select('invoice_number, net_sales, issue_date, due_date, paid_date, segment, sales_id')
      .is('paid_date', null);
    const seg = buildSegmentFilter();
    if (seg) query = query.eq('segment', seg);
    const salesF = buildSalesFilter();
    if (salesF) query = query.eq('sales_id', salesF);
    const { data, error } = await query;
    if (error) throw error;
    const today = new Date();
    const rows = (data || []).map(inv => {
      const due = new Date(inv.due_date);
      const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      let aging = 'Current';
      if (diffDays > 90) aging = '> 90 days';
      else if (diffDays > 60) aging = '61-90 days';
      else if (diffDays > 30) aging = '31-60 days';
      else if (diffDays > 0) aging = '1-30 days';
      return { 'Invoice #': inv.invoice_number, 'Net Sales': inv.net_sales, 'Issue Date': inv.issue_date, 'Due Date': inv.due_date, 'Overdue Days': Math.max(0, diffDays), 'Aging': aging, 'Segment': inv.segment };
    });
    return { type: 'ar-aging', name: `AR Aging Report`, columns: ['Invoice #', 'Net Sales', 'Issue Date', 'Due Date', 'Overdue Days', 'Aging', 'Segment'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'AR Aging Report', period: '-', segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
  };

  const generateProductSales = async (from: string, to: string): Promise<GeneratedReport> => {
    let query = supabase.from('product_sales').select('month, revenue, units_sold, segment, product_id, products(name)')
      .gte('month', from.slice(0, 7)).lte('month', to.slice(0, 7));
    const seg = buildSegmentFilter();
    if (seg) query = query.eq('segment', seg);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []).map((ps: any) => ({
      'Product': ps.products?.name || '-', 'Month': ps.month,
      'Units Sold': ps.units_sold, 'Revenue': ps.revenue, 'Segment': ps.segment || '-',
    }));
    return { type: 'product-sales', name: `Product Sales`, columns: ['Product', 'Month', 'Units Sold', 'Revenue', 'Segment'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'Product Sales Report', period: selectedPeriod, segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
  };

  const handleGenerate = async () => {
    if (!selectedReportType) {
      toast({ title: 'Pilih Report Type', description: 'Silakan pilih jenis report terlebih dahulu.', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    const fromStr = format(dateRange.from, 'yyyy-MM-dd');
    const toStr = format(dateRange.to, 'yyyy-MM-dd');
    try {
      let report: GeneratedReport | null = null;
      switch (selectedReportType) {
        case 'revenue-summary': report = await generateRevenueSummary(fromStr, toStr); break;
        case 'pipeline-status': report = await generatePipelineStatus(fromStr, toStr); break;
        case 'activity-log': report = await generateActivityLog(fromStr, toStr); break;
        case 'ar-aging': report = await generateARAging(); break;
        case 'product-sales': report = await generateProductSales(fromStr, toStr); break;
      }
      if (report) {
        setPreviewReport(report);
        toast({ title: 'Report berhasil digenerate', description: `${report.name} siap ditampilkan.` });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Gagal generate report', description: 'Terjadi kesalahan saat mengambil data.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCellValue = (col: string, val: any) => {
    if (val === null || val === undefined) return '-';
    if (['Net Sales', 'Gross Profit', 'Value', 'Revenue'].includes(col)) return formatIDR(Number(val));
    return String(val);
  };

  // --- Action handlers ---
  const handleCopyTable = () => {
    if (!previewReport) return;
    const header = previewReport.columns.join('\t');
    const body = previewReport.rows.map(row => previewReport.columns.map(col => formatCellValue(col, row[col])).join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
    toast({ title: 'Tabel berhasil disalin', description: 'Data tabel telah disalin ke clipboard.' });
  };

  const handleDownload = () => {
    if (!previewReport) return;
    const header = previewReport.columns.join(',');
    const body = previewReport.rows.map(row => previewReport.columns.map(col => {
      const v = formatCellValue(col, row[col]);
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',')).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${previewReport.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Download dimulai', description: 'File CSV sedang diunduh.' });
  };

  const handlePrint = () => {
    window.print();
  };

  // --- Preview Mode ---
  if (previewReport) {
    return (
      <div className="space-y-6 print:space-y-4">
        {/* Back button */}
        <div className="flex items-center gap-3 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => setPreviewReport(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">Report Preview</h2>
            <p className="text-sm text-muted-foreground">Preview hasil report yang telah digenerate</p>
          </div>
        </div>

        {/* Report Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Report Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Report Type</span>
                <p className="font-medium text-foreground">{previewReport.filters.reportType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Period</span>
                <p className="font-medium text-foreground">{previewReport.filters.dateFrom} — {previewReport.filters.dateTo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Segment</span>
                <p className="font-medium text-foreground">{previewReport.filters.segment}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sales Person</span>
                <p className="font-medium text-foreground">{previewReport.filters.salesPerson}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Generated At</span>
                <p className="font-medium text-foreground">{format(new Date(previewReport.generatedAt), 'dd MMM yyyy HH:mm', { locale: idLocale })}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Records</span>
                <p className="font-medium text-foreground">{previewReport.rows.length} records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{previewReport.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={tableRef} className="rounded-md border overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap w-[50px]">#</TableHead>
                    {previewReport.columns.map(col => (
                      <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewReport.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={previewReport.columns.length + 1} className="text-center text-sm text-muted-foreground py-8">
                        Tidak ada data untuk filter yang dipilih.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewReport.rows.map((row, rIdx) => (
                      <TableRow key={rIdx}>
                        <TableCell className="text-sm text-muted-foreground">{rIdx + 1}</TableCell>
                        {previewReport.columns.map(col => (
                          <TableCell key={col} className="text-sm whitespace-nowrap">
                            {formatCellValue(col, row[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Action Buttons */}
            <Separator className="my-4 print:hidden" />
            <div className="flex justify-end gap-3 print:hidden">
              <Button variant="outline" size="sm" onClick={handleCopyTable}>
                <Copy className="h-4 w-4 mr-1.5" /> Copy Table
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1.5" /> Download
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1.5" /> Print
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Filter Mode ---
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Statement Report</h2>
        <p className="text-sm text-muted-foreground">Generate a report compiling your revenue, pipeline, or activity history.</p>
      </div>

      {/* Report Filter Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-foreground">Report Type</Label>
              <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select report type" /></SelectTrigger>
                <SelectContent>
                  {reportTypes.map(r => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-foreground">Period</Label>
              <div className="flex gap-2">
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="h-10 w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {periodOptions.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 flex-1">
                  <Popover open={fromOpen} onOpenChange={setFromOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-10 flex-1 justify-start text-left text-sm font-normal", selectedPeriod !== 'custom' && "opacity-60 cursor-default")} disabled={selectedPeriod !== 'custom'}>
                        {formatDateDisplay(dateRange.from)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateRange.from} onSelect={(d) => { if (d) { setDateRange(prev => ({ ...prev, from: d })); setFromOpen(false); } }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground text-sm">→</span>
                  <Popover open={toOpen} onOpenChange={setToOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("h-10 flex-1 justify-start text-left text-sm font-normal", selectedPeriod !== 'custom' && "opacity-60 cursor-default")} disabled={selectedPeriod !== 'custom'}>
                        {formatDateDisplay(dateRange.to)}
                        <CalendarIcon className="h-4 w-4 ml-auto text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateRange.to} onSelect={(d) => { if (d) { setDateRange(prev => ({ ...prev, to: d })); setToOpen(false); } }} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-foreground">Segment</Label>
              <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {segmentOptions.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-foreground">Sales Person</Label>
              <Select value={selectedSales} onValueChange={setSelectedSales}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales</SelectItem>
                  {salesProfiles.map(sp => (<SelectItem key={sp.user_id} value={sp.user_id}>{sp.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClearFilter}>Clear Filter</Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Overview - Empty State */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Report Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-2xl bg-muted/60 flex items-center justify-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">No Report Generated Yet</h3>
            <p className="text-sm text-muted-foreground">Generate a report to see your transaction statements!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
