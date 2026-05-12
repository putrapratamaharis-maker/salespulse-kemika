import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LostReason, LOST_REASON_LABELS } from '@/types/sales';

interface LostDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealName: string;
  onConfirm: (data: { lostReason: LostReason; lostNotes: string }) => void;
}

export function LostDealDialog({ open, onOpenChange, dealName, onConfirm }: LostDealDialogProps) {
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [lostNotes, setLostNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setLostReason('');
      setLostNotes('');
      setError('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostReason) {
      setError('Alasan lost wajib dipilih');
      return;
    }
    onConfirm({ lostReason, lostNotes: lostNotes.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-destructive">✗</span> Deal Ditandai Lost
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Deal <span className="font-medium text-foreground">"{dealName}"</span> akan dipindahkan ke tahap <span className="font-semibold text-destructive">Lost</span>. Mohon isi alasan di bawah untuk evaluasi.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Alasan Lost <span className="text-destructive">*</span></Label>
            <Select
              value={lostReason}
              onValueChange={(val) => { setLostReason(val as LostReason); setError(''); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih alasan..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(LOST_REASON_LABELS) as [LostReason, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Catatan Tambahan <span className="text-muted-foreground text-xs">(opsional)</span></Label>
            <Textarea
              value={lostNotes}
              onChange={e => setLostNotes(e.target.value)}
              placeholder="Contoh: Customer memilih supplier lain karena harga lebih murah 15%..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{lostNotes.length}/500</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" variant="destructive">Ya, Tandai Lost</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
