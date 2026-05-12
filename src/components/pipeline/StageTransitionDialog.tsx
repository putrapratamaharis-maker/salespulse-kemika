import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DealStage } from '@/types/sales';

interface StageTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealName: string;
  targetStage: DealStage;
  onConfirm: (data: { poNumber?: string; closeDate?: string }) => void;
}

export function StageTransitionDialog({ open, onOpenChange, dealName, targetStage, onConfirm }: StageTransitionDialogProps) {
  const [poNumber, setPoNumber] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [errors, setErrors] = useState<{ poNumber?: string; closeDate?: string }>({});

  const isInvoice = targetStage === 'invoice_issued';
  const refLabel = isInvoice ? 'No. Invoice' : 'No. PO/SP/SPK';
  const dateLabel = isInvoice ? 'Invoice Issued Date' : 'PO/Won/Closed Date';

  useEffect(() => {
    if (open) {
      setPoNumber('');
      setCloseDate(new Date().toISOString().split('T')[0]);
      setErrors({});
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!poNumber.trim()) newErrors.poNumber = `${refLabel} wajib diisi`;
    if (!closeDate) newErrors.closeDate = `${dateLabel} wajib diisi`;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onConfirm({ poNumber: poNumber.trim(), closeDate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isInvoice ? 'Invoice Issued' : 'PO Secured / Won'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Deal "<span className="font-medium text-foreground">{dealName}</span>" akan dipindahkan ke tahap{' '}
            <span className="font-semibold">{isInvoice ? 'Invoice Issued' : 'PO Secured/Won'}</span>.
            Probability otomatis diatur ke 100%.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>{refLabel} <span className="text-destructive">*</span></Label>
            <Input
              value={poNumber}
              onChange={e => { setPoNumber(e.target.value); setErrors(prev => ({ ...prev, poNumber: undefined })); }}
              placeholder={isInvoice ? 'Contoh: INV-2026-001' : 'Contoh: PO-2026-001'}
              autoFocus
            />
            {errors.poNumber && <p className="text-xs text-destructive">{errors.poNumber}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{dateLabel} <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={closeDate}
              onChange={e => { setCloseDate(e.target.value); setErrors(prev => ({ ...prev, closeDate: undefined })); }}
            />
            {errors.closeDate && <p className="text-xs text-destructive">{errors.closeDate}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit">Ya, Pindahkan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
