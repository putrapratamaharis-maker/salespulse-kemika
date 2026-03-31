import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, FileText, Eye, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_fields: string[] | null;
  changed_by: string | null;
  changed_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

const TABLE_LABELS: Record<string, string> = {
  accounts: 'Akun / Customer',
  products: 'Produk',
  product_categories: 'Kategori Produk',
  units: 'Satuan Unit',
  profiles: 'Profil User',
  user_roles: 'User Roles',
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'border-emerald-500 text-emerald-600 bg-emerald-50',
  UPDATE: 'border-blue-500 text-blue-600 bg-blue-50',
  DELETE: 'border-red-500 text-red-600 bg-red-50',
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Tambah',
  UPDATE: 'Ubah',
  DELETE: 'Hapus',
};

export default function AuditLog() {
  const { userRole } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTable, setFilterTable] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detailLog, setDetailLog] = useState<AuditEntry | null>(null);

  const isSuperAdmin = userRole?.system_role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchData();
  }, [isSuperAdmin]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: logData }, { data: profileData }] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(1000),
      supabase.from('profiles').select('user_id, full_name, email'),
    ]);
    setLogs((logData as any[]) || []);
    setProfiles((profileData as Profile[]) || []);
    setLoading(false);
  };

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach(p => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const getUserName = (userId: string | null) => {
    if (!userId) return 'System';
    const p = profileMap.get(userId);
    return p?.full_name || p?.email || userId.slice(0, 8) + '...';
  };

  const getRecordLabel = (log: AuditEntry) => {
    const data = log.new_data || log.old_data;
    if (!data) return log.record_id.slice(0, 8);
    return data.name || data.full_name || data.kpi_name || data.template_name || data.product_name || data.customer_id || log.record_id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterTable !== 'all' && l.table_name !== filterTable) return false;
      if (filterAction !== 'all' && l.action !== filterAction) return false;
      if (search) {
        const s = search.toLowerCase();
        const label = getRecordLabel(l).toLowerCase();
        const user = getUserName(l.changed_by).toLowerCase();
        const table = (TABLE_LABELS[l.table_name] || l.table_name).toLowerCase();
        if (!label.includes(s) && !user.includes(s) && !table.includes(s)) return false;
      }
      return true;
    });
  }, [logs, filterTable, filterAction, search, profileMap]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const paginated = pageSize === 0 ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [search, filterTable, filterAction, pageSize]);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Halaman ini hanya dapat diakses oleh Super Admin.</p>
      </div>
    );
  }

  const renderChangedFields = (log: AuditEntry) => {
    if (log.action !== 'UPDATE' || !log.changed_fields?.length) return null;
    const displayFields = log.changed_fields.filter(f => !['updated_at', 'created_at'].includes(f));
    if (displayFields.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {displayFields.slice(0, 3).map(f => (
          <Badge key={f} variant="outline" className="text-[9px] font-mono">{f}</Badge>
        ))}
        {displayFields.length > 3 && (
          <Badge variant="outline" className="text-[9px]">+{displayFields.length - 3}</Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Audit Log
        </h2>
        <p className="text-sm text-muted-foreground">Riwayat perubahan data master oleh admin</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" /> Log Perubahan
              <Badge variant="secondary" className="text-[10px] ml-1">{filtered.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 text-sm pl-8"
                  placeholder="Cari nama, user..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger className="h-9 w-44 text-sm">
                  <SelectValue placeholder="Semua Tabel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tabel</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="h-9 w-32 text-sm">
                  <SelectValue placeholder="Semua Aksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Aksi</SelectItem>
                  <SelectItem value="INSERT">Tambah</SelectItem>
                  <SelectItem value="UPDATE">Ubah</SelectItem>
                  <SelectItem value="DELETE">Hapus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {logs.length === 0 ? 'Belum ada log perubahan.' : 'Tidak ada log yang cocok dengan filter.'}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-40">Waktu</TableHead>
                    <TableHead className="text-xs">Tabel</TableHead>
                    <TableHead className="text-xs">Aksi</TableHead>
                    <TableHead className="text-xs">Record</TableHead>
                    <TableHead className="text-xs">Field Berubah</TableHead>
                    <TableHead className="text-xs">Diubah Oleh</TableHead>
                    <TableHead className="text-xs text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.changed_at), 'dd MMM yyyy HH:mm', { locale: idLocale })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {TABLE_LABELS[log.table_name] || log.table_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${ACTION_COLORS[log.action] || ''}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">
                        {getRecordLabel(log)}
                      </TableCell>
                      <TableCell>{renderChangedFields(log)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getUserName(log.changed_by)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                    <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100, 0].map(s => (
                        <SelectItem key={s} value={String(s)}>{s === 0 ? 'All' : s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {filtered.length > 0 ? `${(currentPage - 1) * (pageSize || filtered.length) + 1}–${Math.min(currentPage * (pageSize || filtered.length), filtered.length)} of ${filtered.length}` : '0'}
                  </span>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={open => !open && setDetailLog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Detail Perubahan
              {detailLog && (
                <Badge variant="outline" className={`text-[10px] ${ACTION_COLORS[detailLog.action] || ''}`}>
                  {ACTION_LABELS[detailLog.action] || detailLog.action}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Tabel</span>
                    <p className="font-medium">{TABLE_LABELS[detailLog.table_name] || detailLog.table_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Waktu</span>
                    <p className="font-medium">{format(new Date(detailLog.changed_at), 'dd MMMM yyyy, HH:mm:ss', { locale: idLocale })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Record</span>
                    <p className="font-medium">{getRecordLabel(detailLog)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Diubah Oleh</span>
                    <p className="font-medium">{getUserName(detailLog.changed_by)}</p>
                  </div>
                </div>

                {/* Changed fields detail for UPDATE */}
                {detailLog.action === 'UPDATE' && detailLog.changed_fields && detailLog.changed_fields.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Perubahan Field</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Field</TableHead>
                          <TableHead className="text-xs">Sebelum</TableHead>
                          <TableHead className="text-xs">Sesudah</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailLog.changed_fields
                          .filter(f => !['updated_at', 'created_at'].includes(f))
                          .map(field => (
                          <TableRow key={field}>
                            <TableCell className="font-mono text-xs font-semibold">{field}</TableCell>
                            <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                              {JSON.stringify(detailLog.old_data?.[field]) ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-emerald-600 max-w-[200px] truncate">
                              {JSON.stringify(detailLog.new_data?.[field]) ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Full data for INSERT/DELETE */}
                {(detailLog.action === 'INSERT' || detailLog.action === 'DELETE') && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      {detailLog.action === 'INSERT' ? 'Data Baru' : 'Data Dihapus'}
                    </h4>
                    <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-64 font-mono">
                      {JSON.stringify(detailLog.action === 'INSERT' ? detailLog.new_data : detailLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
