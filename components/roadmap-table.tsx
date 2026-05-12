"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  ChevronDown,
  Pencil,
  X,
  ExternalLink,
  Search,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditInitiativeDialog } from "@/components/edit-initiative-dialog";
import type { InitiativeRow, JiraLinkRow, OwnerRow } from "@/lib/db/initiatives";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortField = "title" | "status" | "loe" | "score" | "updated";
type SortDir = "asc" | "desc";

// ── Lookup tables ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string; order: number }> = {
  in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", order: 0 },
  planned:     { label: "Planned",     cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",   order: 1 },
  discovery:   { label: "Discovery",   cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", order: 2 },
  paused:      { label: "Paused",      cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", order: 3 },
  complete:    { label: "Complete",    cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",  order: 4 },
};

const LOE_CFG: Record<string, { cls: string; order: number }> = {
  XL: { cls: "bg-red-100    text-red-700    dark:bg-red-950    dark:text-red-300",    order: 0 },
  L:  { cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", order: 1 },
  M:  { cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300", order: 2 },
  S:  { cls: "bg-green-100  text-green-700  dark:bg-green-950  dark:text-green-300",  order: 3 },
  XS: { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", order: 4 },
};

// ── Display sub-components ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function LoeBadge({ loe, rawLabel }: { loe: string | null; rawLabel: string | null }) {
  const display = loe ?? rawLabel;
  if (!display) return <span className="text-muted-foreground text-xs">—</span>;
  const styles = loe ? (LOE_CFG[loe] ?? null) : null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${styles?.cls ?? "bg-muted text-muted-foreground"}`}>
      {display}
    </span>
  );
}

function JiraBadge({ link }: { link: JiraLinkRow }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={link.jira_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-mono font-medium
              bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100
              dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900
              transition-colors"
          />
        }
      >
        {link.jira_key}
        <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="top">
        {link.issue_title ? (
          <div className="space-y-0.5">
            <p className="font-medium">{link.issue_title}</p>
            {link.issue_status && <p className="text-background/70">{link.issue_status}</p>}
          </div>
        ) : (
          <p className="text-background/70">No details cached yet</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ScoreCell({ row }: { row: InitiativeRow }) {
  const avg = row.avg_score ? parseFloat(row.avg_score) : null;
  if (avg === null && row.loe_score === null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="text-sm font-medium tabular-nums cursor-default" />}>
        {avg !== null ? avg.toFixed(2) : "—"}
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="space-y-1 text-xs min-w-[100px]">
          {[["LOE", row.loe_score], ["Value", row.value_score], ["Alignment", row.alignment_score]].map(([label, val]) => (
            <div key={String(label)} className="flex justify-between gap-3">
              <span className="text-background/70">{label}</span>
              <span className="font-medium">{val ?? "—"}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function OwnerCell({ owners }: { owners: OwnerRow[] }) {
  if (!owners.length) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {owners.map((o) => (
        <Tooltip key={o.id}>
          <TooltipTrigger render={<Avatar size="sm" className="cursor-default" />}>
            <AvatarFallback>{o.user_email.slice(0, 2).toUpperCase()}</AvatarFallback>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span>{o.user_email}{o.is_primary ? " (primary)" : ""}</span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function RelativeDate({ iso }: { iso: string }) {
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  const label =
    diffDays === 0 ? "Today" :
    diffDays === 1 ? "Yesterday" :
    diffDays < 7   ? `${diffDays}d ago` :
    diffDays < 30  ? `${Math.floor(diffDays / 7)}w ago` :
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="text-xs text-muted-foreground cursor-default" />}>
        {label}
      </TooltipTrigger>
      <TooltipContent side="top">
        <span>{date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Sortable column header ────────────────────────────────────────────────────

function SortableHead({
  field,
  label,
  sortBy,
  sortDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortBy: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sortBy === field;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors text-foreground/80"
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const ALL_STATUSES = ["discovery", "planned", "in_progress", "complete", "paused"];
const ALL_LOES = ["XS", "S", "M", "L", "XL"];

function FilterBar({
  search, onSearch,
  statusFilter, onStatusFilter,
  loeFilter, onLoeFilter,
  resultCount, totalCount,
}: {
  search: string; onSearch: (v: string) => void;
  statusFilter: string; onStatusFilter: (v: string) => void;
  loeFilter: string; onLoeFilter: (v: string) => void;
  resultCount: number; totalCount: number;
}) {
  const hasFilters = search || statusFilter !== "__all__" || loeFilter !== "__all__";

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 min-w-48">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Search</span>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search initiatives…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
        <Select value={statusFilter} onValueChange={(v) => { if (v) onStatusFilter(v); }}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_CFG[s]?.label ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* LOE filter */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">LOE</span>
        <Select value={loeFilter} onValueChange={(v) => { if (v) onLoeFilter(v); }}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All LOE</SelectItem>
            {ALL_LOES.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear + count */}
      <div className="flex items-center gap-2 ml-auto">
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onSearch(""); onStatusFilter("__all__"); onLoeFilter("__all__"); }}
            className="h-8 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" /> Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {resultCount === totalCount ? `${totalCount} initiatives` : `${resultCount} of ${totalCount}`}
        </span>
      </div>
    </div>
  );
}

// ── Slack remind button ───────────────────────────────────────────────────────

type RemindState = "idle" | "loading" | "sent" | "error";

function SlackRemindButton({
  initiative,
  state,
  errorMsg,
  onRemind,
}: {
  initiative: InitiativeRow;
  state: RemindState;
  errorMsg?: string;
  onRemind: () => void;
}) {
  const hasOwners = initiative.owners.length > 0;

  const icon =
    state === "loading" ? <BellRing className="w-3.5 h-3.5 animate-pulse" /> :
    state === "sent"    ? <Check className="w-3.5 h-3.5 text-green-600" /> :
    state === "error"   ? <X className="w-3.5 h-3.5 text-destructive" /> :
                          <Bell className="w-3.5 h-3.5" />;

  const tip =
    !hasOwners    ? "No owners — add owners in edit to enable" :
    state === "sent"  ? "Slack reminder sent!" :
    state === "error" ? (errorMsg ?? "Failed to send") :
                        `Send Slack reminder to ${initiative.owners.map(o => o.user_email).join(", ")}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={(e) => { e.stopPropagation(); if (hasOwners && state === "idle") onRemind(); }}
            disabled={!hasOwners || state === "loading"}
            className="flex items-center justify-center w-6 h-6 rounded opacity-50 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 transition-opacity"
            aria-label="Send Slack reminder"
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side="top"><span>{tip}</span></TooltipContent>
    </Tooltip>
  );
}

// ── Sorting logic ─────────────────────────────────────────────────────────────

function sortInitiatives(list: InitiativeRow[], field: SortField | null, dir: SortDir): InitiativeRow[] {
  if (!field) return list;
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "status":
        cmp = (STATUS_CFG[a.status]?.order ?? 99) - (STATUS_CFG[b.status]?.order ?? 99);
        break;
      case "loe":
        cmp = (LOE_CFG[a.estimated_loe ?? ""]?.order ?? 99) - (LOE_CFG[b.estimated_loe ?? ""]?.order ?? 99);
        break;
      case "score": {
        const sa = a.avg_score ? parseFloat(a.avg_score) : -1;
        const sb = b.avg_score ? parseFloat(b.avg_score) : -1;
        cmp = sb - sa; // higher score first by default
        break;
      }
      case "updated":
        cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Main table ────────────────────────────────────────────────────────────────

export function RoadmapTable({ initiatives }: { initiatives: InitiativeRow[] }) {
  // ── filter state
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [loeFilter, setLoeFilter]       = useState("__all__");

  // ── sort state
  const [sortBy, setSortBy]   = useState<SortField | null>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── expand state (which initiative rows are expanded to show epics)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingInitiative = editingId ? (initiatives.find((i) => i.id === editingId) ?? null) : null;

  // ── remind state: id → state
  const [remindStates, setRemindStates] = useState<Record<string, RemindState>>({});
  const [remindErrors, setRemindErrors] = useState<Record<string, string>>({});

  // ── derived filtered + sorted list
  const visible = useMemo(() => {
    let list = initiatives;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.high_level_focus ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "__all__") {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (loeFilter !== "__all__") {
      list = list.filter((i) => i.estimated_loe === loeFilter);
    }
    return sortInitiatives(list, sortBy, sortDir);
  }, [initiatives, search, statusFilter, loeFilter, sortBy, sortDir]);

  // ── sort toggle
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "score" || field === "updated" ? "desc" : "asc");
    }
  };

  // ── Slack remind
  const handleRemind = async (initiative: InitiativeRow) => {
    setRemindStates((s) => ({ ...s, [initiative.id]: "loading" }));
    try {
      const res = await fetch("/api/slack/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiativeId: initiative.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRemindStates((s) => ({ ...s, [initiative.id]: "sent" }));
        setTimeout(() => setRemindStates((s) => ({ ...s, [initiative.id]: "idle" })), 4000);
      } else {
        const msg = data.error ?? data.results?.find((r: { sent: boolean; error?: string }) => !r.sent)?.error ?? "Unknown error";
        setRemindErrors((e) => ({ ...e, [initiative.id]: msg }));
        setRemindStates((s) => ({ ...s, [initiative.id]: "error" }));
        setTimeout(() => setRemindStates((s) => ({ ...s, [initiative.id]: "idle" })), 5000);
      }
    } catch {
      setRemindStates((s) => ({ ...s, [initiative.id]: "error" }));
      setTimeout(() => setRemindStates((s) => ({ ...s, [initiative.id]: "idle" })), 5000);
    }
  };

  return (
    <TooltipProvider>
      <FilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatusFilter={setStatusFilter}
        loeFilter={loeFilter} onLoeFilter={setLoeFilter}
        resultCount={visible.length} totalCount={initiatives.length}
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SortableHead field="title"   label="Initiative" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="pl-4" />
              <SortableHead field="status"  label="Status"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableHead field="loe"     label="LOE"        sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center" />
              <SortableHead field="score"   label="Score"      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center" />
              <TableHead>Owners</TableHead>
              <TableHead>Jira</TableHead>
              <SortableHead field="updated" label="Updated"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-right" />
              <TableHead className="w-16 pr-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-20 text-center text-muted-foreground">
                  {initiatives.length === 0
                    ? "No initiatives yet. Run a sync to import from Google Sheets."
                    : "No initiatives match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => {
                const isExpanded = expandedIds.has(row.id);
                const hasEpics = row.jira_links.length > 0;
                return (
                  <Fragment key={row.id}>
                    {/* ── Initiative row ── */}
                    <TableRow className={isExpanded ? "border-b-0" : undefined}>
                      <TableCell className="pl-3 whitespace-normal max-w-xs">
                        <div className="flex items-start gap-1">
                          {/* Expand toggle */}
                          {hasEpics ? (
                            <button
                              onClick={() => toggleExpand(row.id)}
                              aria-label={isExpanded ? "Collapse epics" : "Expand epics"}
                              className="mt-0.5 shrink-0 flex items-center justify-center w-4 h-4 rounded
                                text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              {isExpanded
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-sm leading-snug">{row.title}</p>
                            {row.high_level_focus && (
                              <p className="text-xs text-muted-foreground mt-0.5">{row.high_level_focus}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell><StatusBadge status={row.status} /></TableCell>

                      <TableCell className="text-center">
                        <LoeBadge loe={row.estimated_loe} rawLabel={row.loe_label} />
                      </TableCell>

                      <TableCell className="text-center">
                        <ScoreCell row={row} />
                      </TableCell>

                      <TableCell><OwnerCell owners={row.owners} /></TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {hasEpics
                            ? row.jira_links.map((link) => <JiraBadge key={link.id} link={link} />)
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <RelativeDate iso={row.updated_at} />
                      </TableCell>

                      {/* Actions: edit + slack */}
                      <TableCell className="pr-3">
                        <div className="flex items-center justify-end gap-1">
                          <SlackRemindButton
                            initiative={row}
                            state={remindStates[row.id] ?? "idle"}
                            errorMsg={remindErrors[row.id]}
                            onRemind={() => handleRemind(row)}
                          />
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  onClick={() => setEditingId(row.id)}
                                  className="flex items-center justify-center w-6 h-6 rounded opacity-50 hover:opacity-100 transition-opacity"
                                  aria-label="Edit initiative"
                                />
                              }
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </TooltipTrigger>
                            <TooltipContent side="top"><span>Edit</span></TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* ── Epic sub-rows ── */}
                    {isExpanded && row.jira_links.map((link, idx) => (
                      <TableRow
                        key={`epic-${link.id}`}
                        className={`bg-muted/30 hover:bg-muted/50 ${idx === row.jira_links.length - 1 ? "" : "border-b-0"}`}
                      >
                        <TableCell colSpan={8} className="py-2 pl-9 pr-4">
                          <div className="flex items-center gap-2.5">
                            {/* Tree connector */}
                            <span className="text-muted-foreground/40 text-sm select-none font-mono leading-none">
                              {idx === row.jira_links.length - 1 ? "└" : "├"}
                            </span>

                            {/* Jira key badge */}
                            <a
                              href={link.jira_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5
                                text-xs font-mono font-medium
                                bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100
                                dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900
                                transition-colors"
                            >
                              {link.jira_key}
                              <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" />
                            </a>

                            {/* Epic title */}
                            <span className="text-sm text-foreground/80 truncate">
                              {link.issue_title ?? <span className="text-muted-foreground italic">No title cached</span>}
                            </span>

                            {/* Issue status pill */}
                            {link.issue_status && (
                              <span className="ml-auto shrink-0 inline-flex items-center rounded-full px-2 py-0.5
                                text-xs font-medium bg-muted text-muted-foreground border border-border">
                                {link.issue_status}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {editingInitiative && (
        <EditInitiativeDialog
          initiative={editingInitiative}
          open={true}
          onClose={() => setEditingId(null)}
        />
      )}
    </TooltipProvider>
  );
}
