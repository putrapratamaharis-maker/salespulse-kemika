import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, FolderTree, Package, Ruler, Upload, Download, FileDown, FileSpreadsheet, FileText, Eye, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ProductReadOnlyContext = createContext(false);
const useProductReadOnly = () => useContext(ProductReadOnlyContext);

// --- Category Management ---
function CategoryTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<{ id: string; name: string; description: string | null; code: string; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [viewItem, setViewItem] = useState<any | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('product_categories').select('*').order('name');
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setEditItem(null); setCode(''); setName(''); setDescription(''); setIsActive(true); setDialogOpen(true); };
  const openEdit = (item: typeof items[0]) => { setEditItem(item); setCode(item.code || ''); setName(item.name); setDescription(item.description || ''); setIsActive(item.is_active); setDialogOpen(true); };
  const openView = (item: typeof items[0]) => { setViewItem(item); setViewOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Nama wajib diisi', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: any = { name: name.trim(), description: description.trim() || null, code: code.trim(), is_active: isActive };
    if (editItem) {
      const { error } = await supabase.from('product_categories').update(payload).eq('id', editItem.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Kategori diperbarui' }); }
    } else {
      const { error } = await supabase.from('product_categories').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Kategori ditambahkan' }); }
    }
    setSaving(false);
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kategori ini?')) return;
    const { error } = await supabase.from('product_categories').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Kategori dihapus' }); fetch(); }
  };

  const toggleCatSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleCatSelectAll = () => setSelectedIds(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.id)));

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} kategori yang dipilih?`)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from('product_categories').delete().in('id', Array.from(selectedIds));
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: `${selectedIds.size} kategori dihapus` }); setSelectedIds(new Set()); fetch(); }
    setBulkDeleting(false);
  };

  const handleBulkSetStatus = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    const label = active ? 'aktifkan' : 'nonaktifkan';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${selectedIds.size} kategori?`)) return;
    const { error } = await supabase.from('product_categories').update({ is_active: active } as any).in('id', Array.from(selectedIds));
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: `${selectedIds.size} kategori di-${label}` }); setSelectedIds(new Set()); fetch(); }
  };

  const exportSelectedExcel = () => {
    const selected = items.filter(i => selectedIds.has(i.id));
    if (selected.length === 0) return;
    const rows = selected.map((i, idx) => ({ 'No': idx + 1, 'Kode': i.code || '', 'Nama Kategori': i.name, 'Deskripsi': i.description || '', 'Status': i.is_active ? 'Aktif' : 'Non-aktif' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Selected Categories');
    XLSX.writeFile(wb, `kategori_terpilih_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: `${selected.length} kategori diekspor` });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Kode Kategori', 'Nama Kategori*', 'Deskripsi', 'Aktif (Ya/Tidak)'],
      ['CAT-001', 'Pestisida', 'Produk pembasmi hama', 'Ya'],
    ]);
    ws['!cols'] = [{ wch: 18 }, { wch: 25 }, { wch: 30 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categories');
    XLSX.writeFile(wb, 'template_import_kategori.xlsx');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const dataRows = rows.slice(1).filter(r => r[1]?.toString().trim());
      if (dataRows.length === 0) {
        toast({ title: 'File kosong', variant: 'destructive' });
        setImporting(false);
        return;
      }
      const payloads: any[] = dataRows.map(row => {
        const activeStr = (row[3]?.toString().trim() || 'Ya').toLowerCase();
        return {
          code: row[0]?.toString().trim() || '',
          name: row[1]?.toString().trim() || '',
          description: row[2]?.toString().trim() || null,
          is_active: !['tidak', 'no', 'false', '0', 'non-aktif'].includes(activeStr),
        };
      }).filter(p => p.name);
      const { error, data: inserted } = await supabase.from('product_categories').insert(payloads).select();
      if (error) { toast({ title: 'Import gagal', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Import berhasil', description: `${inserted?.length || payloads.length} kategori ditambahkan.` }); fetch(); }
    } catch (err: any) { toast({ title: 'Error membaca file', description: err.message, variant: 'destructive' }); }
    setImporting(false);
  };

  const exportExcel = () => {
    const rows = items.map((i, idx) => ({
      'No': idx + 1,
      'Kode': i.code || '',
      'Nama Kategori': i.name,
      'Deskripsi': i.description || '',
      'Status': i.is_active ? 'Aktif' : 'Non-aktif',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categories');
    XLSX.writeFile(wb, `data_kategori_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Export Excel berhasil' });
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-accent" /> Product Categories
          <Badge variant="secondary" className="text-[10px] ml-1">{items.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={downloadTemplate}>
            <Download className="h-3 w-3" /> Template
          </Button>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={importing} />
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" asChild disabled={importing}>
              <span>{importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Import</span>
            </Button>
          </label>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={exportExcel}>
            <FileDown className="h-3 w-3" /> Ekspor
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 h-7 text-xs" onClick={openAdd}><Plus className="h-3 w-3" /> Tambah</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{editItem ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Kode Kategori</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CAT-001" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Nama Kategori</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pestisida" /></div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Deskripsi (opsional)</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi singkat" /></div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
                  Aktif
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Batal</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Simpan</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 flex-wrap">
            <span className="text-xs font-medium">{selectedIds.size} kategori dipilih</span>
            <div className="h-4 w-px bg-border" />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkSetStatus(true)}>Aktifkan</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkSetStatus(false)}>Nonaktifkan</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportSelectedExcel}>
              <FileSpreadsheet className="h-3 w-3" /> Export Terpilih
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Hapus
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>Batal</Button>
          </div>
        )}

        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Belum ada kategori.</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10">
                <Checkbox checked={items.length > 0 && selectedIds.size === items.length} onCheckedChange={toggleCatSelectAll} />
              </TableHead>
              <TableHead className="text-xs">Code</TableHead>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.id} className={`${!i.is_active ? 'opacity-60' : ''} ${selectedIds.has(i.id) ? 'bg-muted/40' : ''}`}>
                  <TableCell><Checkbox checked={selectedIds.has(i.id)} onCheckedChange={() => toggleCatSelect(i.id)} /></TableCell>
                  <TableCell className="text-sm font-mono font-semibold">{i.code || '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{i.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.description || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${i.is_active ? 'border-green-500 text-green-600 bg-green-50' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                      {i.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(i)}>
                          <Eye className="h-4 w-4 mr-2" /> View Detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(i)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(i.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* View Detail Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Detail Kategori</DialogTitle></DialogHeader>
            {viewItem && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-2">
                <span className="text-muted-foreground">Code</span>
                <span className="font-mono font-medium">{viewItem.code || '—'}</span>
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{viewItem.name}</span>
                <span className="text-muted-foreground">Description</span>
                <span>{viewItem.description || '—'}</span>
                <span className="text-muted-foreground">Status</span>
                <span><Badge variant="outline" className={`text-[10px] ${viewItem.is_active ? 'border-green-500 text-green-600 bg-green-50' : 'border-muted-foreground/30 text-muted-foreground'}`}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge></span>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// --- Product Management ---
function ProductTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  // Pagination
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  // View detail
  const [viewItem, setViewItem] = useState<any | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }, { data: uns }] = await Promise.all([
      supabase.from('products').select('*, product_categories(name)').order('name'),
      supabase.from('product_categories').select('id, name').order('name'),
      supabase.from('units').select('id, name').order('name'),
    ]);
    setItems(prods || []);
    setCategories(cats || []);
    setUnits(uns || []);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => { setEditItem(null); setName(''); setSku(''); setCategoryId(''); setUnit('pcs'); setPrice(''); setSellingPrice(''); setIsActive(true); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setName(item.name); setSku(item.sku || ''); setCategoryId(item.category_id || ''); setUnit(item.unit || 'pcs'); setPrice(String(item.purchase_price || item.price || '')); setSellingPrice(String(item.selling_price || '')); setIsActive(item.is_active); setDialogOpen(true); };
  const openView = (item: any) => { setViewItem(item); setViewOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Nama produk wajib diisi', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = { name: name.trim(), sku: sku.trim() || null, category_id: categoryId || null, unit: unit || 'pcs', price: Number(price) || 0, purchase_price: Number(price) || 0, selling_price: Number(sellingPrice) || 0, is_active: isActive };
    if (editItem) {
      const { error } = await supabase.from('products').update(payload).eq('id', editItem.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Produk diperbarui' }); }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Produk ditambahkan' }); }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Produk dihapus' }); fetchAll(); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} produk yang dipilih?`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${ids.length} produk dihapus` });
      setSelectedIds(new Set());
      fetchAll();
    }
    setBulkDeleting(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((i: any) => i.id)));
    }
  };

  const handleBulkSetStatus = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    const label = active ? 'aktifkan' : 'nonaktifkan';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${selectedIds.size} produk yang dipilih?`)) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('products').update({ is_active: active } as any).in('id', ids);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${ids.length} produk di-${label}` });
      setSelectedIds(new Set());
      fetchAll();
    }
  };

  const exportSelectedExcel = () => {
    const selected = items.filter((i: any) => selectedIds.has(i.id));
    if (selected.length === 0) return;
    const rows = selected.map((i: any, idx: number) => ({
      'No': idx + 1,
      'Code/SKU': i.sku || '',
      'Nama Produk': i.name,
      'Kategori': i.product_categories?.name || '',
      'Satuan Unit': i.unit || '',
      'Purchase Price': Number(i.purchase_price || i.price) || 0,
      'Selling Price': Number(i.selling_price) || 0,
      'Status': i.is_active ? 'Aktif' : 'Non-aktif',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Selected Products');
    XLSX.writeFile(wb, `produk_terpilih_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: `${selected.length} produk diekspor ke Excel` });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama Produk*', 'SKU', 'Kategori', 'Satuan Unit', 'Purchase Price', 'Selling Price', 'Aktif (Ya/Tidak)'],
      ['Contoh Produk', 'SKU-001', categories[0]?.name || 'Hardware', units[0]?.name || 'pcs', 100000, 150000, 'Ya'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'template_import_produk.xlsx');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const dataRows = rows.slice(1).filter(r => r[0]?.toString().trim());
      if (dataRows.length === 0) {
        toast({ title: 'File kosong', description: 'Tidak ada data produk ditemukan.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      const unitNames = new Set(units.map(u => u.name.toLowerCase()));

      const payloads = dataRows.map(row => {
        const prodName = row[0]?.toString().trim() || '';
        const prodSku = row[1]?.toString().trim() || null;
        const catName = row[2]?.toString().trim() || '';
        const unitName = row[3]?.toString().trim() || 'pcs';
        const prodPrice = Number(row[4]) || 0;
        const sellingPr = Number(row[5]) || 0;
        const activeStr = (row[6]?.toString().trim() || 'Ya').toLowerCase();
        const active = !['tidak', 'no', 'false', '0', 'non-aktif'].includes(activeStr);

        return {
          name: prodName,
          sku: prodSku,
          category_id: catMap.get(catName.toLowerCase()) || null,
          unit: unitNames.has(unitName.toLowerCase()) ? unitName : 'pcs',
          price: prodPrice,
          purchase_price: prodPrice,
          selling_price: sellingPr,
          is_active: active,
        };
      }).filter(p => p.name);

      const { error, data: inserted } = await supabase.from('products').insert(payloads).select();
      if (error) {
        toast({ title: 'Import gagal', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Import berhasil', description: `${inserted?.length || payloads.length} produk ditambahkan.` });
        fetchAll();
      }
    } catch (err: any) {
      toast({ title: 'Error membaca file', description: err.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  const filteredItems = items.filter(i => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || i.name.toLowerCase().includes(q) || (i.sku && i.sku.toLowerCase().includes(q));
    const matchesCategory = filterCategory === 'all' || i.category_id === filterCategory;
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? i.is_active : !i.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination logic
  const totalItems = filteredItems.length;
  const isShowAll = pageSize === 0;
  const totalPages = isShowAll ? 1 : Math.ceil(totalItems / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginatedItems = isShowAll ? filteredItems : filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);
  const fromRow = totalItems === 0 ? 0 : (safePage - 1) * (isShowAll ? totalItems : pageSize) + 1;
  const toRow = isShowAll ? totalItems : Math.min(safePage * pageSize, totalItems);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterCategory, filterStatus, pageSize]);

  const exportExcel = () => {
    const rows = filteredItems.map((i: any, idx: number) => ({
      'No': idx + 1,
      'Code/SKU': i.sku || '',
      'Nama Produk': i.name,
      'Kategori': i.product_categories?.name || '',
      'Satuan Unit': i.unit || '',
      'Purchase Price': Number(i.purchase_price || i.price) || 0,
      'Selling Price': Number(i.selling_price) || 0,
      'Status': i.is_active ? 'Aktif' : 'Non-aktif',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `data_produk_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Export Excel berhasil' });
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Data Produk', 14, 15);
    doc.setFontSize(8);
    doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['No', 'Code/SKU', 'Nama Produk', 'Kategori', 'Unit', 'Purchase Price (Rp)', 'Selling Price (Rp)', 'Status']],
      body: filteredItems.map((i: any, idx: number) => [
        idx + 1,
        i.sku || '—',
        i.name,
        i.product_categories?.name || '—',
        i.unit || '—',
        Number(i.purchase_price || i.price || 0).toLocaleString('id-ID'),
        Number(i.selling_price || 0).toLocaleString('id-ID'),
        i.is_active ? 'Aktif' : 'Non-aktif',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });
    doc.save(`data_produk_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: 'Export PDF berhasil' });
  };

  const PAGE_SIZES = [10, 25, 50, 100, 0]; // 0 = All

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" /> Products
          <Badge variant="secondary" className="text-[10px] ml-1">{filteredItems.length}/{items.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={downloadTemplate}>
            <Download className="h-3 w-3" /> Template
          </Button>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={importing} />
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" asChild disabled={importing}>
              <span>{importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Import</span>
            </Button>
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                <FileDown className="h-3 w-3" /> Ekspor
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel} className="text-xs gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPdf} className="text-xs gap-2">
                <FileText className="h-3.5 w-3.5" /> Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 h-7 text-xs" onClick={openAdd}><Plus className="h-3 w-3" /> Tambah</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>{editItem ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Nama Produk</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nama produk" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">SKU (opsional)</Label><Input value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kategori</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Satuan Unit</Label>
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih satuan" /></SelectTrigger>
                      <SelectContent>
                        {units.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Purchase Price (Rp)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Selling Price (Rp)</Label><Input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0" /></div>
                </div>
                <div className="space-y-1.5 flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
                    Aktif
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Batal</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Simpan</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search & Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 text-sm pl-8"
              placeholder="Cari nama atau SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
            <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Non-aktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 flex-wrap">
            <span className="text-xs font-medium">{selectedIds.size} produk dipilih</span>
            <div className="h-4 w-px bg-border" />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkSetStatus(true)}>
              Aktifkan
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkSetStatus(false)}>
              Nonaktifkan
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportSelectedExcel}>
              <FileSpreadsheet className="h-3 w-3" /> Export Terpilih
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Hapus
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>Batal</Button>
          </div>
        )}

        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : filteredItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">{items.length === 0 ? 'Belum ada produk.' : 'Tidak ada produk yang cocok.'}</p> : (
          <>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={paginatedItems.length > 0 && selectedIds.size === paginatedItems.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Product Name</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Unit</TableHead>
                <TableHead className="text-xs text-right">Purchase Price</TableHead>
                <TableHead className="text-xs text-right">Selling Price</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {paginatedItems.map((i: any) => (
                  <TableRow key={i.id} className={selectedIds.has(i.id) ? 'bg-muted/40' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(i.id)}
                        onCheckedChange={() => toggleSelect(i.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-mono font-semibold">{i.sku || '—'}</TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium">{i.name}</div>
                        {i.sku && <div className="text-xs text-muted-foreground">{i.sku}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{i.product_categories?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{i.unit || '—'}</TableCell>
                    <TableCell className="text-sm text-right">Rp {Number(i.purchase_price || i.price || 0).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-sm text-right">{Number(i.selling_price) ? `Rp ${Number(i.selling_price).toLocaleString('id-ID')}` : '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${i.is_active ? 'border-green-500 text-green-600 bg-green-50' : 'border-muted-foreground/30 text-muted-foreground'}`}
                      >
                        {i.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(i)}>
                            <Eye className="h-4 w-4 mr-2" /> View Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(i)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(i.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page</span>
                <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                  <SelectTrigger className="h-7 w-[70px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map(s => (
                      <SelectItem key={s} value={String(s)}>{s === 0 ? 'All' : s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {totalItems === 0 ? '0' : `${fromRow}–${toRow}`} of {totalItems}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1 || isShowAll} onClick={() => setCurrentPage(safePage - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages || isShowAll} onClick={() => setCurrentPage(safePage + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* View Details Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Detail Produk</DialogTitle></DialogHeader>
            {viewItem && (
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Code/SKU</span>
                  <span className="font-medium font-mono">{viewItem.sku || '—'}</span>
                  <span className="text-muted-foreground">Product Name</span>
                  <span className="font-medium">{viewItem.name}</span>
                  <span className="text-muted-foreground">Category</span>
                  <span>{viewItem.product_categories?.name || '—'}</span>
                  <span className="text-muted-foreground">Unit</span>
                  <span>{viewItem.unit || '—'}</span>
                   <span className="text-muted-foreground">Purchase Price</span>
                   <span>Rp {Number(viewItem.purchase_price || viewItem.price || 0).toLocaleString('id-ID')}</span>
                   <span className="text-muted-foreground">Selling Price</span>
                   <span>{Number(viewItem.selling_price) ? `Rp ${Number(viewItem.selling_price).toLocaleString('id-ID')}` : '-'}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span><Badge variant={viewItem.is_active ? 'default' : 'secondary'} className="text-[10px]">{viewItem.is_active ? 'Active' : 'Non-Active'}</Badge></span>
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(viewItem.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span className="text-muted-foreground">Updated</span>
                  <span>{new Date(viewItem.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// --- Unit Management ---
function UnitTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<{ id: string; name: string; code: string; is_active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewItem, setViewItem] = useState<any | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('units').select('*').order('name');
    setItems((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setEditItem(null); setCode(''); setName(''); setIsActive(true); setDialogOpen(true); };
  const openEdit = (item: typeof items[0]) => { setEditItem(item); setCode(item.code || ''); setName(item.name); setIsActive(item.is_active); setDialogOpen(true); };
  const openView = (item: typeof items[0]) => { setViewItem(item); setViewOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Nama unit wajib diisi', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: any = { name: name.trim(), code: code.trim(), is_active: isActive };
    if (editItem) {
      const { error } = await supabase.from('units').update(payload).eq('id', editItem.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Unit diperbarui' }); }
    } else {
      const { error } = await supabase.from('units').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Unit ditambahkan' }); }
    }
    setSaving(false);
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus unit ini?')) return;
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Unit dihapus' }); fetch(); setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const toggleUnitSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleUnitSelectAll = () => setSelectedIds(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  const handleBulkDelete = async () => {
    if (!confirm(`Hapus ${selectedIds.size} unit?`)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from('units').delete().in('id', Array.from(selectedIds));
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: `${selectedIds.size} unit dihapus` }); setSelectedIds(new Set()); fetch(); }
    setBulkDeleting(false);
  };
  const handleBulkSetStatus = async (active: boolean) => {
    const label = active ? 'aktifkan' : 'nonaktifkan';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${selectedIds.size} unit?`)) return;
    const { error } = await supabase.from('units').update({ is_active: active } as any).in('id', Array.from(selectedIds));
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: `${selectedIds.size} unit di-${label}` }); setSelectedIds(new Set()); fetch(); }
  };
  const exportSelectedExcel = () => {
    const selected = items.filter(i => selectedIds.has(i.id));
    const rows = selected.map((i, idx) => ({ 'No': idx + 1, 'Kode': i.code || '', 'Nama Unit': i.name, 'Status': i.is_active ? 'Aktif' : 'Non-aktif' }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Selected Units');
    XLSX.writeFile(wb, `unit_terpilih_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: `${selected.length} unit diekspor` });
  };
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Kode Unit', 'Nama Unit*', 'Aktif (Ya/Tidak)'], ['PCS', 'Pieces', 'Ya']]);
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 18 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Units');
    XLSX.writeFile(wb, 'template_import_unit.xlsx');
  };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''; setImporting(true);
    try {
      const data = await file.arrayBuffer(); const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const dataRows = rows.slice(1).filter(r => r[1]?.toString().trim());
      if (dataRows.length === 0) { toast({ title: 'File kosong', variant: 'destructive' }); setImporting(false); return; }
      const payloads: any[] = dataRows.map(row => {
        const activeStr = (row[2]?.toString().trim() || 'Ya').toLowerCase();
        return { code: row[0]?.toString().trim() || '', name: row[1]?.toString().trim() || '', is_active: !['tidak', 'no', 'false', '0'].includes(activeStr) };
      }).filter(p => p.name);
      const { error, data: inserted } = await supabase.from('units').insert(payloads).select();
      if (error) { toast({ title: 'Import gagal', description: error.message, variant: 'destructive' }); }
      else { toast({ title: 'Import berhasil', description: `${inserted?.length} unit ditambahkan.` }); fetch(); }
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    setImporting(false);
  };
  const exportExcel = () => {
    const rows = items.map((i, idx) => ({ 'No': idx + 1, 'Kode': i.code || '', 'Nama Unit': i.name, 'Status': i.is_active ? 'Aktif' : 'Non-aktif' }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Units');
    XLSX.writeFile(wb, `data_unit_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Export Excel berhasil' });
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Ruler className="h-4 w-4 text-accent" /> Satuan Unit
          <Badge variant="secondary" className="text-[10px] ml-1">{items.length}</Badge>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={downloadTemplate}><Download className="h-3 w-3" /> Template</Button>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={importing} />
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" asChild disabled={importing}>
              <span>{importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Import</span>
            </Button>
          </label>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={exportExcel}><FileDown className="h-3 w-3" /> Ekspor</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 h-7 text-xs" onClick={openAdd}><Plus className="h-3 w-3" /> Tambah</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{editItem ? 'Edit Unit' : 'Tambah Unit'}</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Kode Unit</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. PCS" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Nama Unit</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. pcs, kg, meter" /></div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" /> Aktif</label>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Batal</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Simpan</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 flex-wrap">
            <span className="text-xs font-medium">{selectedIds.size} unit dipilih</span>
            <div className="h-4 w-px bg-border" />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkSetStatus(true)}>Aktifkan</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkSetStatus(false)}>Nonaktifkan</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportSelectedExcel}><FileSpreadsheet className="h-3 w-3" /> Export Terpilih</Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkDelete} disabled={bulkDeleting}>{bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Hapus</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>Batal</Button>
          </div>
        )}
        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Belum ada unit.</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-10"><Checkbox checked={items.length > 0 && selectedIds.size === items.length} onCheckedChange={toggleUnitSelectAll} /></TableHead>
              <TableHead className="text-xs">Code</TableHead>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.id} className={`${!i.is_active ? 'opacity-60' : ''} ${selectedIds.has(i.id) ? 'bg-muted/40' : ''}`}>
                  <TableCell><Checkbox checked={selectedIds.has(i.id)} onCheckedChange={() => toggleUnitSelect(i.id)} /></TableCell>
                  <TableCell className="text-sm font-mono font-semibold">{i.code || '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{i.name}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${i.is_active ? 'border-green-500 text-green-600 bg-green-50' : 'border-muted-foreground/30 text-muted-foreground'}`}>{i.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(i)}><Eye className="h-4 w-4 mr-2" /> View Detail</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(i)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(i.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* View Detail Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Detail Unit</DialogTitle></DialogHeader>
            {viewItem && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-2">
                <span className="text-muted-foreground">Code</span>
                <span className="font-mono font-medium">{viewItem.code || '—'}</span>
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{viewItem.name}</span>
                <span className="text-muted-foreground">Status</span>
                <span><Badge variant="outline" className={`text-[10px] ${viewItem.is_active ? 'border-green-500 text-green-600 bg-green-50' : 'border-muted-foreground/30 text-muted-foreground'}`}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge></span>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// --- Main Export ---
export function ProductMasterManagement() {
  return (
    <Tabs defaultValue="categories" className="space-y-4">
      <TabsList>
        <TabsTrigger value="categories"><FolderTree className="h-3.5 w-3.5 mr-1" /> Kategori</TabsTrigger>
        <TabsTrigger value="products"><Package className="h-3.5 w-3.5 mr-1" /> Produk</TabsTrigger>
        <TabsTrigger value="units"><Ruler className="h-3.5 w-3.5 mr-1" /> Satuan Unit</TabsTrigger>
      </TabsList>
      <TabsContent value="categories"><CategoryTab /></TabsContent>
      <TabsContent value="products"><ProductTab /></TabsContent>
      <TabsContent value="units"><UnitTab /></TabsContent>
    </Tabs>
  );
}
