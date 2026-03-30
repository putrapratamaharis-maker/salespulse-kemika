import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    net_sales: number;
    gross_profit: number;
    issue_date: string;
    due_date: string;
    paid_date: string | null;
    segment: string;
  } | null;
  onUpdated: () => void;
}

const EditInvoiceDialog = ({ open, onOpenChange, invoice, onUpdated }: EditInvoiceDialogProps) => {
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [segment, setSegment] = useState('B2B');
  const [netSales, setNetSales] = useState('');
  const [grossProfit, setGrossProfit] = useState('');
  const [issueDate, setIssueDate] = useState<Date | undefined>();
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [paidDate, setPaidDate] = useState<Date | undefined>();

  useEffect(() => {
    if (invoice && open) {
      setInvoiceNumber(invoice.invoice_number);
      setSegment(invoice.segment);
      setNetSales(String(invoice.net_sales));
      setGrossProfit(String(invoice.gross_profit));
      setIssueDate(parseISO(invoice.issue_date));
      setDueDate(parseISO(invoice.due_date));
      setPaidDate(invoice.paid_date ? parseISO(invoice.paid_date) : undefined);
    }
  }, [invoice, open]);

  const handleSubmit = async () => {
    if (!invoice) return;
    if (!invoiceNumber.trim()) { toast.error('Nomor invoice wajib diisi'); return; }
    if (!netSales || Number(netSales) <= 0) { toast.error('Net Sales harus lebih dari 0'); return; }
    if (!issueDate) { toast.error('Tanggal terbit wajib diisi'); return; }
    if (!dueDate) { toast.error('Tanggal jatuh tempo wajib diisi'); return; }

    setSaving(true);
    const { error } = await supabase.from('invoices').update({
      invoice_number: invoiceNumber.trim(),
      segment,
      net_sales: Number(netSales),
      gross_profit: Number(grossProfit || 0),
      issue_date: format(issueDate, 'yyyy-MM-dd'),
      due_date: format(dueDate, 'yyyy-MM-dd'),
      paid_date: paidDate ? format(paidDate, 'yyyy-MM-dd') : null,
    }).eq('id', invoice.id);

    setSaving(false);
    if (error) {
      toast.error('Gagal memperbarui invoice: ' + error.message);
    } else {
      toast.success('Invoice berhasil diperbarui');
      onOpenChange(false);
      onUpdated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nomor Invoice *</Label>
            <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="B2B">B2B</SelectItem>
                <SelectItem value="B2C">B2C</SelectItem>
                <SelectItem value="B2G">B2G</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Net Sales (Rp) *</Label>
              <Input type="number" value={netSales} onChange={e => setNetSales(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gross Profit (Rp)</Label>
              <Input type="number" value={grossProfit} onChange={e => setGrossProfit(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal Terbit *</Label>
              <DatePicker date={issueDate} onSelect={setIssueDate} />
            </div>
            <div className="space-y-1.5">
              <Label>Jatuh Tempo *</Label>
              <DatePicker date={dueDate} onSelect={setDueDate} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal Bayar (opsional)</Label>
            <DatePicker date={paidDate} onSelect={setPaidDate} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function DatePicker({ date, onSelect }: { date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd MMM yyyy') : 'Pilih tanggal'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default EditInvoiceDialog;
