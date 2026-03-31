import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  { value: 'prospect', label: 'Prospect' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'po_secured', label: 'PO Secured/Won' },
  { value: 'invoice_issued', label: 'Invoice Issued' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'lost', label: 'Lost' },
];

const segmentOptions: { value: string; label: string }[] = [
  { value: 'B2G', label: 'B2G' },
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C/e-Commerce' },
];

interface EditDealDialogProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (deal: Deal) => void;
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

export function EditDealDialog({ deal, open, onOpenChange, onSave, accountOptions, salesId, onAccountCreated }: EditDealDialogProps) {
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
  const [segment, setSegment] = useState('B2B');
  const [stage, setStage] = useState<DealStage>('prospect');
  const [products, setProducts] = useState<DealProduct[]>([emptyProduct()]);
  const [expectedMargin, setExpectedMargin] = useState('');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [poNumber, setPoNumber] = useState('');

  useEffect(() => {
    if (deal && open) {
      setAccountId(deal.accountId);
      setLocation(deal.location || '');
      setSegment(deal.segment);
      setStage(deal.stage);
      setProducts(deal.products && deal.products.length > 0 ? deal.products : [emptyProduct()]);
      setExpectedMargin(deal.expectedMargin ? String(deal.expectedMargin) : '');
      setProbability(String(deal.probability));
      setExpectedCloseDate(deal.expectedCloseDate);
      setNotes(deal.notes || '');
      setPoNumber(deal.poNumber || '');
    }
  }, [deal, open]);

  const selectedAccount = accountOptions.find(a => a.id === accountId);
  const totalValue = products.reduce((sum, p) => sum + (p.qty * p.pricePerUnit) + p.otherCost, 0);

  const updateProduct = (index: number, field: keyof DealProduct, value: string | number) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  // Auto-fill category, unit, price when selecting product from DB
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

  const formatRp = (val: number) => val > 0 ? `Rp ${val.toLocaleString('id-ID')}` : '-';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal || !accountId || !expectedCloseDate) {
      toast({ title: 'Lengkapi semua field yang diperlukan', variant: 'destructive' });
      return;
    }

    const dealName = products.length === 1
      ? (products[0].productName || deal.name)
      : `${products[0].productName || deal.name} (+${products.length - 1} item)`;

    const updated: Deal = {
      ...deal,
      accountId,
      name: dealName,
      segment: segment as Segment,
      stage,
      value: totalValue > 0 ? totalValue : deal.value,
      probability: Number(probability) || 0,
      expectedCloseDate,
      updatedAt: new Date().toISOString().split('T')[0],
      location,
      notes,
      expectedMargin: Number(expectedMargin) || 0,
      products,
      poNumber,
    };

    onSave(updated);
    toast({ title: 'Deal berhasil diperbarui' });
    onOpenChange(false);
  };

  if (!deal) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4 mt-3">
            {/* Account */}
            <AccountSelectWithCreate
              accounts={accountOptions}
              value={accountId}
              onValueChange={setAccountId}
              salesId={salesId}
              onAccountCreated={(acc) => {
                setAccountId(acc.id);
                onAccountCreated?.(acc);
              }}
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
                <Label>Letak Project / Instansi</Label>
                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Contoh: Jakarta Pusat" />
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

            {/* No. PO/SP/SPK or No. Invoice - shown for final stages */}
            {(stage === 'po_secured' || stage === 'invoice_issued') && (
              <div className="space-y-1.5">
                <Label>{stage === 'invoice_issued' ? 'No. Invoice' : 'No. PO/SP/SPK'}</Label>
                <Input
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  placeholder={stage === 'invoice_issued' ? 'Contoh: INV-2026-001' : 'Contoh: PO-2026-001'}
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Product / Item</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setProducts(prev => [...prev, emptyProduct()])}>
                  <Plus className="h-3 w-3" /> Add Product
                </Button>
              </div>

              {products.map((product, idx) => (
                <div key={product.id} className="rounded-md border border-border p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Item #{idx + 1}</span>
                    {products.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => setProducts(prev => prev.filter((_, i) => i !== idx))}>
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
                          {dbCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
                      <Select value={product.unit} onValueChange={v => updateProduct(idx, 'unit', v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {dbUnits.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qty</Label>
                      <Input className="h-9 text-sm" type="number" min={1} value={product.qty} onChange={e => updateProduct(idx, 'qty', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Price/Unit (Rp)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="text"
                        inputMode="numeric"
                        value={product.pricePerUnit ? `Rp ${product.pricePerUnit.toLocaleString('id-ID')}` : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          updateProduct(idx, 'pricePerUnit', Number(raw) || 0);
                        }}
                        onFocus={e => {
                          const raw = String(product.pricePerUnit || '');
                          e.target.value = raw;
                          e.target.type = 'number';
                        }}
                        onBlur={e => {
                          e.target.type = 'text';
                        }}
                        placeholder="Rp 0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Biaya Lainnya (Rp)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="text"
                        inputMode="numeric"
                        value={product.otherCost ? `Rp ${product.otherCost.toLocaleString('id-ID')}` : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          updateProduct(idx, 'otherCost', Number(raw) || 0);
                        }}
                        onFocus={e => {
                          const raw = String(product.otherCost || '');
                          e.target.value = raw;
                          e.target.type = 'number';
                        }}
                        onBlur={e => {
                          e.target.type = 'text';
                        }}
                        placeholder="Rp 0"
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
                <Label>{stage === 'po_secured' || stage === 'invoice_issued' ? 'Gross Margin (%)' : 'Expected Margin (%)'}</Label>
                <Input type="number" min={0} max={100} step="0.01" value={expectedMargin} onChange={e => setExpectedMargin(e.target.value)} placeholder="0-100" />
              </div>
              <div className="space-y-1.5">
                <Label>Probability (%)</Label>
                <Input type="number" min={0} max={100} step="0.01" value={stage === 'po_secured' || stage === 'invoice_issued' ? '100' : probability} onChange={e => { if (stage !== 'po_secured' && stage !== 'invoice_issued') setProbability(e.target.value); }} disabled={stage === 'po_secured' || stage === 'invoice_issued'} placeholder="0-100" />
              </div>
              <div className="space-y-1.5">
                <Label>{stage === 'invoice_issued' ? 'Invoice Issued Date' : stage === 'po_secured' ? 'PO/Won/Closed Date' : 'Expected Deal/Close'}</Label>
                <Input type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan..." rows={3} />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit">Simpan Perubahan</Button>
            </div>
          </form>
        </ScrollArea>
        </>
        ) : (
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}
