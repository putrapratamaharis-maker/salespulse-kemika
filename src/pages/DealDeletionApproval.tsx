import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Check, X, Eye, Trash2 } from 'lucide-react';
import { formatIDRFull, formatDate } from '@/types/sales';
import { useNavigate } from 'react-router-dom';

interface DeletionRequest {
  id: string;
  deal_id: string;
  requested_by: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  deal_snapshot: any;
  created_at: string;
  requester_name?: string;
  reviewer_name?: string;
  deal_name?: string;
  account_name?: string;
}

export default function DealDeletionApproval() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ request: DeletionRequest; action: 'approve' | 'reject' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [detailRequest, setDetailRequest] = useState<DeletionRequest | null>(null);

  const isAdmin = userRole && ['super_admin', 'admin'].includes(userRole.system_role);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/', { replace: true });
      return;
    }
    fetchRequests();
  }, [isAdmin]);

  const fetchRequests = async () => {
    setLoading(true);
    
    const { data: reqData } = await supabase
      .from('deal_deletion_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!reqData) { setLoading(false); return; }

    // Get unique user IDs and deal IDs
    const userIds = [...new Set([
      ...reqData.map(r => r.requested_by),
      ...reqData.filter(r => r.reviewed_by).map(r => r.reviewed_by!),
    ])];
    const dealIds = [...new Set(reqData.map(r => r.deal_id))];

    const [{ data: profiles }, { data: deals }, { data: accounts }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
      supabase.from('deals').select('id, name, account_id'),
      supabase.from('accounts').select('id, name'),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
    const dealMap = new Map((deals || []).map(d => [d.id, d]));
    const accMap = new Map((accounts || []).map(a => [a.id, a.name]));

    const mapped: DeletionRequest[] = reqData.map(r => {
      const deal = dealMap.get(r.deal_id);
      return {
        ...r,
        requester_name: profileMap.get(r.requested_by) || r.requested_by,
        reviewer_name: r.reviewed_by ? profileMap.get(r.reviewed_by) || r.reviewed_by : undefined,
        deal_name: deal?.name || (r.deal_snapshot as any)?.name || 'Deleted',
        account_name: deal ? accMap.get(deal.account_id) || '' : (r.deal_snapshot as any)?.account_name || '',
      };
    });

    setRequests(mapped);
    setLoading(false);
  };

  const handleAction = async () => {
    if (!actionDialog) return;
    setProcessing(true);

    const { request, action } = actionDialog;

    try {
      if (action === 'approve') {
        // Delete the deal first
        const { error: deleteError } = await supabase
          .from('deals')
          .delete()
          .eq('id', request.deal_id);

        if (deleteError) {
          toast({ title: 'Gagal menghapus deal', description: deleteError.message, variant: 'destructive' });
          setProcessing(false);
          return;
        }
      }

      // Update the request status
      const currentUserId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase
        .from('deal_deletion_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) {
        toast({ title: 'Gagal memproses permintaan', description: error.message, variant: 'destructive' });
      } else {
        // Send notification to the requester
        const dealName = request.deal_name || (request.deal_snapshot as any)?.name || 'Deal';
        await supabase.from('notifications').insert({
          user_id: request.requested_by,
          title: action === 'approve' ? 'Permintaan Hapus Deal Disetujui' : 'Permintaan Hapus Deal Ditolak',
          message: action === 'approve'
            ? `Permintaan hapus deal "${dealName}" telah disetujui dan deal telah dihapus.${reviewNotes.trim() ? ` Catatan: ${reviewNotes.trim()}` : ''}`
            : `Permintaan hapus deal "${dealName}" telah ditolak.${reviewNotes.trim() ? ` Catatan: ${reviewNotes.trim()}` : ''}`,
          type: action === 'approve' ? 'deletion_approved' : 'deletion_rejected',
          reference_id: request.id,
          reference_type: 'deal_deletion_request',
        });

        toast({ title: action === 'approve' ? 'Deal berhasil dihapus' : 'Permintaan ditolak' });
        fetchRequests();
      }
    } finally {
      setProcessing(false);
      setActionDialog(null);
      setReviewNotes('');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">Approved</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Persetujuan Hapus Deal</h2>
        <p className="text-sm text-muted-foreground">
          {pendingCount > 0 ? `${pendingCount} permintaan menunggu persetujuan` : 'Tidak ada permintaan pending'}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Riwayat Permintaan Hapus Deal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada permintaan penghapusan deal.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Deal</TableHead>
                  <TableHead className="text-xs">Diajukan Oleh</TableHead>
                  <TableHead className="text-xs">Alasan</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Reviewer</TableHead>
                  <TableHead className="text-xs text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{r.deal_name}</div>
                      <div className="text-xs text-muted-foreground">{r.account_name}</div>
                    </TableCell>
                    <TableCell className="text-xs">{r.requester_name}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={r.reason}>{r.reason}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-xs">
                      {r.reviewer_name ? (
                        <div>
                          <span>{r.reviewer_name}</span>
                          {r.reviewed_at && <span className="block text-muted-foreground">{formatDate(r.reviewed_at)}</span>}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailRequest(r)} title="Lihat detail">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {r.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => { setActionDialog({ request: r, action: 'approve' }); setReviewNotes(''); }}
                              title="Setujui"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => { setActionDialog({ request: r, action: 'reject' }); setReviewNotes(''); }}
                              title="Tolak"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!processing && !o) { setActionDialog(null); setReviewNotes(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' ? 'Setujui Penghapusan Deal' : 'Tolak Permintaan Hapus'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'approve'
                ? `Deal "${actionDialog?.request.deal_name}" akan dihapus secara permanen.`
                : `Permintaan hapus deal "${actionDialog?.request.deal_name}" akan ditolak.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Alasan pemohon:</p>
              <p className="text-sm bg-muted/50 rounded-md p-2">{actionDialog?.request.reason}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Catatan Review (opsional)</label>
              <Textarea
                placeholder="Tambahkan catatan..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className="mt-1"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={processing}>Batal</Button>
            <Button
              variant={actionDialog?.action === 'approve' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={processing}
            >
              {processing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {actionDialog?.action === 'approve' ? 'Setujui & Hapus' : 'Tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailRequest} onOpenChange={(o) => !o && setDetailRequest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Permintaan Hapus Deal</DialogTitle>
          </DialogHeader>
          {detailRequest && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Deal</p>
                  <p className="font-medium">{detailRequest.deal_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account</p>
                  <p>{detailRequest.account_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Diajukan Oleh</p>
                  <p>{detailRequest.requester_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Pengajuan</p>
                  <p>{formatDate(detailRequest.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {statusBadge(detailRequest.status)}
                </div>
                {detailRequest.reviewer_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Reviewer</p>
                    <p>{detailRequest.reviewer_name} ({formatDate(detailRequest.reviewed_at || '')})</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Alasan Penghapusan</p>
                <p className="bg-muted/50 rounded-md p-2.5">{detailRequest.reason}</p>
              </div>
              {detailRequest.review_notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Catatan Review</p>
                  <p className="bg-muted/50 rounded-md p-2.5">{detailRequest.review_notes}</p>
                </div>
              )}
              {detailRequest.deal_snapshot && Object.keys(detailRequest.deal_snapshot).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Snapshot Deal (saat diajukan)</p>
                  <div className="bg-muted/50 rounded-md p-2.5 text-xs space-y-1">
                    {(detailRequest.deal_snapshot as any).value && (
                      <p>Value: {formatIDRFull((detailRequest.deal_snapshot as any).value)}</p>
                    )}
                    {(detailRequest.deal_snapshot as any).stage && (
                      <p>Stage: {(detailRequest.deal_snapshot as any).stage}</p>
                    )}
                    {(detailRequest.deal_snapshot as any).probability !== undefined && (
                      <p>Probability: {(detailRequest.deal_snapshot as any).probability}%</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
