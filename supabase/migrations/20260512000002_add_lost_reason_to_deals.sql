-- Tambah kolom lost_reason dan lost_notes ke tabel deals
-- untuk keperluan Lost Deal Analysis dashboard

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_notes text;

-- Validasi: lost_reason hanya boleh diisi jika stage = 'lost'
-- (enforced di application layer, tidak perlu constraint DB)

COMMENT ON COLUMN public.deals.lost_reason IS 'Kategori alasan deal kalah/lost: price, competitor, needs_mismatch, budget, timing, no_response, internal_decision, other';
COMMENT ON COLUMN public.deals.lost_notes IS 'Catatan tambahan mengapa deal lost (opsional)';
