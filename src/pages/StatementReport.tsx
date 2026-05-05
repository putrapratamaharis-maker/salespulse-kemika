import { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Search, Calendar as CalendarIcon, FolderOpen, Loader2, Copy, Download, Printer, ArrowLeft, Info, ChevronDown, FileSpreadsheet, FileText as FilePdf, FileDown, Filter, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
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

  // Hanging filter (applied on the generated Report Overview table)
  const [tableFilterOpen, setTableFilterOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [tableSalesFilter, setTableSalesFilter] = useState<string>('all');

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

  const salesNameById = (id: string | null | undefined) => {
    if (!id) return '-';
    return salesProfiles.find(s => s.user_id === id)?.full_name || '-';
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
      'Segment': inv.segment, 'Sales': salesNameById(inv.sales_id), 'Status': inv.paid_date ? 'Paid' : 'Unpaid',
    }));
    return { type: 'revenue-summary', name: `Revenue Summary`, columns: ['Invoice #', 'Issue Date', 'Net Sales', 'Gross Profit', 'Segment', 'Sales', 'Status'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'Revenue Summary', period: selectedPeriod, segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
  };

  const generatePipelineStatus = async (from: string, to: string): Promise<GeneratedReport> => {
    let query = supabase.from('deals').select('name, stage, value, probability, expected_close_date, segment, days_in_stage, sales_id')
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
      'Segment': d.segment, 'Sales': salesNameById((d as any).sales_id), 'Days in Stage': d.days_in_stage,
    }));
    return { type: 'pipeline-status', name: `Pipeline Status`, columns: ['Deal Name', 'Stage', 'Value', 'Probability', 'Expected Close', 'Segment', 'Sales', 'Days in Stage'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'Pipeline Status', period: selectedPeriod, segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
  };

  const generateActivityLog = async (from: string, to: string): Promise<GeneratedReport> => {
    let query = supabase.from('sales_activities').select('type, activity_date, notes, outcome, purpose, sales_id')
      .gte('activity_date', from).lte('activity_date', to);
    const salesF = buildSalesFilter();
    if (salesF) query = query.eq('sales_id', salesF);
    const { data, error } = await query.order('activity_date', { ascending: false });
    if (error) throw error;
    const rows = (data || []).map(a => ({
      'Date': a.activity_date, 'Sales': salesNameById((a as any).sales_id), 'Type': a.type, 'Purpose': a.purpose || '-',
      'Outcome': a.outcome || '-', 'Notes': a.notes || '-',
    }));
    return { type: 'activity-log', name: `Activity Log`, columns: ['Date', 'Sales', 'Type', 'Purpose', 'Outcome', 'Notes'], rows, generatedAt: new Date().toISOString(), filters: { reportType: 'Activity Log', period: selectedPeriod, segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
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
    const rows2 = (data || []).map((inv, i) => ({ ...rows[i], 'Sales': salesNameById((inv as any).sales_id) }));
    return { type: 'ar-aging', name: `AR Aging Report`, columns: ['Invoice #', 'Net Sales', 'Issue Date', 'Due Date', 'Overdue Days', 'Aging', 'Segment', 'Sales'], rows: rows2, generatedAt: new Date().toISOString(), filters: { reportType: 'AR Aging Report', period: '-', segment: getSegmentName(selectedSegment), salesPerson: getSalesName(selectedSales), dateFrom: formatDateDisplay(dateRange.from), dateTo: formatDateDisplay(dateRange.to) } };
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
    if (['Net Sales', 'Gross Profit', 'Value', 'Revenue'].includes(col)) {
      return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(val));
    }
    return String(val);
  };

  // Apply hanging filter to the generated rows
  const displayedRows = useMemo(() => {
    if (!previewReport) return [];
    const q = tableSearch.trim().toLowerCase();
    const salesName = tableSalesFilter === 'all' ? null : getSalesName(tableSalesFilter);
    return previewReport.rows.filter(row => {
      if (salesName && previewReport.columns.includes('Sales')) {
        if (String(row['Sales'] ?? '').toLowerCase() !== salesName.toLowerCase()) return false;
      }
      if (q) {
        return previewReport.columns.some(col => String(row[col] ?? '').toLowerCase().includes(q));
      }
      return true;
    });
  }, [previewReport, tableSearch, tableSalesFilter, salesProfiles]);

  const tableFilterActive = tableSearch.trim() !== '' || tableSalesFilter !== 'all';

  // --- Action handlers ---
  const handleCopyTable = () => {
    if (!previewReport) return;
    const header = previewReport.columns.join('\t');
    const body = previewReport.rows.map(row => previewReport.columns.map(col => formatCellValue(col, row[col])).join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
    toast({ title: 'Tabel berhasil disalin', description: 'Data tabel telah disalin ke clipboard.' });
  };

  const uploadAndSaveHistory = async (blob: Blob, fileName: string, fileFormat: string) => {
    if (!user || !previewReport) return;
    const storagePath = `${user.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('report-files')
      .upload(storagePath, blob, { upsert: true });
    
    let fileUrl: string | null = null;
    if (!uploadError) {
      const { data: signedData } = await supabase.storage
        .from('report-files')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year
      fileUrl = signedData?.signedUrl || null;
    }

    await supabase.from('download_history' as any).insert({
      user_id: user.id,
      report_type: previewReport.type,
      report_name: previewReport.name,
      file_format: fileFormat,
      file_name: fileName,
      filters: previewReport.filters as any,
      record_count: previewReport.rows.length,
      file_url: fileUrl,
    } as any);
  };

  const handleDownloadCSV = async () => {
    if (!previewReport) return;
    const header = previewReport.columns.join(',');
    const body = previewReport.rows.map(row => previewReport.columns.map(col => {
      const v = formatCellValue(col, row[col]);
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',')).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = `${previewReport.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    await uploadAndSaveHistory(blob, fileName, 'csv');
    toast({ title: 'Download dimulai', description: 'File CSV sedang diunduh.' });
  };

  const handleDownloadXLSX = async () => {
    if (!previewReport) return;
    const wsData = [previewReport.columns, ...previewReport.rows.map(row => previewReport.columns.map(col => formatCellValue(col, row[col])))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const fileName = `${previewReport.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    XLSX.writeFile(wb, fileName);
    await uploadAndSaveHistory(blob, fileName, 'xlsx');
    toast({ title: 'Download dimulai', description: 'File XLSX sedang diunduh.' });
  };

  const handleDownloadPDF = async () => {
    if (!previewReport) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(previewReport.name, 14, 15);
    doc.setFontSize(9);
    doc.text(`Period: ${previewReport.filters.dateFrom} — ${previewReport.filters.dateTo} | Segment: ${previewReport.filters.segment} | Sales: ${previewReport.filters.salesPerson}`, 14, 22);
    doc.text(`Generated: ${format(new Date(previewReport.generatedAt), 'dd MMM yyyy HH:mm', { locale: idLocale })} | Records: ${previewReport.rows.length}`, 14, 27);
    const tableBody = previewReport.rows.map((row, i) => [String(i + 1), ...previewReport.columns.map(col => formatCellValue(col, row[col]))]);
    autoTable(doc, {
      head: [['#', ...previewReport.columns]],
      body: tableBody,
      startY: 32,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    const fileName = `${previewReport.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(fileName);
    const pdfBlob = doc.output('blob');
    await uploadAndSaveHistory(pdfBlob, fileName, 'pdf');
    toast({ title: 'Download dimulai', description: 'File PDF sedang diunduh.' });
  };

  const handlePrint = () => {
    window.print();
  };

  // --- Single page layout: filters + report overview ---
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

      {/* Report Overview */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Report Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {!previewReport ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-2xl bg-muted/60 flex items-center justify-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No Report Generated Yet</h3>
              <p className="text-sm text-muted-foreground">Generate a report to see your transaction statements!</p>
            </div>
          ) : (
            <div className="space-y-6 print:space-y-4">
              {/* Report Information */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-primary" />
                  Report Information
                </h4>
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
              </div>

              {/* Report Table */}
              <div className="flex flex-wrap items-center gap-2 mb-2 print:hidden">
                  <Badge variant="outline" className="font-normal text-xs">
                    Menampilkan {displayedRows.length.toLocaleString('id-ID')}
                    {tableFilterActive ? ` dari ${previewReport.rows.length.toLocaleString('id-ID')}` : ''} data
                  </Badge>
                  {tableFilterActive && <span className="text-xs text-muted-foreground">Filter aktif:</span>}
                  {tableSearch.trim() !== '' && (
                    <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                      <span className="text-xs">Search: "{tableSearch.trim()}"</span>
                      <button
                        type="button"
                        onClick={() => setTableSearch('')}
                        className="ml-1 rounded-full hover:bg-background/60 p-0.5"
                        aria-label="Hapus filter pencarian"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {tableSalesFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                      <span className="text-xs">Sales: {getSalesName(tableSalesFilter)}</span>
                      <button
                        type="button"
                        onClick={() => setTableSalesFilter('all')}
                        className="ml-1 rounded-full hover:bg-background/60 p-0.5"
                        aria-label="Hapus filter sales"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {tableFilterActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => { setTableSearch(''); setTableSalesFilter('all'); }}
                    >
                      Hapus semua
                    </Button>
                  )}
              </div>
              <div ref={tableRef} className="relative rounded-md border overflow-auto max-h-[500px]">
                {/* Hanging filter button */}
                <div className="sticky top-2 z-20 flex justify-end pr-2 pointer-events-none print:hidden">
                  <Popover open={tableFilterOpen} onOpenChange={setTableFilterOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={tableFilterActive ? 'default' : 'outline'}
                        size="sm"
                        className="pointer-events-auto shadow-md h-8"
                      >
                        <Filter className="h-4 w-4 mr-1.5" />
                        Filter{tableFilterActive ? ` (${displayedRows.length}/${previewReport.rows.length})` : ''}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Search</Label>
                        <Input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Cari di semua kolom..." className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Sales</Label>
                        <Select value={tableSalesFilter} onValueChange={setTableSalesFilter}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sales</SelectItem>
                            {salesProfiles.map(sp => (<SelectItem key={sp.user_id} value={sp.user_id}>{sp.full_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-between pt-1">
                        <Button variant="ghost" size="sm" onClick={() => { setTableSearch(''); setTableSalesFilter('all'); }}>
                          <X className="h-3.5 w-3.5 mr-1" /> Reset
                        </Button>
                        <Button size="sm" onClick={() => setTableFilterOpen(false)}>Tutup</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap w-[50px] sticky top-0 bg-card z-10">#</TableHead>
                      {previewReport.columns.map(col => (
                        <TableHead key={col} className="text-xs whitespace-normal break-words align-top max-w-[200px] sticky top-0 bg-card z-10">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={previewReport.columns.length + 1} className="text-center text-sm text-muted-foreground py-8">
                          Tidak ada data untuk filter yang dipilih.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedRows.map((row, rIdx) => (
                        <TableRow key={rIdx}>
                          <TableCell className="text-sm text-muted-foreground">{rIdx + 1}</TableCell>
                          {previewReport.columns.map(col => (
                            <TableCell key={col} className="text-sm whitespace-normal break-words align-top max-w-[240px]">
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
              <Separator className="print:hidden" />
              <div className="flex justify-end gap-3 print:hidden">
                <Button variant="outline" size="sm" onClick={handleCopyTable}>
                  <Copy className="h-4 w-4 mr-1.5" /> Copy Table
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1.5" /> Download <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownloadXLSX}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownloadPDF}>
                      <FilePdf className="h-4 w-4 mr-2" /> PDF (.pdf)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownloadCSV}>
                      <FileDown className="h-4 w-4 mr-2" /> CSV (.csv)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
