import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Plus, Trash2, Pencil, Eye, EyeOff, Loader2 } from 'lucide-react';
import { formatDate } from '@/types/sales';

interface CoachingNote {
  id: string;
  supervisor_id: string;
  sales_id: string;
  session_date: string;
  category: string;
  note: string;
  is_shared: boolean;
  created_at: string;
}

const CATEGORY_OPTIONS = [
  { value: 'general',     label: 'General',      color: 'bg-blue-100 text-blue-700' },
  { value: 'skill',       label: 'Skill',        color: 'bg-purple-100 text-purple-700' },
  { value: 'performance', label: 'Performance',  color: 'bg-orange-100 text-orange-700' },
  { value: 'attitude',    label: 'Attitude',     color: 'bg-green-100 text-green-700' },
  { value: 'strategy',    label: 'Strategy',     color: 'bg-cyan-100 text-cyan-700' },
];

interface CoachingNotesProps {
  salesId: string;
  salesName: string;
  currentUserId: string;
  mode: 'supervisor' | 'salesperson';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoachingNotesDialog({ salesId, salesName, currentUserId, mode, open, onOpenChange }: CoachingNotesProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState('general');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNote, setFormNote] = useState('');
  const [formShared, setFormShared] = useState(true);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('coaching_notes')
      .select('*')
      .eq('sales_id', salesId)
      .order('session_date', { ascending: false });
    setNotes((data || []) as CoachingNote[]);
    setLoading(false);
  }, [salesId]);

  useEffect(() => {
    if (open) fetchNotes();
  }, [open, fetchNotes]);

  const resetForm = () => {
    setFormCategory('general');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNote('');
    setFormShared(true);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (note: CoachingNote) => {
    setFormCategory(note.category);
    setFormDate(note.session_date);
    setFormNote(note.note);
    setFormShared(note.is_shared);
    setEditingId(note.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formNote.trim()) {
      toast({ title: 'Catatan tidak boleh kosong', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      supervisor_id: currentUserId,
      sales_id: salesId,
      session_date: formDate,
      category: formCategory,
      note: formNote.trim(),
      is_shared: formShared,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('coaching_notes').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('coaching_notes').insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: 'Gagal menyimpan catatan', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingId ? 'Catatan diperbarui' : 'Catatan berhasil ditambahkan' });
    resetForm();
    fetchNotes();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('coaching_notes').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal menghapus catatan', variant: 'destructive' });
      return;
    }
    toast({ title: 'Catatan dihapus' });
    fetchNotes();
  };

  const categoryMeta = (cat: string) => CATEGORY_OPTIONS.find(c => c.value === cat) ?? CATEGORY_OPTIONS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Coaching Notes — {salesName}
          </DialogTitle>
          {mode === 'salesperson' && (
            <p className="text-xs text-muted-foreground mt-0.5">Catatan coaching dari supervisor kamu</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Add Note Form (supervisor only) */}
          {mode === 'supervisor' && (
            <div>
              {!showForm ? (
                <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="w-full border-dashed">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Catatan Coaching
                </Button>
              ) : (
                <Card className="border-primary/30">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Kategori</Label>
                        <Select value={formCategory} onValueChange={setFormCategory}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map(c => (
                              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tanggal Sesi</Label>
                        <input
                          type="date"
                          value={formDate}
                          onChange={e => setFormDate(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Catatan <span className="text-destructive">*</span></Label>
                      <Textarea
                        value={formNote}
                        onChange={e => setFormNote(e.target.value)}
                        placeholder="Tulis catatan coaching, feedback, atau action items..."
                        rows={4}
                        maxLength={1000}
                        className="text-sm resize-none"
                      />
                      <p className="text-xs text-muted-foreground text-right">{formNote.length}/1000</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormShared(!formShared)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {formShared ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {formShared ? 'Terlihat oleh salesperson' : 'Hanya terlihat supervisor'}
                      </button>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button size="sm" variant="outline" onClick={resetForm} disabled={saving}>Batal</Button>
                      <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        {editingId ? 'Simpan Perubahan' : 'Simpan Catatan'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Separator />

          {/* Notes List */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : notes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada catatan coaching</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => {
                const cat = categoryMeta(note.category);
                return (
                  <div key={note.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] px-2 py-0 ${cat.color} border-0`}>{cat.label}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(note.session_date)}</span>
                        {!note.is_shared && mode === 'supervisor' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                            <EyeOff className="h-2.5 w-2.5" /> Private
                          </Badge>
                        )}
                      </div>
                      {mode === 'supervisor' && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(note)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(note.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.note}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Inline card untuk MyPerformance (salesperson view) ──────────────── */
interface CoachingNotesSummaryProps {
  salesId: string;
  currentUserId: string;
}

export function CoachingNotesSummary({ salesId, currentUserId }: CoachingNotesSummaryProps) {
  const [notes, setNotes] = useState<CoachingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNote, setOpenNote] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('coaching_notes')
      .select('*')
      .eq('sales_id', salesId)
      .eq('is_shared', true)
      .order('session_date', { ascending: false })
      .limit(10)
      .then(({ data }) => { setNotes((data || []) as CoachingNote[]); setLoading(false); });
  }, [salesId]);

  const categoryMeta = (cat: string) => CATEGORY_OPTIONS.find(c => c.value === cat) ?? CATEGORY_OPTIONS[0];

  if (loading) return null;
  if (notes.length === 0) return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> Coaching dari Supervisor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-4">Belum ada catatan coaching dari supervisor</p>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> Coaching dari Supervisor
          <Badge variant="secondary" className="text-[10px]">{notes.length} catatan</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {notes.map(note => {
          const cat = categoryMeta(note.category);
          const isExpanded = openNote === note.id;
          return (
            <div
              key={note.id}
              className="rounded-md border bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setOpenNote(isExpanded ? null : note.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] px-2 py-0 ${cat.color} border-0`}>{cat.label}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(note.session_date)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
              </div>
              {isExpanded && (
                <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap text-foreground">{note.note}</p>
              )}
              {!isExpanded && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{note.note}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
