import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DownloadManager() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Download Manager</h2>
        <p className="text-sm text-muted-foreground">Kelola dan unduh report yang telah digenerate.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Riwayat Download</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 rounded-2xl bg-muted/60 flex items-center justify-center mb-6">
              <Download className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Belum ada riwayat download</h3>
            <p className="text-sm text-muted-foreground">Generate report terlebih dahulu, lalu download dari Statement Report.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
