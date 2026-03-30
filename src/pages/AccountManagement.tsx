import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Building2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Upload, Download, FileText, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Account {
  id: string;
  customer_id: string;
  name: string;
  segment: string;
  region: string;
  type: string;
  sales_id: string;
  created_at: string;
  pic_name: string;
  pic_contact: string;
  pic_email: string;
  status: string;
}

const TYPES = ['Corporate', 'Government', 'SME', 'Individual', 'Distributor', 'NGO', 'Others'];
const STATUSES = ['Active', 'Non-Active'];
const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
  'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Barat', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya',
];

export default function AccountManagement() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState<keyof Account | ''>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const pageSize = 15;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPicName, setFormPicName] = useState('');
  const [formPicContact, setFormPicContact] = useState('');
  const [formPicEmail, setFormPicEmail] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formType, setFormType] = useState('Corporate');
  const [formStatus, setFormStatus] = useState('Active');

  const generateCustomerId = () => {
    const year = new Date().getFullYear();
    const existingIds = accounts
      .map(a => a.customer_id)
      .filter(id => id?.startsWith(`CUST${year}-`))
      .map(id => parseInt(id.replace(`CUST${year}-`, ''), 10))
      .filter(n => !isNaN(n));
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    return `CUST${year}-${String(nextNum).padStart(4, '0')}`;
  };

  const allowedRoles = ['super_admin', 'admin', 'staff'];
  const hasAccess = userRole && allowedRoles.includes(userRole.system_role);

  const fetchAccounts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name');
    if (error) {
      toast({ title: 'Gagal memuat akun', description: error.message, variant: 'destructive' });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, [user]);

  const openCreate = () => {
    setEditingAccount(null);
    setFormCustomerId(generateCustomerId());
    setFormName('');
    setFormPicName('');
    setFormPicContact('');
    setFormPicEmail('');
    setFormRegion('');
    setFormType('Corporate');
    setFormStatus('Active');
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingAccount(acc);
    setFormCustomerId(acc.customer_id || '');
    setFormName(acc.name);
    setFormPicName(acc.pic_name || '');
    setFormPicContact(acc.pic_contact || '');
    setFormPicEmail(acc.pic_email || '');
    setFormRegion(acc.region);
    setFormType(acc.type);
    setFormStatus(acc.status || 'Active');
    setDialogOpen(true);
  };

  const openDelete = (acc: Account) => {
    setDeletingAccount(acc);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: 'Nama akun wajib diisi', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setSaving(true);

    const payload = {
      customer_id: formCustomerId.trim(),
      name: formName.trim(),
      pic_name: formPicName.trim(),
      pic_contact: formPicContact.trim(),
      pic_email: formPicEmail.trim(),
      region: formRegion,
      type: formType,
      status: formStatus,
    };

    if (editingAccount) {
      const { error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('id', editingAccount.id);
      if (error) {
        toast({ title: 'Gagal mengupdate', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Akun berhasil diupdate' });
        setDialogOpen(false);
        fetchAccounts();
      }
    } else {
      const { error } = await supabase
        .from('accounts')
        .insert({ ...payload, sales_id: user.id });
      if (error) {
        toast({ title: 'Gagal menambahkan', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Akun berhasil ditambahkan' });
        setDialogOpen(false);
        fetchAccounts();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    setSaving(true);
    const { error } = await supabase.from('accounts').delete().eq('id', deletingAccount.id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Akun berhasil dihapus' });
      setDeleteDialogOpen(false);
      selectedIds.delete(deletingAccount.id);
      setSelectedIds(new Set(selectedIds));
      fetchAccounts();
    }
    setSaving(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    const { error } = await supabase.from('accounts').delete().in('id', Array.from(selectedIds));
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selectedIds.size} akun berhasil dihapus` });
      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
      fetchAccounts();
    }
    setSaving(false);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (paginatedAccounts.every(a => selectedIds.has(a.id))) {
      const next = new Set(selectedIds);
      paginatedAccounts.forEach(a => next.delete(a.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginatedAccounts.forEach(a => next.add(a.id));
      setSelectedIds(next);
    }
  };

  // --- Import / Export ---
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Customer ID', 'Nama Akun*', 'Nama PIC', 'Nomor Contact', 'Email', 'Tipe', 'Region (Provinsi)', 'Status'],
      ['CUST2026-0101', 'PT Contoh', 'Budi Santoso', '081234567890', 'budi@contoh.com', 'Corporate', 'DKI Jakarta', 'Active'],
    ]);
    ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
    XLSX.writeFile(wb, 'template_import_akun.xlsx');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const dataRows = rows.slice(1).filter(r => r[0]?.toString().trim());
      if (dataRows.length === 0) {
        toast({ title: 'File kosong', description: 'Tidak ada data akun ditemukan.', variant: 'destructive' });
        setImporting(false);
        return;
      }
      const validTypes = new Set(TYPES.map(t => t.toLowerCase()));
      const validProvinces = new Set(PROVINCES.map(p => p.toLowerCase()));
      let nextId = (() => {
        const year = new Date().getFullYear();
        const existingIds = accounts
          .map(a => a.customer_id)
          .filter(id => id?.startsWith(`CUST${year}-`))
          .map(id => parseInt(id.replace(`CUST${year}-`, ''), 10))
          .filter(n => !isNaN(n));
        return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
      })();
      const payloads = dataRows.map(row => {
        const customerId = row[0]?.toString().trim() || `CUST${new Date().getFullYear()}-${String(nextId++).padStart(4, '0')}`;
        const name = row[1]?.toString().trim() || '';
        const picName = row[2]?.toString().trim() || '';
        const picContact = row[3]?.toString().trim() || '';
        const picEmail = row[4]?.toString().trim() || '';
        const typeRaw = row[5]?.toString().trim() || 'Corporate';
        const regionRaw = row[6]?.toString().trim() || '';
        const statusRaw = row[7]?.toString().trim() || 'Active';
        const type = TYPES.find(t => t.toLowerCase() === typeRaw.toLowerCase()) || 'Corporate';
        const region = PROVINCES.find(p => p.toLowerCase() === regionRaw.toLowerCase()) || regionRaw;
        const status = statusRaw.toLowerCase() === 'non-active' || statusRaw.toLowerCase() === 'non-aktif' || statusRaw.toLowerCase() === 'inactive' ? 'Non-Active' : 'Active';
        return { customer_id: customerId, name, pic_name: picName, pic_contact: picContact, pic_email: picEmail, type, region, status, sales_id: user.id };
      }).filter(p => p.name);

      const { error, data: inserted } = await supabase.from('accounts').insert(payloads).select();
      if (error) {
        toast({ title: 'Import gagal', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Import berhasil', description: `${inserted?.length || payloads.length} akun ditambahkan.` });
        fetchAccounts();
      }
    } catch (err: any) {
      toast({ title: 'Error membaca file', description: err.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  const exportExcel = () => {
    const exportData = filtered.map(a => ({
      'Customer ID': a.customer_id || '',
      'Nama Akun': a.name,
      'Nama PIC': a.pic_name || '',
      'Nomor Contact': a.pic_contact || '',
      'Email': a.pic_email || '',
      'Tipe': a.type,
      'Region': a.region || '',
      'Status': a.status || 'Active',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
    XLSX.writeFile(wb, `data_akun_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Export berhasil', description: `${exportData.length} akun diekspor ke Excel.` });
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Data Akun Pelanggan', 14, 15);
    doc.setFontSize(8);
    doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} | Total: ${filtered.length} akun`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['No', 'Customer ID', 'Nama Akun', 'Nama PIC', 'Nomor Contact', 'Email', 'Tipe', 'Region', 'Status']],
      body: filtered.map((a, i) => [
        i + 1,
        a.customer_id || '-',
        a.name,
        a.pic_name || '-',
        a.pic_contact || '-',
        a.pic_email || '-',
        a.type,
        a.region || '-',
        a.status || 'Active',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], fontSize: 7 },
    });

    doc.save(`data_akun_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: 'Export berhasil', description: `${filtered.length} akun diekspor ke PDF.` });
  };

  const usedRegions = [...new Set(accounts.map(a => a.region).filter(Boolean))].sort();
  const usedTypes = [...new Set(accounts.map(a => a.type).filter(Boolean))].sort();

  const filtered = accounts.filter(a => {
    const matchesSearch = search === '' ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.region.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()) ||
      (a.pic_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (a.status || 'Active') === filterStatus;
    const matchesRegion = filterRegion === 'all' || a.region === filterRegion;
    const matchesType = filterType === 'all' || a.type === filterType;
    return matchesSearch && matchesStatus && matchesRegion && matchesType;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    const valA = (a[sortCol] || '').toString().toLowerCase();
    const valB = (b[sortCol] || '').toString().toLowerCase();
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAccounts = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (col: keyof Account) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: keyof Account }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterRegion, filterType]);

  const statusColor = (s: string) => {
    if (s === 'Active') return 'bg-green-500/10 text-green-700 border-green-200';
    return 'bg-red-500/10 text-red-700 border-red-200';
  };

  if (authLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">Memuat...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground">Halaman ini hanya dapat diakses oleh Super Admin, Admin, dan Staff.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manajemen Akun</h1>
          <p className="text-sm text-muted-foreground">Kelola daftar pelanggan & prospek Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Template
          </Button>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={importing} />
            <Button variant="outline" size="sm" asChild disabled={importing}>
              <span>{importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Import</span>
            </Button>
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-1" /> Ekspor
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportExcel}>
                <Download className="h-4 w-4 mr-2" /> Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf}>
                <FileText className="h-4 w-4 mr-2" /> Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Tambah Akun
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Daftar Akun ({filtered.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari akun..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Region</SelectItem>
                {usedRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterStatus !== 'all' || filterRegion !== 'all' || filterType !== 'all') && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterStatus('all'); setFilterRegion('all'); setFilterType('all'); }}>
                Reset Filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b">
              <span className="text-sm font-medium text-destructive">{selectedIds.size} akun dipilih</span>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setBulkDeleteDialogOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus Terpilih
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                Batal Pilih
              </Button>
            </div>
          )}
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {accounts.length === 0 ? 'Belum ada akun. Klik "Tambah Akun" untuk memulai.' : 'Tidak ada akun yang cocok dengan pencarian.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={paginatedAccounts.length > 0 && paginatedAccounts.every(a => selectedIds.has(a.id))}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('customer_id')}>
                    <span className="inline-flex items-center">Customer ID <SortIcon col="customer_id" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <span className="inline-flex items-center">Nama Akun <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('pic_name')}>
                    <span className="inline-flex items-center">PIC <SortIcon col="pic_name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('region')}>
                    <span className="inline-flex items-center">Region <SortIcon col="region" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>
                    <span className="inline-flex items-center">Tipe <SortIcon col="type" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    <span className="inline-flex items-center">Status <SortIcon col="status" /></span>
                  </TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAccounts.map(acc => (
                  <TableRow key={acc.id} data-state={selectedIds.has(acc.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(acc.id)}
                        onCheckedChange={() => toggleSelect(acc.id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{acc.customer_id || '-'}</TableCell>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.pic_name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.region || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(acc.status || 'Active')}>{acc.status || 'Active'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDelete(acc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Menampilkan {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} dari {filtered.length} akun
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | string)[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    typeof p === 'string' ? (
                      <span key={`dot-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentPage(p)}>
                        {p}
                      </Button>
                    )
                  )}
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer ID</Label>
                <Input value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} placeholder="CUST2026-XXXX" />
              </div>
              <div className="space-y-1.5">
                <Label>Nama Akun Pelanggan/Customer *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nama perusahaan / instansi" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nama PIC</Label>
              <Input value={formPicName} onChange={e => setFormPicName(e.target.value)} placeholder="Nama Person in Charge" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nomor Contact</Label>
                <Input value={formPicContact} onChange={e => setFormPicContact(e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="email" value={formPicEmail} onChange={e => setFormPicEmail(e.target.value)} placeholder="email@contoh.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipe</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Region (Provinsi)</Label>
              <Select value={formRegion} onValueChange={setFormRegion}>
                <SelectTrigger><SelectValue placeholder="Pilih provinsi" /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Akun</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Yakin ingin menghapus akun <strong>{deletingAccount?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>{saving ? 'Menghapus...' : 'Hapus'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
