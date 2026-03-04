import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, FolderTree, Package, Ruler, Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';

// --- Category Management ---
function CategoryTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id: string; name: string; description: string } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('product_categories').select('*').order('name');
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setEditItem(null); setName(''); setDescription(''); setDialogOpen(true); };
  const openEdit = (item: typeof items[0]) => { setEditItem({ id: item.id, name: item.name, description: item.description || '' }); setName(item.name); setDescription(item.description || ''); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Nama wajib diisi', variant: 'destructive' }); return; }
    setSaving(true);
    if (editItem) {
      const { error } = await supabase.from('product_categories').update({ name: name.trim(), description: description.trim() || null }).eq('id', editItem.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Kategori diperbarui' }); }
    } else {
      const { error } = await supabase.from('product_categories').insert({ name: name.trim(), description: description.trim() || null });
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

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-accent" /> Product Categories
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 h-7 text-xs" onClick={openAdd}><Plus className="h-3 w-3" /> Tambah</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editItem ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5"><Label className="text-xs">Nama Kategori</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hardware" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Deskripsi (opsional)</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi singkat" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Simpan</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Belum ada kategori.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead className="text-xs">Nama</TableHead><TableHead className="text-xs">Deskripsi</TableHead><TableHead className="text-xs w-20">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="text-sm font-medium">{i.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.description || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

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

  const openAdd = () => { setEditItem(null); setName(''); setSku(''); setCategoryId(''); setUnit('pcs'); setPrice(''); setIsActive(true); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setName(item.name); setSku(item.sku || ''); setCategoryId(item.category_id || ''); setUnit(item.unit || 'pcs'); setPrice(String(item.price || '')); setIsActive(item.is_active); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Nama produk wajib diisi', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = { name: name.trim(), sku: sku.trim() || null, category_id: categoryId || null, unit: unit || 'pcs', price: Number(price) || 0, is_active: isActive };
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
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Produk dihapus' }); fetchAll(); }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama Produk*', 'SKU', 'Kategori', 'Satuan Unit', 'Harga', 'Aktif (Ya/Tidak)'],
      ['Contoh Produk', 'SKU-001', categories[0]?.name || 'Hardware', units[0]?.name || 'pcs', 100000, 'Ya'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
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

      // Skip header row
      const dataRows = rows.slice(1).filter(r => r[0]?.toString().trim());
      if (dataRows.length === 0) {
        toast({ title: 'File kosong', description: 'Tidak ada data produk ditemukan.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      // Build category & unit lookup maps (case-insensitive)
      const catMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
      const unitNames = new Set(units.map(u => u.name.toLowerCase()));

      const payloads = dataRows.map(row => {
        const prodName = row[0]?.toString().trim() || '';
        const prodSku = row[1]?.toString().trim() || null;
        const catName = row[2]?.toString().trim() || '';
        const unitName = row[3]?.toString().trim() || 'pcs';
        const prodPrice = Number(row[4]) || 0;
        const activeStr = (row[5]?.toString().trim() || 'Ya').toLowerCase();
        const active = !['tidak', 'no', 'false', '0', 'non-aktif'].includes(activeStr);

        return {
          name: prodName,
          sku: prodSku,
          category_id: catMap.get(catName.toLowerCase()) || null,
          unit: unitNames.has(unitName.toLowerCase()) ? unitName : 'pcs',
          price: prodPrice,
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
                  <div className="space-y-1.5"><Label className="text-xs">Harga (Rp)</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1.5 flex items-end">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
                      Aktif
                    </label>
                  </div>
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

        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : filteredItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">{items.length === 0 ? 'Belum ada produk.' : 'Tidak ada produk yang cocok.'}</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Nama</TableHead>
              <TableHead className="text-xs">SKU</TableHead>
              <TableHead className="text-xs">Kategori</TableHead>
              <TableHead className="text-xs">Unit</TableHead>
              <TableHead className="text-xs">Harga</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs w-20">Aksi</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredItems.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="text-sm font-medium">{i.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.sku || '—'}</TableCell>
                  <TableCell className="text-sm">{i.product_categories?.name || '—'}</TableCell>
                  <TableCell className="text-sm">{i.unit || '—'}</TableCell>
                  <TableCell className="text-sm">Rp {Number(i.price).toLocaleString('id-ID')}</TableCell>
                  <TableCell><Badge variant={i.is_active ? 'default' : 'secondary'} className="text-[10px]">{i.is_active ? 'Aktif' : 'Non-aktif'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// --- Unit Management ---
function UnitTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('units').select('*').order('name');
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const openAdd = () => { setEditItem(null); setName(''); setDialogOpen(true); };
  const openEdit = (item: typeof items[0]) => { setEditItem(item); setName(item.name); setDialogOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Nama unit wajib diisi', variant: 'destructive' }); return; }
    setSaving(true);
    if (editItem) {
      const { error } = await supabase.from('units').update({ name: name.trim() }).eq('id', editItem.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Unit diperbarui' }); }
    } else {
      const { error } = await supabase.from('units').insert({ name: name.trim() });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Unit ditambahkan' }); }
    }
    setSaving(false);
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus unit ini?')) return;
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); } else { toast({ title: 'Unit dihapus' }); fetch(); }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Ruler className="h-4 w-4 text-accent" /> Satuan Unit
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 h-7 text-xs" onClick={openAdd}><Plus className="h-3 w-3" /> Tambah</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{editItem ? 'Edit Unit' : 'Tambah Unit'}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1.5"><Label className="text-xs">Nama Unit</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. pcs, kg, meter" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Simpan</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Belum ada unit.</p> : (
          <div className="flex flex-wrap gap-2">
            {items.map(i => (
              <div key={i.id} className="flex items-center gap-1 border border-border rounded-md px-2.5 py-1.5 bg-muted/30">
                <span className="text-sm font-medium">{i.name}</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-1" onClick={() => openEdit(i)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => handleDelete(i.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
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
