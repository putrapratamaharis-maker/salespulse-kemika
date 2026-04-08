import { useState, useEffect } from 'react';
import { FileText, Download, Search, Calendar, FolderOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const reportTypes = [
  { id: 'revenue-summary', name: 'Revenue Summary' },
  { id: 'pipeline-status', name: 'Pipeline Status' },
  { id: 'activity-log', name: 'Activity Log' },
  { id: 'kpi-scorecard', name: 'KPI Scorecard' },
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

interface DownloadItem {
  id: string;
  name: string;
  format: 'xlsx' | 'pdf';
  generatedAt: string;
  status: 'ready' | 'generating' | 'failed';
  size: string;
}

const sampleDownloads: DownloadItem[] = [
  { id: '1', name: 'Revenue Summary - Mar 2026', format: 'xlsx', generatedAt: '2026-04-07 14:30', status: 'ready', size: '245 KB' },
  { id: '2', name: 'Pipeline Status - Q1 2026', format: 'pdf', generatedAt: '2026-04-06 09:15', status: 'ready', size: '1.2 MB' },
  { id: '3', name: 'KPI Scorecard - Mar 2026', format: 'xlsx', generatedAt: '2026-04-05 16:45', status: 'ready', size: '180 KB' },
  { id: '4', name: 'AR Aging Report - Apr 2026', format: 'pdf', generatedAt: '2026-04-08 08:00', status: 'generating', size: '-' },
];

export default function Reports() {
  const { toast } = useToast();
  const [selectedReportType, setSelectedReportType] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('last-month');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedSales, setSelectedSales] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedReports] = useState<any[]>([]);
  const [salesProfiles, setSalesProfiles] = useState<{ user_id: string; full_name: string }[]>([]);

  useEffect(() => {
    supabase.rpc('get_active_sales_profiles').then(({ data }) => {
      if (data) setSalesProfiles(data);
    });
  }, []);

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = now;

  const formatDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`;

  const handleGenerate = () => {
    if (!selectedReportType) {
      toast({ title: 'Pilih Report Type', description: 'Silakan pilih jenis report terlebih dahulu.', variant: 'destructive' });
      return;
    }
    const report = reportTypes.find(r => r.id === selectedReportType);
    toast({
      title: 'Report sedang digenerate',
      description: `${report?.name} sedang diproses. Cek di Download Manager.`,
    });
  };

  const handleClearFilter = () => {
    setSelectedReportType('');
    setSelectedPeriod('last-month');
    setSelectedSegment('all');
    setSelectedSales('all');
  };

  const handleDownload = (item: DownloadItem) => {
    toast({ title: 'Mengunduh...', description: `${item.name}.${item.format}` });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">
            <FileText className="h-4 w-4 mr-1" /> Statement Report
          </TabsTrigger>
          <TabsTrigger value="downloads">
            <Download className="h-4 w-4 mr-1" /> Download Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statement" className="mt-4 space-y-6">
          {/* Header */}
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
                {/* Report Type */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-foreground">Report Type</Label>
                  <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      {reportTypes.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Period */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-foreground">Period</Label>
                  <div className="flex gap-2">
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="h-10 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periodOptions.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 flex-1 rounded-md border border-input bg-background px-3 h-10 text-sm text-muted-foreground">
                      <span>{formatDate(startDate)}</span>
                      <span>→</span>
                      <span>{formatDate(endDate)}</span>
                      <Calendar className="h-4 w-4 ml-auto text-muted-foreground" />
                    </div>
                  </div>
                </div>

                {/* Segment */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-foreground">Segment</Label>
                  <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {segmentOptions.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sales Person */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-foreground">Sales Person</Label>
                  <Select value={selectedSales} onValueChange={setSelectedSales}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={handleClearFilter}>
                  Clear Filter
                </Button>
                <Button onClick={handleGenerate}>
                  Generate Report
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Report Overview Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Report Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search & Date */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by report name"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-10 text-sm text-muted-foreground shrink-0">
                  <span>{formatDate(startDate)}</span>
                  <span>→</span>
                  <span>{formatDate(endDate)}</span>
                  <Calendar className="h-4 w-4 ml-2" />
                </div>
              </div>

              {/* Empty State */}
              {generatedReports.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-2xl bg-muted/60 flex items-center justify-center">
                      <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">No Report Generated Yet</h3>
                  <p className="text-sm text-muted-foreground">Generate a report to see your transaction statements!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Download Manager Tab */}
        <TabsContent value="downloads" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Riwayat Download</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Report</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Ukuran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleDownloads.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-sm">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{item.format}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.generatedAt}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.size}</TableCell>
                      <TableCell>
                        {item.status === 'ready' && <Badge className="bg-primary/10 text-primary text-[10px]">Ready</Badge>}
                        {item.status === 'generating' && <Badge className="bg-accent/50 text-accent-foreground text-[10px]">Generating...</Badge>}
                        {item.status === 'failed' && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={item.status !== 'ready'}
                          onClick={() => handleDownload(item)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" /> Unduh
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
