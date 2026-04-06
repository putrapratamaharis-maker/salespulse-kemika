import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { Deal, DealStage, DealProduct, formatIDRFull, formatPercent, formatDate } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { GitBranch, TrendingUp, DollarSign, Clock, AlertTriangle, CalendarClock, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { NewLeadDialog } from '@/components/pipeline/NewLeadDialog';
import { EditDealDialog } from '@/components/pipeline/EditDealDialog';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { DealDetailDialog } from '@/components/pipeline/DealDetailDialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const stageOrder = ['prospect', 'quotation', 'negotiation', 'po_secured', 'invoice_issued', 'canceled', 'lost'];
const stageLabels: Record<string, string> = {
  prospect: 'Prospect',
  quotation: 'Quotation',
  negotiation: 'Negotiation',
  po_secured: 'PO Secured/Won',
  invoice_issued: 'Invoice Issued',
  canceled: 'Canceled',
  lost: 'Lost',
};
const stageColors: Record<string, 'green' | 'yellow' | 'red'> = {
  prospect: 'red',
  quotation: 'yellow',
  negotiation: 'yellow',
  po_secured: 'green',
  invoice_issued: 'green',
  canceled: 'red',
  lost: 'red',
};

const MyPipeline = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'value' | 'probability' | 'expectedCloseDate' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const { toast } = useToast();
  const [localAccounts, setLocalAccounts] = useState<{ id: string; name: string; picName?: string; picContact?: string; picEmail?: string }[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!['sales_person', 'staff_operational'].includes(currentUser.orgRole)) {
      navigate('/my-performance/kpis', { replace: true });
    }
  }, [currentUser.orgRole, navigate]);

  const fetchDeals = async () => {
    setLoading(true);
    const [{ data: dealsData }, { data: accountsData }, { data: dealProductsData }, { data: delReqData }] = await Promise.all([
      supabase.from('deals').select('*').eq('sales_id', currentUser.id),
      supabase.from('accounts').select('id, name, pic_contact, pic_email, pic_name').eq('status', 'Active').order('name'),
      supabase.from('deal_products').select('*'),
      supabase.from('deal_deletion_requests').select('*').eq('requested_by', currentUser.id).order('created_at', { ascending: false }),
    ]);

    const productsMap: Record<string, DealProduct[]> = {};
    (dealProductsData || []).forEach((dp: any) => {
      if (!productsMap[dp.deal_id]) productsMap[dp.deal_id] = [];
      productsMap[dp.deal_id].push({
        id: dp.id,
        category: dp.category,
        productName: dp.product_name,
        unit: dp.unit,
        qty: dp.qty,
        pricePerUnit: Number(dp.price_per_unit),
        otherCost: Number(dp.other_cost),
      });
    });

    const mapped: Deal[] = (dealsData || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      value: d.value,
      stage: d.stage as DealStage,
      probability: d.probability,
      expectedCloseDate: d.expected_close_date,
      createdAt: d.created_at,
      daysInStage: d.days_in_stage,
      updatedAt: d.updated_at,
      segment: d.segment,
      accountId: d.account_id,
      salesId: d.sales_id,
      poNumber: d.po_number || '',
      expectedMargin: Number(d.expected_margin) || 0,
      location: d.location || '',
      notes: d.notes || '',
      products: productsMap[d.id] || [],
    }));
    setDeals(mapped);
    setLocalAccounts((accountsData || []).map((a: any) => ({ id: a.id, name: a.name, picName: a.pic_name, picContact: a.pic_contact, picEmail: a.pic_email })));
    setDeletionRequests(delReqData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, [currentUser.id]);

  const getAccountName = (accountId: string) =>
    localAccounts.find(a => a.id === accountId)?.name || accountId;

  const handleAddDeal = async (deal: Deal) => {
    const { data, error } = await supabase.from('deals').insert({
      name: deal.name,
      account_id: deal.accountId,
      sales_id: deal.salesId,
      segment: deal.segment,
      stage: deal.stage,
      value: deal.value,
      probability: deal.probability,
      expected_close_date: deal.expectedCloseDate,
      days_in_stage: 0,
      po_number: deal.poNumber || '',
      expected_margin: deal.expectedMargin || 0,
      location: deal.location || '',
      notes: deal.notes || '',
    }).select('id').single();
    if (error) {
      toast({ title: 'Gagal menyimpan lead', description: error.message, variant: 'destructive' });
      return;
    }
    // Save deal products
    if (deal.products && deal.products.length > 0 && data?.id) {
      await supabase.from('deal_products').insert(
        deal.products.map(p => ({
          deal_id: data.id,
          category: p.category,
          product_name: p.productName,
          unit: p.unit,
          qty: p.qty,
          price_per_unit: p.pricePerUnit,
          other_cost: p.otherCost,
        }))
      );
    }
    toast({ title: 'Lead berhasil ditambahkan & tersimpan' });
    fetchDeals();
  };

  const handleEditDeal = (deal: Deal) => { setEditingDeal(deal); setEditDialogOpen(true); };

  const handleSaveEdit = async (updatedDeal: Deal) => {
    const { error } = await supabase.from('deals').update({
      name: updatedDeal.name,
      account_id: updatedDeal.accountId,
      segment: updatedDeal.segment,
      stage: updatedDeal.stage,
      value: updatedDeal.value,
      probability: updatedDeal.probability,
      expected_close_date: updatedDeal.expectedCloseDate,
      po_number: updatedDeal.poNumber || '',
      expected_margin: updatedDeal.expectedMargin || 0,
      location: updatedDeal.location || '',
      notes: updatedDeal.notes || '',
    }).eq('id', updatedDeal.id);
    if (error) {
      toast({ title: 'Gagal memperbarui deal', description: error.message, variant: 'destructive' });
      return;
    }
    // Update deal products: delete old, insert new
    if (updatedDeal.products) {
      await supabase.from('deal_products').delete().eq('deal_id', updatedDeal.id);
      if (updatedDeal.products.length > 0) {
        await supabase.from('deal_products').insert(
          updatedDeal.products.map(p => ({
            deal_id: updatedDeal.id,
            category: p.category,
            product_name: p.productName,
            unit: p.unit,
            qty: p.qty,
            price_per_unit: p.pricePerUnit,
            other_cost: p.otherCost,
          }))
        );
      }
    }
    toast({ title: 'Deal berhasil diperbarui' });
    fetchDeals();
  };

  const handleDeleteDeal = async (deal: Deal, reason: string) => {
    // Submit deletion request instead of direct delete
    const { error } = await supabase.from('deal_deletion_requests').insert({
      deal_id: deal.id,
      requested_by: currentUser.id,
      reason,
      deal_snapshot: {
        name: deal.name,
        value: deal.value,
        stage: deal.stage,
        probability: deal.probability,
        segment: deal.segment,
        account_name: getAccountName(deal.accountId),
      },
    });
    if (error) {
      toast({ title: 'Gagal mengajukan penghapusan', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Permintaan hapus deal telah diajukan', description: 'Menunggu persetujuan Admin' });
  };

  const handleStageChange = async (dealId: string, newStage: DealStage, extraData?: { poNumber: string; closeDate: string }) => {
    const isFinalStage = newStage === 'po_secured' || newStage === 'invoice_issued';
    const updatePayload: Record<string, any> = {
      stage: newStage,
      days_in_stage: 0,
      ...(isFinalStage ? { probability: 100 } : {}),
      ...(extraData ? { po_number: extraData.poNumber, expected_close_date: extraData.closeDate } : {}),
    };
    const { error } = await supabase.from('deals').update(updatePayload).eq('id', dealId);
    if (error) {
      toast({ title: 'Gagal memindahkan deal', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Deal dipindahkan ke ${newStage.replace('_', ' ')}` });
    fetchDeals();
  };

  const handleAccountCreated = (account: { id: string; name: string; picName?: string; picContact?: string; picEmail?: string }) => {
    setLocalAccounts(prev => [...prev, account]);
  };

  const handleDuplicateDeal = async (deal: Deal) => {
    const now = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('deals').insert({
      name: `${deal.name} (Copy)`,
      account_id: deal.accountId,
      sales_id: currentUser.id,
      segment: deal.segment,
      stage: 'prospect' as const,
      value: deal.value,
      probability: 0,
      expected_close_date: deal.expectedCloseDate,
      days_in_stage: 0,
      po_number: '',
      expected_margin: deal.expectedMargin || 0,
      location: deal.location || '',
      notes: deal.notes || '',
    }).select('id').single();
    if (error) {
      toast({ title: 'Gagal menduplikasi deal', description: error.message, variant: 'destructive' });
      return;
    }
    // Duplicate products
    if (deal.products && deal.products.length > 0 && data?.id) {
      await supabase.from('deal_products').insert(
        deal.products.map(p => ({
          deal_id: data.id,
          category: p.category,
          product_name: p.productName,
          unit: p.unit,
          qty: p.qty,
          price_per_unit: p.pricePerUnit,
          other_cost: p.otherCost,
        }))
      );
    }
    toast({ title: 'Deal berhasil diduplikasi sebagai lead baru' });
    fetchDeals();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeDeals = deals.filter(d => !['po_secured', 'invoice_issued', 'canceled', 'lost'].includes(d.stage));
  const pipelineValue = activeDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = activeDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);
  const avgProbability = activeDeals.length > 0 ? activeDeals.reduce((s, d) => s + d.probability, 0) / activeDeals.length : 0;

  const nearingClose = activeDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30 && days >= 0;
  });

  const nextMonthClose = activeDeals.filter(d => {
    const closeDate = new Date(d.expectedCloseDate);
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return closeDate >= nextMonth && closeDate <= nextMonthEnd;
  });

  const staleDeals = activeDeals.filter(d => d.daysInStage > 10);
  const stuckDeals14 = activeDeals.filter(d => d.daysInStage > 14);

  const stageSummary = stageOrder.filter(s => !['canceled', 'lost'].includes(s)).map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    return { stage, label: stageLabels[stage], count: stageDeals.length, value: stageDeals.reduce((s, d) => s + d.value, 0), color: stageColors[stage] };
  });
  const maxStageValue = Math.max(...stageSummary.map(s => s.value), 1);

  const accountOptions = localAccounts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Leads & Forecast</h2>
          <p className="text-sm text-muted-foreground">Lead pipeline & forecast — {currentUser.name}</p>
        </div>
        <NewLeadDialog onAdd={handleAddDeal} accountOptions={accountOptions} salesId={currentUser.id} onAccountCreated={handleAccountCreated} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Pipeline Value" value={formatIDRFull(pipelineValue)} icon={DollarSign} autoFitText className="bg-kpi-blue" borderAccent="border-l-kpi-blue-border" tooltip="Total nilai deal aktif Anda (Prospect, Quotation, Negotiation)" />
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} icon={TrendingUp} autoFitText className="bg-kpi-teal" borderAccent="border-l-kpi-teal-border" tooltip="Σ (value × probability / 100) dari deal aktif Anda, tidak termasuk PO Secured, Invoice Issued, Canceled, Lost" />
        <KPICard label="Active Deals" value={String(activeDeals.length)} icon={GitBranch} autoFitText className="bg-kpi-purple" borderAccent="border-l-kpi-purple-border" tooltip="Jumlah deal Anda yang masih dalam tahap aktif (belum won/lost/canceled)" />
        <KPICard label="Avg Probability" value={formatPercent(avgProbability)} status={avgProbability >= 50 ? 'green' : 'yellow'} icon={TrendingUp} autoFitText className="bg-kpi-amber" borderAccent="border-l-kpi-amber-border" tooltip="Rata-rata probability dari seluruh deal aktif Anda" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard label="Next Month Closing" value={String(nextMonthClose.length)} changeLabel={nextMonthClose.length > 0 ? formatIDRFull(nextMonthClose.reduce((s, d) => s + d.value, 0)) : 'No deals'} icon={CalendarClock} status={nextMonthClose.length > 0 ? 'green' : 'yellow'} autoFitText className="bg-kpi-emerald" borderAccent="border-l-kpi-emerald-border" tooltip="Deal yang expected close date-nya dalam bulan depan" />
        <KPICard label="Deals Stuck (>14D)" value={String(stuckDeals14.length)} changeLabel={stuckDeals14.length > 0 ? formatIDRFull(stuckDeals14.reduce((s, d) => s + d.value, 0)) + ' at risk' : 'All clear!'} icon={ShieldAlert} status={stuckDeals14.length > 0 ? 'red' : 'green'} autoFitText className="bg-kpi-rose" borderAccent="border-l-kpi-rose-border" tooltip="Deal yang sudah > 14 hari tanpa perubahan stage" />
      </div>

      <KanbanBoard deals={deals} getAccountName={getAccountName} getAccountPIC={(accountId: string) => { const a = localAccounts.find(x => x.id === accountId); return a ? { picName: a.picName, picEmail: a.picEmail, picContact: a.picContact } : undefined; }} onEdit={handleEditDeal} onDelete={handleDeleteDeal} onDuplicate={handleDuplicateDeal} onStageChange={handleStageChange} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Pipeline Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stageSummary.map(s => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-28 shrink-0"><StatusBadge status={s.color} label={s.label} /></div>
                <div className="flex-1"><Progress value={(s.value / maxStageValue) * 100} className="h-2" /></div>
                <span className="text-sm font-medium w-12 text-right">{s.count}</span>
                <span className="text-sm text-muted-foreground w-28 text-right">{formatIDRFull(s.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Closing Within 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nearingClose.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals closing soon.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Deal</TableHead>
                  <TableHead className="text-xs">Value</TableHead>
                  <TableHead className="text-xs">Prob.</TableHead>
                  <TableHead className="text-xs">Close Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {nearingClose.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">{formatIDRFull(d.value)}</TableCell>
                      <TableCell><StatusBadge status={d.probability >= 60 ? 'green' : d.probability >= 30 ? 'yellow' : 'red'} label={`${d.probability}%`} /></TableCell>
                      <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-red" />
              Stale Deals ({'>'}10 days in stage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stale deals. Keep it up!</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Deal</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Days</TableHead>
                  <TableHead className="text-xs">Value</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {staleDeals.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell><StatusBadge status={stageColors[d.stage]} label={stageLabels[d.stage]} /></TableCell>
                      <TableCell className="text-sm text-status-red font-semibold">{d.daysInStage}d</TableCell>
                      <TableCell className="text-sm">{formatIDRFull(d.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {(() => {
        const toggleSort = (key: 'value' | 'probability' | 'expectedCloseDate') => {
          if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
          else { setSortKey(key); setSortDir('desc'); }
        };
        const SortIcon = ({ col }: { col: string }) => {
          if (sortKey !== col) return <ArrowUpDown className="inline h-3 w-3 ml-1 text-muted-foreground" />;
          return sortDir === 'asc' ? <ArrowUp className="inline h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="inline h-3 w-3 ml-1 text-primary" />;
        };
        const sortedDeals = [...deals].sort((a, b) => {
          if (!sortKey) return 0;
          let cmp = 0;
          if (sortKey === 'value') cmp = a.value - b.value;
          else if (sortKey === 'probability') cmp = a.probability - b.probability;
          else cmp = new Date(a.expectedCloseDate).getTime() - new Date(b.expectedCloseDate).getTime();
          return sortDir === 'asc' ? cmp : -cmp;
        });
        return (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">All Deals</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Deal</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('value')}>Value <SortIcon col="value" /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('probability')}>Probability <SortIcon col="probability" /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('expectedCloseDate')}>Expected Close <SortIcon col="expectedCloseDate" /></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedDeals.map(d => (
                    <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailDeal(d)}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">{getAccountName(d.accountId)}</TableCell>
                      <TableCell><StatusBadge status={stageColors[d.stage]} label={stageLabels[d.stage]} /></TableCell>
                      <TableCell className="text-sm">{formatIDRFull(d.value)}</TableCell>
                      <TableCell className="text-sm">{d.probability}%</TableCell>
                      <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      {deletionRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              Permintaan Hapus Deal
              {deletionRequests.filter(r => r.status === 'pending').length > 0 && (
                <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50 text-[10px]">
                  {deletionRequests.filter(r => r.status === 'pending').length} pending
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tanggal</TableHead>
                  <TableHead className="text-xs">Deal</TableHead>
                  <TableHead className="text-xs">Alasan</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Catatan Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletionRequests.map(r => {
                  const snapshot = r.deal_snapshot as any;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{snapshot?.name || 'N/A'}</div>
                        {snapshot?.account_name && <div className="text-xs text-muted-foreground">{snapshot.account_name}</div>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={r.reason}>{r.reason}</TableCell>
                      <TableCell>
                        {r.status === 'pending' && <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">Pending</Badge>}
                        {r.status === 'approved' && <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">Disetujui</Badge>}
                        {r.status === 'rejected' && <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">Ditolak</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.review_notes || ''}>
                        {r.review_notes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {editDialogOpen && editingDeal && (
        <EditDealDialog deal={editingDeal} open={true} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditingDeal(null); } }} onSave={handleSaveEdit} accountOptions={accountOptions} salesId={currentUser.id} onAccountCreated={handleAccountCreated} />
      )}
      <DealDetailDialog deal={detailDeal} open={!!detailDeal} onOpenChange={(open) => !open && setDetailDeal(null)} getAccountName={getAccountName} getAccountPIC={(accountId: string) => { const a = localAccounts.find(x => x.id === accountId); return a ? { picName: a.picName, picEmail: a.picEmail, picContact: a.picContact } : undefined; }} />
    </div>
  );
};

export default MyPipeline;
