import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { Deal, DealStage, Segment } from '@/types/sales';
import { useToast } from '@/hooks/use-toast';

const stageOptions: { value: DealStage; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
];

const segmentOptions: Segment[] = ['B2B', 'B2G', 'B2C'];

interface NewLeadDialogProps {
  onAdd: (deal: Deal) => void;
  accountOptions: { id: string; name: string }[];
  salesId: string;
}

export function NewLeadDialog({ onAdd, accountOptions, salesId }: NewLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [segment, setSegment] = useState<Segment>('B2B');
  const [stage, setStage] = useState<DealStage>('prospect');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');

  const resetForm = () => {
    setName('');
    setAccountId('');
    setSegment('B2B');
    setStage('prospect');
    setValue('');
    setProbability('');
    setExpectedCloseDate('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !accountId || !value || !probability || !expectedCloseDate) {
      toast({ title: 'Lengkapi semua field', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const newDeal: Deal = {
      id: `new-${Date.now()}`,
      accountId,
      salesId,
      name,
      segment,
      stage,
      value: Number(value),
      probability: Number(probability),
      expectedCloseDate,
      createdAt: now,
      updatedAt: now,
      daysInStage: 0,
    };

    onAdd(newDeal);
    toast({ title: 'Lead berhasil ditambahkan' });
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Lead / Forecast Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Nama Deal</Label>
            <Input id="lead-name" value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Network Upgrade Project" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Pilih account" /></SelectTrigger>
                <SelectContent>
                  {accountOptions.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Segment</Label>
              <Select value={segment} onValueChange={v => setSegment(v as Segment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {segmentOptions.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label htmlFor="lead-prob">Probability (%)</Label>
              <Input id="lead-prob" type="number" min={0} max={100} value={probability} onChange={e => setProbability(e.target.value)} placeholder="0-100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-value">Value (Rp)</Label>
              <Input id="lead-value" type="number" min={0} value={value} onChange={e => setValue(e.target.value)} placeholder="500000000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-close">Expected Close</Label>
              <Input id="lead-close" type="date" value={expectedCloseDate} onChange={e => setExpectedCloseDate(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Lead</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
