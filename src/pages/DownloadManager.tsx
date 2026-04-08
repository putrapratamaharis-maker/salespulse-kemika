import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, FileDown, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DownloadRecord {
  id: string;
  report_type: string;
  report_name: string;
  file_format: string;
  file_name: string;
  filters: Record<string, string>;
  record_count: number;
  created_at: string;
}

const formatIcon = (fmt: string) => {
  switch (fmt) {
    case 'xlsx': return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
    default: return <FileDown className="h-4 w-4 text-blue-500" />;
  }
};

const formatBadgeVariant = (fmt: string) => {
  switch (fmt) {
    case 'xlsx': return 'default';
    case 'pdf': return 'destructive';
    default: return 'secondary';
  }
};

export default function DownloadManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('download_history' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) {
      setHistory(data as any as DownloadRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('download_history' as any).delete().eq('id', id);
    if (!error) {
      setHistory(prev => prev.filter(h => h.id !== id));
      toast({ title: 'Riwayat dihapus' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Download Manager</h2>
        <p className="text-sm text-muted-foreground">Riwayat report yang pernah di-download.</p>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Riwayat Download</CardTitle>
          <span className="text-sm text-muted-foreground">{history.length} records</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-24 h-24 rounded-2xl bg-muted/60 flex items-center justify-center mb-6">
                <Download className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Belum ada riwayat download</h3>
              <p className="text-sm text-muted-foreground">Generate report terlebih dahulu, lalu download dari Statement Report.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[40px]">#</TableHead>
                    <TableHead className="text-xs">File Name</TableHead>
                    <TableHead className="text-xs">Report Type</TableHead>
                    <TableHead className="text-xs">Format</TableHead>
                    <TableHead className="text-xs text-right">Records</TableHead>
                    <TableHead className="text-xs">Period</TableHead>
                    <TableHead className="text-xs">Downloaded At</TableHead>
                    <TableHead className="text-xs w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {formatIcon(item.file_format)}
                          <span className="truncate max-w-[200px]">{item.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{item.report_name}</TableCell>
                      <TableCell>
                        <Badge variant={formatBadgeVariant(item.file_format) as any} className="uppercase text-[10px]">
                          {item.file_format}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right">{item.record_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {item.filters?.dateFrom && item.filters?.dateTo
                          ? `${item.filters.dateFrom} — ${item.filters.dateTo}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
