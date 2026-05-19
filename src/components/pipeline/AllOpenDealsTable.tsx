import { useState, useMemo } from 'react';
import { Deal, DealStage, formatNumIDR, formatDate } from '@/types/sales';
import { DealDetailDialog } from '@/components/pipeline/DealDetailDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Filter, X, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { AccountPIC } from '@/components/pipeline/DealDetailDialog';

interface AllOpenDealsTableProps {
  deals: Deal[];
  getSalesName: (salesId: string) => string;
  getAccountName: (accountId: string) => string;
  getAccountPIC?: (accountId: string) => AccountPIC | undefined;
  salesPersons?: { id: string; name: string }[];
}

const perPageOptions = [5, 10, 25, 50, 100];

const stageOptions = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'po_secured', label: 'PO Secured' },
  { value: 'invoice_issued', label: 'Invoice Issued' },
];

const segmentOptions = [
  { value: 'B2G', label: 'B2G' },
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C' },
];

const sortColumns = [
  { key: 'sales', label: 'Sales' },
  { key: 'value', label: 'Value (Rp)' },
  { key: 'stage', label: 'Stage' },
  { key: 'segment', label: 'Segment' },
  { key: 'probability', label: 'Prob.' },
  { key: 'close', label: 'Close' },
];

const stageOrd = ['prospect', 'quotation', 'negotiation', 'po_secured', 'invoice_issued'];

interface MultiSelectCheckboxProps {
  icon?: React.ReactNode;
  placeholder: string;
  widthClass?: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}

function MultiSelectCheckbox({ icon, placeholder, widthClass = 'w-[150px]', options, selected, onToggle, onClear }: MultiSelectCheckboxProps) {
  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? placeholder)
      : `${selected.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('h-8 text-xs justify-between font-normal', widthClass)}>
          <span className="inline-flex items-center truncate">
            {icon}
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-1" align="start">
        <div className="max-h-64 overflow-y-auto">
          {options.map(o => {
            const checked = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onToggle(o.value)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent text-left"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t mt-1 pt-1">
            <button
              type="button"
              onClick={onClear}
              className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent rounded inline-flex items-center"
            >
              <X className="h-3 w-3 mr-1" /> Clear selection
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AllOpenDealsTable({ deals, getSalesName, getAccountName, getAccountPIC, salesPersons = [] }: AllOpenDealsTableProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [segmentFilter, setSegmentFilter] = useState<string[]>([]);
  const [salesFilter, setSalesFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);

  const hasFilters = search || stageFilter.length > 0 || segmentFilter.length > 0 || salesFilter.length > 0 || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setStageFilter([]);
    setSegmentFilter([]);
    setSalesFilter([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(1);
  };

  // Reset page when filters change
  const setSearchAndReset = (v: string) => { setSearch(v); setPage(1); };
  const toggleInList = (list: string[], v: string) =>
    list.includes(v) ? list.filter(x => x !== v) : [...list, v];
  const toggleStage = (v: string) => { setStageFilter(prev => toggleInList(prev, v)); setPage(1); };
  const toggleSegment = (v: string) => { setSegmentFilter(prev => toggleInList(prev, v)); setPage(1); };
  const toggleSales = (v: string) => { setSalesFilter(prev => toggleInList(prev, v)); setPage(1); };
  const setDateFromAndReset = (v: Date | undefined) => { setDateFrom(v); setPage(1); };
  const setDateToAndReset = (v: Date | undefined) => { setDateTo(v); setPage(1); };
  const setPerPageAndReset = (v: string) => { setPerPage(Number(v)); setPage(1); };

  const filteredAndSorted = useMemo(() => {
    let result = deals.filter(d => !['canceled', 'lost'].includes(d.stage));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        getAccountName(d.accountId).toLowerCase().includes(q) ||
        getSalesName(d.salesId).toLowerCase().includes(q) ||
        (d.referenceNumber || '').toLowerCase().includes(q) ||
        (d.wmsSoNumber || '').toLowerCase().includes(q)
      );
    }
    if (stageFilter.length > 0) result = result.filter(d => stageFilter.includes(d.stage));
    if (segmentFilter.length > 0) result = result.filter(d => segmentFilter.includes(d.segment));
    if (salesFilter.length > 0) result = result.filter(d => salesFilter.includes(d.salesId));
    if (dateFrom) result = result.filter(d => new Date(d.expectedCloseDate) >= dateFrom);
    if (dateTo) result = result.filter(d => new Date(d.expectedCloseDate) <= dateTo);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'value': cmp = a.value - b.value; break;
          case 'probability': cmp = a.probability - b.probability; break;
          case 'stage': cmp = stageOrd.indexOf(a.stage) - stageOrd.indexOf(b.stage); break;
          case 'segment': cmp = a.segment.localeCompare(b.segment); break;
          case 'sales': cmp = getSalesName(a.salesId).localeCompare(getSalesName(b.salesId)); break;
          case 'close': cmp = a.expectedCloseDate.localeCompare(b.expectedCloseDate); break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [deals, search, stageFilter, segmentFilter, salesFilter, dateFrom, dateTo, sortKey, sortDir, getSalesName, getAccountName]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / perPage));
  const paginatedDeals = filteredAndSorted.slice((page - 1) * perPage, page * perPage);

  const totalValue = useMemo(() => filteredAndSorted.reduce((s, d) => s + (d.value || 0), 0), [filteredAndSorted]);
  const avgProbability = useMemo(() => filteredAndSorted.length === 0 ? 0 : filteredAndSorted.reduce((s, d) => s + (d.probability || 0), 0) / filteredAndSorted.length, [filteredAndSorted]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const buildExportRows = () => filteredAndSorted.map(d => ({
    Deal: d.name,
    Account: getAccountName(d.accountId),
    Sales: getSalesName(d.salesId),
    'Value (Rp)': d.value,
    Stage: d.stage.replace('_', ' '),
    Segment: d.segment,
    'Probability (%)': d.probability,
    'Expected Close': d.expectedCloseDate,
  }));

  const exportExcel = () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const summaryRow = {
      Deal: `TOTAL / RATA-RATA (${rows.length} deals)`,
      Account: '',
      Sales: '',
      'Value (Rp)': totalValue,
      Stage: '',
      Segment: '',
      'Probability (%)': Number(avgProbability.toFixed(1)),
      'Expected Close': '',
    };
    XLSX.utils.sheet_add_json(ws, [summaryRow], { skipHeader: true, origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Open Deals');
    XLSX.writeFile(wb, `open-deals-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`);
  };

  const exportPDF = () => {
    const rows = buildExportRows();
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text('All Open Deals', 14, 14);
    doc.setFontSize(9);
    doc.text(`Exported: ${format(new Date(), 'dd MMM yyyy HH:mm')} — ${rows.length} deals`, 14, 20);
    autoTable(doc, {
      head: [Object.keys(rows[0] || { Deal: '', Account: '', Sales: '', 'Value (Rp)': '', Stage: '', Segment: '', 'Probability (%)': '', 'Expected Close': '' })],
      body: rows.map(r => Object.values(r).map(v => typeof v === 'number' ? v.toLocaleString('id-ID') : String(v ?? ''))),
      foot: [[
        `TOTAL / RATA-RATA (${rows.length} deals)`,
        '', '',
        totalValue.toLocaleString('id-ID'),
        '', '',
        `${avgProbability.toFixed(1)}%`,
        '',
      ]],
      startY: 25,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold' },
    });
    doc.save(`open-deals-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
  };

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">All Open Deals</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{filteredAndSorted.length} deals</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled={filteredAndSorted.length === 0}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportExcel} className="text-xs">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Export to Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPDF} className="text-xs">
                    <FileText className="h-3.5 w-3.5 mr-2" /> Export to PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari deal, akun, sales, atau No. REF..."
                value={search}
                onChange={e => setSearchAndReset(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <MultiSelectCheckbox
              icon={<Filter className="h-3 w-3 mr-1 text-muted-foreground" />}
              placeholder="All Stages"
              widthClass="w-[150px]"
              options={stageOptions}
              selected={stageFilter}
              onToggle={toggleStage}
              onClear={() => { setStageFilter([]); setPage(1); }}
            />
            <MultiSelectCheckbox
              placeholder="All Segments"
              widthClass="w-[140px]"
              options={segmentOptions}
              selected={segmentFilter}
              onToggle={toggleSegment}
              onClear={() => { setSegmentFilter([]); setPage(1); }}
            />
            {salesPersons.length > 0 && (
              <MultiSelectCheckbox
                placeholder="All Sales"
                widthClass="w-[170px]"
                options={salesPersons.map(s => ({ value: s.id, label: s.name }))}
                selected={salesFilter}
                onToggle={toggleSales}
                onClear={() => { setSalesFilter([]); setPage(1); }}
              />
            )}

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 w-[140px] text-xs justify-start font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFromAndReset} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 w-[140px] text-xs justify-start font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateToAndReset} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-tl-md py-3">Deal</TableHead>
              {sortColumns.map((col, idx) => {
                const colors = [
                  'bg-gradient-to-br from-sky-600 to-sky-500',
                  'bg-gradient-to-br from-emerald-600 to-emerald-500',
                  'bg-gradient-to-br from-amber-500 to-amber-400',
                  'bg-gradient-to-br from-orange-500 to-orange-400',
                  'bg-gradient-to-br from-teal-600 to-teal-500',
                  'bg-gradient-to-br from-rose-500 to-rose-400',
                ];
                const isLast = idx === sortColumns.length - 1;
                return (
                  <TableHead
                    key={col.key}
                    className={`text-xs text-white font-semibold cursor-pointer select-none hover:brightness-110 transition-all py-3 ${colors[idx] || ''} ${isLast ? 'rounded-tr-md' : ''}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No deals found
                </TableCell>
              </TableRow>
            ) : (
              paginatedDeals.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailDeal(d)}>
                  <TableCell>
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{getAccountName(d.accountId)}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getSalesName(d.salesId)}</TableCell>
                  <TableCell className="text-sm">{formatNumIDR(d.value)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={d.daysInStage > 14 ? 'red' : d.daysInStage > 7 ? 'yellow' : 'green'}
                      label={d.stage.replace('_', ' ')}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d.segment}</span>
                  </TableCell>
                  <TableCell className="text-sm">{d.probability}%</TableCell>
                  <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {filteredAndSorted.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={2} className="text-xs">Total / Rata-rata ({filteredAndSorted.length} deals)</TableCell>
                <TableCell className="text-sm">{formatNumIDR(totalValue)}</TableCell>
                <TableCell colSpan={2}></TableCell>
                <TableCell className="text-sm">{avgProbability.toFixed(1)}%</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>

        {/* Pagination */}
        {filteredAndSorted.length > perPage && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Show</span>
              <Select value={String(perPage)} onValueChange={setPerPageAndReset}>
                <SelectTrigger className="h-7 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {perPageOptions.map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                — Showing {Math.min((page - 1) * perPage + 1, filteredAndSorted.length)}–{Math.min(page * perPage, filteredAndSorted.length)} of {filteredAndSorted.length}
              </span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <span key={p} className="inline-flex items-center">
                        {showEllipsis && <span className="text-xs text-muted-foreground px-1">…</span>}
                        <Button
                          variant={p === page ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 w-7 p-0 text-xs"
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      </span>
                    );
                  })}
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <DealDetailDialog
      deal={detailDeal}
      open={!!detailDeal}
      onOpenChange={(open) => !open && setDetailDeal(null)}
      getAccountName={getAccountName}
      getSalesName={getSalesName}
      getAccountPIC={getAccountPIC}
    />
    </>
  );
}
