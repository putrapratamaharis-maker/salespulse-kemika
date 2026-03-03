import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import { Deal, DealStage, DealProduct, Segment } from '@/types/sales';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

const stageOptions: { value: DealStage; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'po_secured', label: 'PO Secured/Won' },
  { value: 'invoice_issued', label: 'Invoice Issued' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'lost', label: 'Lost' },
];

const segmentOptions: { value: Segment | 'B2C/e-Commerce'; label: string }[] = [
  { value: 'B2G', label: 'B2G' },
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C/e-Commerce' as any, label: 'B2C/e-Commerce' },
];

const productCategories = [
  'Hardware', 'Software', 'Networking', 'Services', 'Consumables', 'Other',
];

const unitOptions = ['pcs', 'unit', 'set', 'lot', 'pack', 'box', 'roll', 'meter', 'kg', 'liter'];

interface NewLeadDialogProps {
  onAdd: (deal: Deal) => void;
  accountOptions: { id: string; name: string; picContact?: string; picEmail?: string }[];
  salesId: string;
  onAccountCreated?: (account: { id: string; name: string; picContact?: string; picEmail?: string }) => void;
}

const emptyProduct = (): DealProduct => ({
  id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  category: '',
  productName: '',
  unit: 'pcs',
  qty: 1,
  pricePerUnit: 0,
  otherCost: 0,
});

export function NewLeadDialog({ onAdd, accountOptions, salesId, onAccountCreated }: NewLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [accountId, setAccountId] = useState('');
  const [location, setLocation] = useState('');
  const [segment, setSegment] = useState<string>('B2B');
  const [stage, setStage] = useState<DealStage>('prospect');
  const [products, setProducts] = useState<DealProduct[]>([emptyProduct()]);
  const [expectedMargin, setExpectedMargin] = useState('');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [notes, setNotes] = useState('');

  // Inline new account state
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccSegment, setNewAccSegment] = useState('B2B');
  const [newAccRegion, setNewAccRegion] = useState('');
  const [newAccType, setNewAccType] = useState('Corporate');
  const [savingAccount, setSavingAccount] = useState(false);

  const selectedAccount = accountOptions.find(a => a.id === accountId);

  const resetForm = () => {
    setAccountId('');
    setLocation('');
    setSegment('B2B');
    setStage('prospect');
    setProducts([emptyProduct()]);
    setExpectedMargin('');
    setProbability('');
    setExpectedCloseDate('');
    setNotes('');
    setShowNewAccount(false);
    setNewAccName('');
    setNewAccSegment('B2B');
    setNewAccRegion('');
    setNewAccType('Corporate');
  };

  const handleSaveNewAccount = async () => {
    if (!newAccName.trim()) {
      toast({ title: 'Nama akun wajib diisi', variant: 'destructive' });
      return;
    }
    setSavingAccount(true);
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          name: newAccName.trim(),
          segment: newAccSegment,
          region: newAccRegion.trim(),
          type: newAccType,
          sales_id: salesId,
        })
        .select()
        .single();

      if (error) throw error;

      const newAcc = { id: data.id, name: data.name };
      onAccountCreated?.(newAcc);
      setAccountId(data.id);
      setShowNewAccount(false);
      setNewAccName('');
      setNewAccSegment('B2B');
      setNewAccRegion('');
      setNewAccType('Corporate');
      toast({ title: `Akun "${data.name}" berhasil dibuat` });
    } catch (err: any) {
      toast({ title: 'Gagal membuat akun', description: err.message, variant: 'destructive' });
    } finally {
      setSavingAccount(false);
    }
  };

  const totalValue = products.reduce((sum, p) => sum + (p.qty * p.pricePerUnit) + p.otherCost, 0);

  const updateProduct = (index: number, field: keyof DealProduct, value: string | number) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addProduct = () => {
    setProducts(prev => [...prev, emptyProduct()]);
  };

  const removeProduct = (index: number) => {
    if (products.length <= 1) return;
    setProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountId || !expectedCloseDate || products.some(p => !p.productName || !p.category)) {
      toast({ title: 'Lengkapi semua field yang diperlukan', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const dealName = products.length === 1
      ? products[0].productName
      : `${products[0].productName} (+${products.length - 1} item)`;

    const newDeal: Deal = {
      id: `new-${Date.now()}`,
      accountId,
      salesId,
      name: dealName,
      segment: (segment === 'B2C/e-Commerce' ? 'B2C' : segment) as Segment,
      stage,
      value: totalValue,
      probability: Number(probability) || 0,
      expectedCloseDate,
      createdAt: now,
      updatedAt: now,
      daysInStage: 0,
      location,
      notes,
      expectedMargin: Number(expectedMargin) || 0,
      products,
    };

    onAdd(newDeal);
    toast({ title: 'Lead berhasil ditambahkan' });
    resetForm();
    setOpen(false);
  };

  const formatRp = (val: number) =>
    val > 0 ? `Rp ${val.toLocaleString('id-ID')}` : '-';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Tambah Lead / Forecast Baru</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4 mt-3">
            {/* Account & PIC */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Account / Customer Name</Label>
                {!showNewAccount && (
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowNewAccount(true)}>
                    <UserPlus className="h-3 w-3" /> Akun Baru
                  </Button>
                )}
              </div>

              {showNewAccount ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">Buat Akun Baru</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowNewAccount(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nama Akun *</Label>
                    <Input className="h-9 text-sm" value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Nama perusahaan / instansi" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Segmen</Label>
                      <Select value={newAccSegment} onValueChange={setNewAccSegment}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {segmentOptions.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Region</Label>
                      <Input className="h-9 text-sm" value={newAccRegion} onChange={e => setNewAccRegion(e.target.value)} placeholder="Contoh: Jabodetabek" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipe</Label>
                      <Select value={newAccType} onValueChange={setNewAccType}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Corporate">Corporate</SelectItem>
                          <SelectItem value="Government">Government</SelectItem>
                          <SelectItem value="Individual">Individual</SelectItem>
                          <SelectItem value="SME">SME</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" className="gap-1 h-8 text-xs" onClick={handleSaveNewAccount} disabled={savingAccount}>
                      {savingAccount ? 'Menyimpan...' : 'Simpan Akun'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Pilih account" /></SelectTrigger>
                  <SelectContent>
                    {accountOptions.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedAccount && !showNewAccount && (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/50 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">PIC Contact</p>
                  <p className="text-sm font-medium text-foreground">{selectedAccount.picContact || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{selectedAccount.picEmail || '-'}</p>
                </div>
              </div>
            )}

            {/* Location & Segment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-location">Letak Project / Instansi</Label>
                <Input id="lead-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Contoh: Jakarta Pusat" />
              </div>
              <div className="space-y-1.5">
                <Label>Segmen</Label>
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {segmentOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stage */}
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={v => setStage(v as DealStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stageOptions.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Products */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Product / Item</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addProduct}>
                  <Plus className="h-3 w-3" /> Add Product
                </Button>
              </div>

              {products.map((product, idx) => (
                <div key={product.id} className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Item #{idx + 1}</span>
                    {products.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeProduct(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product Category</Label>
                      <Select value={product.category} onValueChange={v => updateProduct(idx, 'category', v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                        <SelectContent>
                          {productCategories.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product Name</Label>
                      <Input className="h-9 text-sm" value={product.productName} onChange={e => updateProduct(idx, 'productName', e.target.value)} placeholder="Nama produk" />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Satuan Unit</Label>
                      <Select value={product.unit} onValueChange={v => updateProduct(idx, 'unit', v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {unitOptions.map(u => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qty</Label>
                      <Input className="h-9 text-sm" type="number" min={1} value={product.qty} onChange={e => updateProduct(idx, 'qty', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Price/Unit (Rp)</Label>
                      <Input className="h-9 text-sm" type="number" min={0} value={product.pricePerUnit || ''} onChange={e => updateProduct(idx, 'pricePerUnit', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Biaya Lainnya (Rp)</Label>
                      <Input className="h-9 text-sm" type="number" min={0} value={product.otherCost || ''} onChange={e => updateProduct(idx, 'otherCost', Number(e.target.value))} />
                    </div>
                  </div>

                  <div className="text-right text-xs text-muted-foreground">
                    Subtotal: <span className="font-semibold text-foreground">{formatRp((product.qty * product.pricePerUnit) + product.otherCost)}</span>
                  </div>
                </div>
              ))}

              <div className="text-right text-sm font-semibold text-foreground">
                Total Value: {formatRp(totalValue)}
              </div>
            </div>

            {/* Margin, Probability, Date */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-margin">Expected Margin (%)</Label>
                <Input id="lead-margin" type="number" min={0} max={100} value={expectedMargin} onChange={e => setExpectedMargin(e.target.value)} placeholder="0-100" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-prob">Probability (%)</Label>
                <Input id="lead-prob" type="number" min={0} max={100} value={probability} onChange={e => setProbability(e.target.value)} placeholder="0-100" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-close">Expected Deal/Close</Label>
                <Input id="lead-close" type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea id="lead-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan..." rows={3} />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit">Simpan Lead</Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
