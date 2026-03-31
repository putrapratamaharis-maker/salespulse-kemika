import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteDealRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealName: string;
  onSubmit: (reason: string) => Promise<void>;
}

export function DeleteDealRequestDialog({ open, onOpenChange, dealName, onSubmit }: DeleteDealRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 10) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) { onOpenChange(o); if (!o) setReason(''); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permintaan Hapus Deal
          </DialogTitle>
          <DialogDescription>
            Deal "<span className="font-semibold">{dealName}</span>" akan diajukan untuk dihapus. Persetujuan dari Admin diperlukan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="delete-reason" className="text-sm font-medium">
              Alasan Penghapusan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="delete-reason"
              placeholder="Jelaskan alasan penghapusan deal ini (min. 10 karakter)..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-1.5 min-h-[100px]"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {reason.length}/500 karakter {reason.trim().length > 0 && reason.trim().length < 10 && '— minimal 10 karakter'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason.trim() || reason.trim().length < 10 || submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Ajukan Penghapusan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
