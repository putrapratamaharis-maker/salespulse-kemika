import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { Deal, DealStage, DealProduct, Segment } from '@/types/sales';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AccountSelectWithCreate } from '@/components/InlineAccountCreate';
import { supabase } from '@/integrations/supabase/client';

const stageOptions: { value: DealStage; label: string }[] = [
  { value: 'prospect', label: 'Qualified Prospect' },
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

  // Master data from DB
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string }[]>([]);
  const [dbProducts, setDbProducts] = useState<{ id: string; name: string; category_id: string | null; unit: string | null; price: number; selling_price: number | null }[]>([]);
  const [dbUnits, setDbUnits] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchMasters = async () => {
      const [{ data: cats }, { data: prods }, { data: units }] = await Promise.all([
        supabase.from('product_categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('products').select('id, name, category_id, unit, price, selling_price').eq('is_active', true).order('name'),
        supabase.from('units').select('id, name').eq('is_active', true).order('name'),
      ]);
      setDbCategories(cats || []);
      setDbProducts(prods || []);
      setDbUnits(units || []);
    };
    if (open) fetchMasters();
  }, [open]);

  const [accountId, setAccountId] = useState('');
  const [location, setLocation] = useState('');
  const [segment, setSegment] = useState<string>('B2B');
  const [stage, setStage] = useState<DealStage>('prospect');
  const [products, setProducts] = useState<DealProduct[]>([emptyProduct()]);
  const [expectedMargin, setExpectedMargin] = useState('');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [notes, setNotes] = useState('');

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

  // When user selects a product name from DB, auto-fill category, unit, price
  const handleProductSelect = (index: number, productId: string) => {
    const prod = dbProducts.find(p => p.id === productId);
    if (!prod) return;
    const cat = dbCategories.find(c => c.id === prod.category_id);
    setProducts(prev => prev.map((p, i) => i === index ? {
      ...p,
      productName: prod.name,
      category: cat?.name || '',
      unit: prod.unit || 'pcs',
      pricePerUnit: Number(prod.selling_price) || Number(prod.price) || 0,
    } : p));
  };

  // Filter products by selected category
  const getFilteredProducts = (categoryName: string) => {
    if (!categoryName) return dbProducts;
    const cat = dbCategories.find(c => c.name === categoryName);
    if (!cat) return dbProducts;
    return dbProducts.filter(p => p.category_id === cat.id);
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
    resetForm();
    setOpen(false);
  };

  const formatRp = (val: number) =>
    val > 0 ? `Rp ${val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

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
            <AccountSelectWithCreate
              accounts={accountOptions}
              value={accountId}
              onValueChange={setAccountId}
              salesId={salesId}
              onAccountCreated={(acc) => {
                onAccountCreated?.(acc);
              }}
              label="Account / Customer Name"
            />

            {selectedAccount && (
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
                          {dbCategories.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product Name</Label>
                      <Select
                        value={product.productName}
                        onValueChange={v => {
                          const prod = dbProducts.find(p => p.name === v);
                          if (prod) handleProductSelect(idx, prod.id);
                          else updateProduct(idx, 'productName', v);
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                        <SelectContent>
                          {getFilteredProducts(product.category).map(p => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Satuan Unit</Label>
                      <Input
                        className="h-9 text-sm bg-muted"
                        value={product.unit}
                        readOnly
                        disabled
                        placeholder="Auto dari produk"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qty</Label>
                      <Input className="h-9 text-sm" type="number" min={1} value={product.qty} onChange={e => updateProduct(idx, 'qty', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Price/Unit (Rp)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        value={product.pricePerUnit || ''}
                        onChange={e => updateProduct(idx, 'pricePerUnit', Number(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Biaya Lainnya (Rp)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        value={product.otherCost || ''}
                        onChange={e => updateProduct(idx, 'otherCost', Number(e.target.value) || 0)}
                        placeholder="0"
                      />
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
                <Label htmlFor="lead-margin">{stage === 'po_secured' || stage === 'invoice_issued' ? 'Gross Margin (%)' : 'Expected Margin (%)'}</Label>
                <Input id="lead-margin" type="number" min={0} max={100} step="0.01" value={expectedMargin} onChange={e => setExpectedMargin(e.target.value)} placeholder="0-100" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-prob">Probability (%)</Label>
                <Input id="lead-prob" type="number" min={0} max={100} value={stage === 'po_secured' || stage === 'invoice_issued' ? '100' : probability} onChange={e => { if (stage !== 'po_secured' && stage !== 'invoice_issued') setProbability(e.target.value); }} disabled={stage === 'po_secured' || stage === 'invoice_issued'} placeholder="0-100" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-close">{stage === 'invoice_issued' ? 'Invoice Issued Date' : stage === 'po_secured' ? 'PO/Won/Closed Date' : 'Expected Deal/Close'}</Label>
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
