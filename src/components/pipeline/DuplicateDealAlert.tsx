import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { DuplicateMatch } from '@/lib/dealDuplicateCheck';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  getAccountName: (accountId: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

const stageLabels: Record<string, string> = {
  prospect: 'Prospect',
  quotation: 'Quotation',
  negotiation: 'Negotiation',
  po_secured: 'PO Secured',
  invoice_issued: 'Invoice Issued',
};

export function DuplicateDealAlert({ open, onOpenChange, duplicates, getAccountName, onConfirm, onCancel }: Props) {
  const formatRp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/15 p-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle>Deal Duplikat Terdeteksi</AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5">
                Ditemukan {duplicates.length} deal dengan <span className="font-medium text-foreground">Akun, Produk, dan Nilai Total yang sama</span>. Apakah Anda yakin ingin tetap menyimpan?
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="max-h-64 overflow-y-auto space-y-2 rounded-md border border-border bg-muted/30 p-3">
          {duplicates.map(({ deal, matchedProducts }) => (
            <div key={deal.id} className="rounded-md border border-border bg-background p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{deal.name}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                  {stageLabels[deal.stage] || deal.stage}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Akun: <span className="text-foreground">{getAccountName(deal.accountId)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Nilai: <span className="text-foreground font-medium">{formatRp(deal.value)}</span>
              </p>
              <div className="text-xs text-muted-foreground">
                Produk yang sama:
                <ul className="mt-1 ml-4 list-disc">
                  {matchedProducts.map((p, i) => (
                    <li key={i} className="text-foreground">{p.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-amber-600 hover:bg-amber-700">
            Tetap Simpan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
