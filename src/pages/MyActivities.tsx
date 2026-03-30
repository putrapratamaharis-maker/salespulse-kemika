import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { Activity, Phone, Users, MapPin, FileText, Clock, Loader2, Plus, Pencil, Trash2, Search, X, Monitor, GraduationCap, Download, ArrowUpDown, ArrowUp, ArrowDown, Settings2, Eye, ExternalLink, UserPlus } from 'lucide-react';
import { WeeklyTrendChart } from '@/components/activities/WeeklyTrendChart';
import { ActivityPagination } from '@/components/activities/ActivityPagination';
import { MonthlyStats } from '@/components/activities/MonthlyStats';
import { OverdueReminders } from '@/components/activities/OverdueReminders';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AccountSelectWithCreate } from '@/components/InlineAccountCreate';

interface SalesActivity {
  id: string;
  sales_id: string;
  type: string;
  activity_date: string;
  account_id: string | null;
  notes: string | null;
  next_action_date: string | null;
  cost: number | null;
  purpose: string | null;
  outcome: string | null;
  evidence_url: string | null;
  created_at: string;
}

// Helper to get a signed URL for evidence files (bucket is now private)
async function getSignedEvidenceUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data, error } = await supabase.storage.from('activity-evidence').createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

interface Account {
  id: string;
  name: string;
}

const activityIcons: Record<string, React.ElementType> = {
  call_chat: Phone,
  visit: MapPin,
  online_meeting: Monitor,
  training: GraduationCap,
  demo: Activity,
};

const activityColors: Record<string, 'green' | 'yellow' | 'red'> = {
  call_chat: 'green',
  visit: 'green',
  online_meeting: 'green',
  training: 'yellow',
  demo: 'yellow',
};

const ACTIVITY_TYPES = ['call_chat', 'visit', 'online_meeting', 'training', 'demo'] as const;

const activityLabels: Record<string, string> = {
  call_chat: 'Call/Chat',
  visit: 'Visit',
  online_meeting: 'Online Meeting',
  training: 'Training',
  demo: 'Demo',
};

const MyActivities = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SalesActivity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalesActivity | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Filter state
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Form state
  const [formType, setFormType] = useState<string>('call_chat');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formAccountId, setFormAccountId] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [formNextActionDate, setFormNextActionDate] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [formOutcome, setFormOutcome] = useState('');
  const [formEvidenceFile, setFormEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sort state
  type SortKey = 'activity_date' | 'type' | 'account';
  const [sortKey, setSortKey] = useState<SortKey>('activity_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Column visibility state
  type ColumnKey = 'date' | 'type' | 'account' | 'purpose' | 'outcome' | 'notes' | 'cost' | 'evidence' | 'next_action';
  const allColumns: { key: ColumnKey; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'account', label: 'Account/Customer' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'outcome', label: 'Outcome' },
    { key: 'notes', label: 'Notes' },
    { key: 'cost', label: 'Cost (Rp.)' },
    { key: 'evidence', label: 'Evidence' },
    { key: 'next_action', label: 'Next Action' },
  ];
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(['date', 'type', 'account', 'purpose', 'outcome', 'notes', 'cost', 'evidence', 'next_action'])
  );
  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 2) next.delete(key); } // keep at least 2
      else next.add(key);
      return next;
    });
  };

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'activity_date' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  }, [sortKey]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [actRes, accRes] = await Promise.all([
      supabase
        .from('sales_activities')
        .select('*')
        .eq('sales_id', user.id)
        .order('activity_date', { ascending: false }),
      supabase.from('accounts').select('id, name'),
    ]);

    if (actRes.data) setActivities(actRes.data as SalesActivity[]);
    if (accRes.data) setAccounts(accRes.data as Account[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const resetForm = () => {
    setFormType('call_chat');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormAccountId('');
    setFormNotes('');
    setFormNextActionDate('');
    setFormCost('');
    setFormPurpose('');
    setFormOutcome('');
    setFormEvidenceFile(null);
    setEditingActivity(null);
  };

  const openEditDialog = (act: SalesActivity) => {
    setEditingActivity(act);
    setFormType(act.type);
    setFormDate(act.activity_date);
    setFormAccountId(act.account_id || '');
    setFormNotes(act.notes || '');
    setFormNextActionDate(act.next_action_date || '');
    setFormCost(act.cost != null ? String(act.cost) : '');
    setFormPurpose(act.purpose || '');
    setFormOutcome(act.outcome || '');
    setFormEvidenceFile(null);
    setDialogOpen(true);
  };

  const ALLOWED_EVIDENCE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'text/plain',
  ];
  const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleSubmit = async () => {
    if (!user) return;
    if (!formPurpose.trim()) {
      toast({ title: 'Validation', description: 'Purpose/Tujuan wajib diisi.', variant: 'destructive' });
      return;
    }
    if (!formOutcome.trim()) {
      toast({ title: 'Validation', description: 'Outcome/Hasil wajib diisi.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    // Upload evidence file if present
    let evidenceUrl: string | null = editingActivity?.evidence_url ?? null;
    if (formEvidenceFile) {
      if (!ALLOWED_EVIDENCE_TYPES.includes(formEvidenceFile.type)) {
        toast({ title: 'Invalid file', description: 'Format file tidak didukung. Gunakan PDF, Word, Excel, PNG, JPEG, atau TXT.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      if (formEvidenceFile.size > MAX_EVIDENCE_SIZE) {
        toast({ title: 'File too large', description: 'Ukuran file maksimal 5MB.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      setUploadingEvidence(true);
      const ext = formEvidenceFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('activity-evidence').upload(filePath, formEvidenceFile);
      setUploadingEvidence(false);
      if (uploadError) {
        toast({ title: 'Upload error', description: uploadError.message, variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      // Store just the file path, not the full URL (bucket is now private)
      evidenceUrl = filePath;
    }

    const payload = {
      type: formType,
      activity_date: formDate,
      account_id: formAccountId || null,
      notes: formNotes || null,
      next_action_date: formNextActionDate || null,
      cost: formCost ? parseFloat(formCost) : null,
      purpose: formPurpose || null,
      outcome: formOutcome || null,
      evidence_url: evidenceUrl,
    };

    let error;
    if (editingActivity) {
      ({ error } = await supabase.from('sales_activities').update(payload).eq('id', editingActivity.id));
    } else {
      ({ error } = await supabase.from('sales_activities').insert({ ...payload, sales_id: user.id }));
    }

    setSubmitting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: editingActivity ? 'Activity updated' : 'Activity added',
      description: editingActivity ? 'Your activity has been updated.' : 'Your activity has been recorded.',
    });
    resetForm();
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('sales_activities').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Activity has been removed.' });
      fetchData();
    }
    setDeleteTarget(null);
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterAccount('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterSearch('');
    setCurrentPage(1);
  };

  const hasActiveFilters = filterType !== 'all' || filterAccount !== 'all' || filterDateFrom || filterDateTo || filterSearch;

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return '-';
    return accounts.find(a => a.id === accountId)?.name || accountId;
  };

  // Filtered & sorted activities
  const filteredActivities = useMemo(() => {
    setCurrentPage(1);
    const filtered = activities.filter(a => {
      if (filterType !== 'all' && a.type !== filterType) return false;
      if (filterAccount !== 'all' && a.account_id !== filterAccount) return false;
      if (filterDateFrom && a.activity_date < filterDateFrom) return false;
      if (filterDateTo && a.activity_date > filterDateTo) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const matchNotes = a.notes?.toLowerCase().includes(q);
        const matchAccount = getAccountName(a.account_id).toLowerCase().includes(q);
        const matchType = a.type.toLowerCase().includes(q);
        if (!matchNotes && !matchAccount && !matchType) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'activity_date') {
        cmp = a.activity_date.localeCompare(b.activity_date);
      } else if (sortKey === 'type') {
        cmp = (activityLabels[a.type] || a.type).localeCompare(activityLabels[b.type] || b.type);
      } else if (sortKey === 'account') {
        cmp = getAccountName(a.account_id).localeCompare(getAccountName(b.account_id));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [activities, filterType, filterAccount, filterDateFrom, filterDateTo, filterSearch, accounts, sortKey, sortDir]);

  const typeCounts = activities.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const thisWeek = activities.filter(a => {
    const d = new Date(a.activity_date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });

  const minWeeklyTarget = 5;

  const getExportData = () =>
    filteredActivities.map(a => ({
      Date: format(new Date(a.activity_date), 'dd MMM yyyy'),
      Type: activityLabels[a.type] || a.type,
      'Account/Customer': getAccountName(a.account_id),
      Purpose: a.purpose || '-',
      Outcome: a.outcome || '-',
      Notes: a.notes || '-',
      'Cost (Rp.)': a.cost != null ? a.cost : '-',
      Evidence: a.evidence_url || '-',
      'Next Action': a.next_action_date ? format(new Date(a.next_action_date), 'dd MMM yyyy') : '-',
    }));

  const exportHeaders = ['Date', 'Type', 'Account/Customer', 'Purpose', 'Outcome', 'Notes', 'Cost (Rp.)', 'Evidence', 'Next Action'];

  const getDateRangeLabel = () => {
    if (filterDateFrom && filterDateTo) return `${format(new Date(filterDateFrom), 'dd MMM yyyy')} – ${format(new Date(filterDateTo), 'dd MMM yyyy')}`;
    if (filterDateFrom) return `From ${format(new Date(filterDateFrom), 'dd MMM yyyy')}`;
    if (filterDateTo) return `Until ${format(new Date(filterDateTo), 'dd MMM yyyy')}`;
    return 'All Period';
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const salesName = profile?.full_name || 'N/A';
    const salesSegment = profile?.segment || 'N/A';
    doc.setFontSize(14);
    doc.text('My Activities Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Sales Person: ${salesName}`, 14, 23);
    doc.text(`Segment: ${salesSegment}`, 14, 29);
    doc.text(`Period: ${getDateRangeLabel()}`, 14, 35);
    doc.setFontSize(9);
    doc.text(`Exported: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 42);
    const data = getExportData();
    autoTable(doc, {
      head: [exportHeaders],
      body: data.map(r => exportHeaders.map(h => String(r[h as keyof typeof r]))),
      startY: 48,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 7: { cellWidth: 30 } },
    });
    doc.save('my-activities.pdf');
  };

  const exportExcel = () => {
    const salesName = profile?.full_name || 'N/A';
    const salesSegment = profile?.segment || 'N/A';
    const headerRows = [
      { Date: 'My Activities Report' },
      { Date: `Sales Person: ${salesName}` },
      { Date: `Segment: ${salesSegment}` },
      { Date: `Period: ${getDateRangeLabel()}` },
      { Date: `Exported: ${format(new Date(), 'dd MMM yyyy HH:mm')}` },
      {},
    ];
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet([...headerRows, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activities');
    XLSX.writeFile(wb, 'my-activities.xlsx');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Activities</h2>
          <p className="text-sm text-muted-foreground">
            Activity log & tracking — {profile?.full_name || user?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Activity
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingActivity ? 'Edit Activity' : 'Add New Activity'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{activityLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
                <AccountSelectWithCreate
                  accounts={accounts}
                  value={formAccountId}
                  onValueChange={setFormAccountId}
                  salesId={user!.id}
                  onAccountCreated={(acc) => {
                    setAccounts(prev => [...prev, acc].sort((a, b) => a.name.localeCompare(b.name)));
                  }}
                  optional
                />
              <div className="space-y-2">
                <Label>Purpose/Tujuan <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Tujuan aktivitas ini..."
                  value={formPurpose}
                  onChange={e => setFormPurpose(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Brief description of the activity..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label>Outcome/Hasil <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Hasil dari aktivitas ini..."
                  value={formOutcome}
                  onChange={e => setFormOutcome(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label>Activity Cost/Budget (Rp.) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={formCost}
                  onChange={e => setFormCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Evidence of Activity <span className="text-muted-foreground text-xs">(optional, max 5MB)</span></Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpeg,.jpg,.txt"
                  onChange={e => setFormEvidenceFile(e.target.files?.[0] || null)}
                />
                {editingActivity?.evidence_url && !formEvidenceFile && (
                  <p className="text-xs text-muted-foreground">
                    File tersimpan:{' '}
                    <a href={editingActivity.evidence_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                      Lihat file
                    </a>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Format: PDF, Word, Excel, PNG, JPEG, JPG, TXT</p>
              </div>
              <div className="space-y-2">
                <Label>Next Action Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="date" value={formNextActionDate} onChange={e => setFormNextActionDate(e.target.value)} />
              </div>
              <Button onClick={handleSubmit} disabled={submitting || uploadingEvidence || !formDate} className="w-full">
                {(submitting || uploadingEvidence) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {uploadingEvidence ? 'Uploading...' : editingActivity ? 'Update Activity' : 'Save Activity'}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overdue Reminders */}
      <OverdueReminders activities={activities} accounts={accounts} />

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Activities" value={String(activities.length)} icon={Activity} autoFitText />
        <KPICard
          label="This Week"
          value={String(thisWeek.length)}
          status={thisWeek.length >= minWeeklyTarget ? 'green' : 'red'}
          changeLabel={thisWeek.length >= minWeeklyTarget ? 'On track' : `Min ${minWeeklyTarget}/week`}
          icon={Clock}
          autoFitText
        />
        <KPICard label="Online Meetings" value={String(typeCounts['online_meeting'] || 0)} icon={Users} autoFitText />
        <KPICard label="Visits" value={String(typeCounts['visit'] || 0)} icon={MapPin} autoFitText />
      </div>

      {/* Activity Type Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Activity by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {ACTIVITY_TYPES.map(type => {
              const Icon = activityIcons[type];
              const count = typeCounts[type] || 0;
              return (
                <div key={type} className="flex flex-col items-center p-3 rounded-lg bg-secondary/50">
                  <Icon className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-bold text-foreground">{count}</span>
                  <span className="text-xs text-muted-foreground">{activityLabels[type]}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Activity Log - Row 3 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Full Activity Log</CardTitle>
            <div className="flex items-center gap-2">
              <Select onValueChange={(val) => { if (val === 'pdf') exportPDF(); if (val === 'excel') exportExcel(); }}>
                <SelectTrigger className="h-7 w-auto gap-1.5 text-xs px-2.5">
                  <Download className="h-3.5 w-3.5" />
                  <SelectValue placeholder="Download Report" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">Export PDF</SelectItem>
                  <SelectItem value="excel">Export Excel</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                    <Settings2 className="h-3.5 w-3.5" /> Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Toggle columns</p>
                  <div className="space-y-2">
                    {allColumns.map(col => (
                      <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={visibleColumns.has(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-7">
                  <X className="h-3 w-3" /> Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{activityLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
            <Input
              type="date"
              placeholder="To"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Table */}
          {filteredActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {activities.length === 0
                ? 'No activities recorded yet. Click "Add Activity" to get started.'
                : 'No activities match your filters.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.has('date') && (
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('activity_date')}>
                      <span className="inline-flex items-center gap-1">
                        Date {sortKey === 'activity_date' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                      </span>
                    </TableHead>
                  )}
                  {visibleColumns.has('type') && (
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('type')}>
                      <span className="inline-flex items-center gap-1">
                        Type {sortKey === 'type' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                      </span>
                    </TableHead>
                  )}
                  {visibleColumns.has('account') && (
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('account')}>
                      <span className="inline-flex items-center gap-1">
                        Account/Customer {sortKey === 'account' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                      </span>
                    </TableHead>
                  )}
                  {visibleColumns.has('purpose') && <TableHead className="text-xs">Purpose</TableHead>}
                  {visibleColumns.has('outcome') && <TableHead className="text-xs">Outcome</TableHead>}
                  {visibleColumns.has('notes') && <TableHead className="text-xs">Notes</TableHead>}
                  {visibleColumns.has('cost') && <TableHead className="text-xs">Cost (Rp.)</TableHead>}
                  {visibleColumns.has('evidence') && <TableHead className="text-xs">Evidence</TableHead>}
                  {visibleColumns.has('next_action') && <TableHead className="text-xs">Next Action</TableHead>}
                  <TableHead className="text-xs w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map(act => {
                  const Icon = activityIcons[act.type] || Activity;
                  return (
                    <TableRow key={act.id}>
                      {visibleColumns.has('date') && (
                        <TableCell className="text-sm">
                          {format(new Date(act.activity_date), 'dd MMM yyyy')}
                        </TableCell>
                      )}
                      {visibleColumns.has('type') && (
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <StatusBadge status={activityColors[act.type] || 'green'} label={activityLabels[act.type] || act.type} />
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.has('account') && (
                        <TableCell className="text-sm font-medium">{getAccountName(act.account_id)}</TableCell>
                      )}
                      {visibleColumns.has('purpose') && (
                        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{act.purpose || '-'}</TableCell>
                      )}
                      {visibleColumns.has('outcome') && (
                        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{act.outcome || '-'}</TableCell>
                      )}
                      {visibleColumns.has('notes') && (
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{act.notes || '-'}</TableCell>
                      )}
                      {visibleColumns.has('cost') && (
                        <TableCell className="text-sm text-muted-foreground">
                          {act.cost != null ? `Rp ${act.cost.toLocaleString('id-ID')}` : '-'}
                        </TableCell>
                      )}
                      {visibleColumns.has('evidence') && (
                        <TableCell className="text-sm">
                          {act.evidence_url ? (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-primary gap-1" onClick={() => setPreviewUrl(act.evidence_url)}>
                                <Eye className="h-3 w-3" /> Preview
                              </Button>
                              <a href={act.evidence_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ) : '-'}
                        </TableCell>
                      )}
                      {visibleColumns.has('next_action') && (
                        <TableCell className="text-sm text-muted-foreground">
                          {act.next_action_date ? format(new Date(act.next_action_date), 'dd MMM yyyy') : '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(act)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(act)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <ActivityPagination
            currentPage={currentPage}
            totalItems={filteredActivities.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* Weekly Trend Chart */}
      <WeeklyTrendChart activities={activities} />

      {/* Monthly Statistics */}
      <MonthlyStats activities={activities} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteTarget ? (activityLabels[deleteTarget.type] || deleteTarget.type) : ''} activity
              {deleteTarget?.activity_date ? ` from ${format(new Date(deleteTarget.activity_date), 'dd MMM yyyy')}` : ''}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Evidence Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Evidence Preview</span>
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
                  </Button>
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            {previewUrl && (() => {
              const lower = previewUrl.toLowerCase();
              const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(lower);
              const isPdf = /\.pdf(\?|$)/i.test(lower);
              if (isImage) {
                return <img src={previewUrl} alt="Evidence" className="max-w-full h-auto rounded-md mx-auto" />;
              }
              if (isPdf) {
                return <iframe src={previewUrl} className="w-full h-[70vh] rounded-md border" title="PDF Preview" />;
              }
              return (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Preview tidak tersedia untuk format file ini.</p>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Download className="h-4 w-4" /> Download File
                    </Button>
                  </a>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyActivities;