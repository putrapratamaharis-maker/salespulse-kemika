import { useEffect, useState, useMemo } from 'react';
import { Download, Search, SlidersHorizontal, Trash2, Loader2, CalendarIcon, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

export default function DownloadManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('download_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) {
      setHistory(data as unknown as DownloadRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const filtered = useMemo(() => {
    let items = history;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.file_name.toLowerCase().includes(q) ||
        i.report_name.toLowerCase().includes(q) ||
        i.report_type.toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      const fromStr = format(dateFrom, 'yyyy-MM-dd');
      items = items.filter(i => i.created_at.slice(0, 10) >= fromStr);
    }
    if (dateTo) {
      const toStr = format(dateTo, 'yyyy-MM-dd');
      items = items.filter(i => i.created_at.slice(0, 10) <= toStr);
    }
    return items;
  }, [history, search, dateFrom, dateTo]);

  const pageSize = parseInt(entriesPerPage) || 10;
  const displayed = filtered.slice(0, pageSize);

  const allSelected = displayed.length > 0 && displayed.every(d => selectedIds.has(d.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayed.map(d => d.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await supabase.from('download_history').delete().eq('id', id);
    }
    setHistory(prev => prev.filter(h => !selectedIds.has(h.id)));
    setSelectedIds(new Set());
    toast({ title: `${ids.length} riwayat dihapus` });
  };

  const formatReportType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Download Manager</h2>
        <p className="text-sm text-muted-foreground">Set automatic reports and view list of all your downloaded report.</p>
      </div>

      <Button variant="outline" size="sm" className="gap-1.5">
        <Clock className="h-4 w-4" />
        Set Auto Report
      </Button>

      <Card>
        <Tabs defaultValue="download">
          <div className="border-b px-4 pt-2">
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              <TabsTrigger value="download" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 text-sm font-medium">
                Download Manager
              </TabsTrigger>
              <TabsTrigger value="auto" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 text-sm font-medium">
                Auto Report Manager
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="download" className="m-0">
            <CardContent className="pt-4">
              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by report name"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  <SlidersHorizontal className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-1 border rounded-md px-3 py-2 text-sm">
                  <Popover open={fromOpen} onOpenChange={setFromOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-sm hover:text-primary transition-colors whitespace-nowrap">
                        {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'Start Date'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={d => { setDateFrom(d ?? undefined); setFromOpen(false); }} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground mx-1">→</span>
                  <Popover open={toOpen} onOpenChange={setToOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-sm hover:text-primary transition-colors whitespace-nowrap">
                        {dateTo ? format(dateTo, 'dd MMM yyyy') : 'End Date'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={d => { setDateTo(d ?? undefined); setToOpen(false); }} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground ml-1" />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm font-medium">Show</span>
                  <Select value={entriesPerPage} onValueChange={setEntriesPerPage}>
                    <SelectTrigger className="w-[70px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm">Entries</span>
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                    <Download className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Belum ada riwayat download</h3>
                  <p className="text-xs text-muted-foreground">Generate report terlebih dahulu dari Statement Report.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[40px]">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                        </TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">Report Name</TableHead>
                        <TableHead className="text-xs font-semibold">Request Date</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Report Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayed.map(item => (
                        <TableRow key={item.id} className={cn(selectedIds.has(item.id) && 'bg-muted/30')}>
                          <TableCell>
                            <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleOne(item.id)} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] border-green-300 text-green-700 bg-green-50">
                              Complete
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            <span className="truncate max-w-[400px] block">{item.file_name}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm:ss', { locale: idLocale })} (GMT +7)
                          </TableCell>
                          <TableCell className="text-sm text-right">{formatReportType(item.report_type)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </TabsContent>

          <TabsContent value="auto" className="m-0">
            <CardContent className="py-16">
              <div className="text-center text-sm text-muted-foreground">
                Fitur Auto Report Manager akan segera hadir.
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Bottom Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-xl shadow-lg px-6 py-3 flex items-center gap-4 min-w-[340px]">
          <span className="text-sm font-medium">{selectedIds.size} Selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5" onClick={handleDeleteSelected}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
