import { useState } from 'react';
import { FileText, Download, Calendar, Filter, FileSpreadsheet, File } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const reportTypes = [
  { id: 'revenue-summary', name: 'Revenue Summary', description: 'Ringkasan revenue per bulan & segment', category: 'Revenue' },
  { id: 'pipeline-status', name: 'Pipeline Status', description: 'Status semua deals di pipeline', category: 'Pipeline' },
  { id: 'activity-log', name: 'Activity Log', description: 'Log aktivitas sales per periode', category: 'Activity' },
  { id: 'kpi-scorecard', name: 'KPI Scorecard', description: 'Scorecard KPI bulanan per sales', category: 'KPI' },
  { id: 'ar-aging', name: 'AR Aging Report', description: 'Aging piutang berdasarkan tanggal jatuh tempo', category: 'Finance' },
  { id: 'product-sales', name: 'Product Sales Report', description: 'Performa penjualan per produk', category: 'Product' },
];

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const handleGenerate = (reportId: string) => {
    const report = reportTypes.find(r => r.id === reportId);
    toast({
      title: 'Report sedang digenerate',
      description: `${report?.name} untuk ${months[Number(selectedMonth)]} ${selectedYear} sedang diproses. Cek di Download Manager.`,
    });
  };

  const handleDownload = (item: DownloadItem) => {
    toast({ title: 'Mengunduh...', description: `${item.name}.${item.format}` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground">Generate dan unduh laporan penjualan</p>
      </div>

      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">
            <FileText className="h-4 w-4 mr-1" /> Statement Report
          </TabsTrigger>
          <TabsTrigger value="downloads">
            <Download className="h-4 w-4 mr-1" /> Download Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statement" className="mt-4 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Bulan</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tahun</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[100px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map(report => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{report.category}</Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold mt-2">{report.name}</CardTitle>
                  <CardDescription className="text-xs">{report.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => handleGenerate(report.id)}>
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => handleGenerate(report.id)}>
                      <FilePdf className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="downloads" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Riwayat Download</CardTitle>
              <CardDescription className="text-xs">File report yang sudah digenerate</CardDescription>
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
                        {item.status === 'ready' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Ready</Badge>}
                        {item.status === 'generating' && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Generating...</Badge>}
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
