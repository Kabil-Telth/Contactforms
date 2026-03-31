"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { SubmissionCard } from "@/components/submission-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import {
  RefreshCw, Inbox, LayoutGrid, List, Table2,
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, X, Eye, Download
} from "lucide-react"
import { SubmissionResponse, SubmissionStatus } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"

const SITES = [
  { value: "all", label: "All Sites" },
  { value: "nahm-som.org", label: "nahm-som.org" },
  { value: "medpassedu.org", label: "medpassedu.org" },
  { value: "telth.care", label: "telth.care" },
  { value: "telth.org", label: "telth.org" },
  { value: "natlife.org.in", label: "natlife.org.in" },
  { value: "localhost", label: "localhost" },
]

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "new", label: "New", color: "data-[state=active]:bg-blue-500 data-[state=active]:text-white" },
  { value: "seen", label: "Seen", color: "data-[state=active]:bg-yellow-500 data-[state=active]:text-white" },
  { value: "replied", label: "Replied", color: "data-[state=active]:bg-green-500 data-[state=active]:text-white" },
  { value: "archived", label: "Archived", color: "" },
]

const statusColors: Record<string, string> = {
  new: "bg-blue-500 text-white",
  seen: "bg-yellow-500 text-white",
  replied: "bg-green-500 text-white",
  archived: "bg-muted text-muted-foreground",
}

const siteColors: Record<string, string> = {
  "nahm-som.org": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "medpassedu.org": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "telth.care": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "telth.org": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "natlife.org.in": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "localhost:8080": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

type ViewMode = "grid" | "list" | "table"
type SortField = "createdAt" | "site" | "status"
type SortDir = "asc" | "desc"

const PAGE_SIZE = 20

// ── Export Helpers ─────────────────────────────────────────────────────────────

/**
 * Flatten a submission into a plain row object.
 * All `data.*` fields are spread to top-level columns.
 */
function flattenSubmission(sub: SubmissionResponse): Record<string, string> {
  const base: Record<string, string> = {
    id: sub._id,
    site: sub.site,
    status: sub.status,
    createdAt: new Date(sub.createdAt).toLocaleString(),
    updatedAt: new Date(sub.updatedAt).toLocaleString(),
  }
  for (const [k, v] of Object.entries(sub.data)) {
    base[`data_${k}`] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "")
  }
  return base
}

/** Build a union of all column keys across rows */
function getAllColumns(rows: Record<string, string>[]): string[] {
  const set = new Set<string>()
  for (const row of rows) Object.keys(row).forEach((k) => set.add(k))
  return Array.from(set)
}

/** Download as CSV */
function exportCSV(rows: SubmissionResponse[], filename: string) {
  const flat = rows.map(flattenSubmission)
  const cols = getAllColumns(flat)
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    cols.map(escape).join(","),
    ...flat.map((row) => cols.map((c) => escape(row[c] ?? "")).join(",")),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Download as XLSX using SheetJS (xlsx) loaded from CDN via dynamic import */
async function exportXLSX(rows: SubmissionResponse[], filename: string) {
  // Dynamically load SheetJS so it's only fetched when needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let XLSX: any
  try {
    XLSX = await import("xlsx")
  } catch {
    // Fallback: load from CDN via script tag
    await new Promise<void>((resolve, reject) => {
      if ((window as any).XLSX) { resolve(); return }
      const s = document.createElement("script")
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
      s.onload = () => resolve()
      s.onerror = () => reject(new Error("Failed to load SheetJS"))
      document.head.appendChild(s)
    })
    XLSX = (window as any).XLSX
  }

  const flat = rows.map(flattenSubmission)
  const cols = getAllColumns(flat)

  // Build worksheet data: header row + data rows
  const wsData = [
    cols, // header
    ...flat.map((row) => cols.map((c) => row[c] ?? "")),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Auto column widths
  ws["!cols"] = cols.map((c) => ({
    wch: Math.max(c.length, ...flat.map((r) => (r[c] ?? "").length), 10),
  }))

  XLSX.utils.book_append_sheet(wb, ws, "Submissions")
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function SubmissionModal({
  submission,
  onClose,
  onStatusChange,
  onDelete,
}: {
  submission: SubmissionResponse
  onClose: () => void
  onStatusChange: (id: string, status: SubmissionStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (status: SubmissionStatus) => {
    setLoading(true)
    await onStatusChange(submission._id, status)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (confirm("Delete this submission?")) {
      setLoading(true)
      await onDelete(submission._id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={siteColors[submission.site] || "bg-gray-100 text-gray-800"}>
              {submission.site}
            </Badge>
            <Badge className={statusColors[submission.status]}>
              {submission.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Form Data
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(submission.data).map(([key, value]) => (
                <tr key={key} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium text-muted-foreground capitalize w-1/3">
                    {key.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 break-words">
                    {typeof value === "object"
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              View raw JSON
            </summary>
            <pre className="mt-2 bg-muted/50 rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-words">
              {JSON.stringify(submission.data, null, 2)}
            </pre>
          </details>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-5 border-t sticky bottom-0 bg-background">
          <Select
            value={submission.status}
            onValueChange={(v) => handleStatusChange(v as SubmissionStatus)}
            disabled={loading}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="seen">Seen</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="ml-auto"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Sort Icon ─────────────────────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />
  return sortDir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1" />
    : <ChevronDown className="h-3 w-3 ml-1" />
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function SubmissionsDashboard({
  siteFilter,
  onStatusChange,
}: {
  siteFilter: string
  onStatusChange?: () => void
}) {
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)
  const [modalSub, setModalSub] = useState<SubmissionResponse | null>(null)

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (siteFilter !== "all") params.append("site", siteFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)
      const response = await fetch(`/api/submissions?${params.toString()}`)
      const data = await response.json()
      setSubmissions(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch submissions:", error)
      setSubmissions([])
    }
    setLoading(false)
  }, [siteFilter, statusFilter])

  useEffect(() => {
    fetchSubmissions()
    setPage(1)
  }, [fetchSubmissions])

  const handleStatusChange = async (id: string, status: SubmissionStatus) => {
    await fetch(`/api/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setSubmissions((prev) => prev.map((sub) => (sub._id === id ? { ...sub, status } : sub)))
    onStatusChange?.()
    setModalSub((prev) => prev?._id === id ? { ...prev, status } : prev)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/submissions/${id}`, { method: "DELETE" })
    setSubmissions((prev) => prev.filter((sub) => sub._id !== id))
  }

  const statusCounts = useMemo(() =>
    submissions.reduce(
      (acc, sub) => {
        acc[sub.status] = (acc[sub.status] || 0) + 1
        acc.total++
        return acc
      },
      { new: 0, seen: 0, replied: 0, archived: 0, total: 0 } as Record<string, number>
    ), [submissions])

  const sorted = useMemo(() => {
    return [...submissions].sort((a, b) => {
      let av: string, bv: string
      if (sortField === "createdAt") { av = a.createdAt; bv = b.createdAt }
      else if (sortField === "site") { av = a.site; bv = b.site }
      else { av = a.status; bv = b.status }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [submissions, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
    setPage(1)
  }

  // ── Export filename ────────────────────────────────────────────────────────
  const exportFilename = useMemo(() => {
    const sitePart = siteFilter === "all" ? "all-sites" : siteFilter.replace(/[^a-z0-9]/gi, "-")
    const statusPart = statusFilter === "all" ? "all" : statusFilter
    const datePart = new Date().toISOString().slice(0, 10)
    return `submissions_${sitePart}_${statusPart}_page${page}_${datePart}`
  }, [siteFilter, statusFilter, page])

  const handleExportCSV = async () => {
    setExporting(true)
    try { exportCSV(paginated, exportFilename) }
    finally { setExporting(false) }
  }

  const handleExportXLSX = async () => {
    setExporting(true)
    try { await exportXLSX(paginated, exportFilename) }
    finally { setExporting(false) }
  }

  return (
    <div className="space-y-4">
      {/* Modal */}
      {modalSub && (
        <SubmissionModal
          submission={modalSub}
          onClose={() => setModalSub(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}

      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Site filter */}
          <Select value={siteFilter} onValueChange={() => { setPage(1) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by site" />
            </SelectTrigger>
            <SelectContent>
              {SITES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort field */}
          <Select value={sortField} onValueChange={(v) => { setSortField(v as SortField); setPage(1) }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Date</SelectItem>
              <SelectItem value="site">Site</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort direction */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {sortDir === "asc"
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </Button>

          {/* Refresh */}
          <Button variant="outline" size="icon" onClick={fetchSubmissions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {/* ── Export button ───────────────────────────────────────────── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={exporting || paginated.length === 0}
                className="gap-1.5"
              >
                {exporting
                  ? <Spinner className="h-3.5 w-3.5" />
                  : <Download className="h-3.5 w-3.5" />}
                Export
                <span className="text-muted-foreground text-xs">
                  ({paginated.length})
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleExportXLSX} className="gap-2">
                <span className="font-medium">Excel (.xlsx)</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {paginated.length} rows
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                <span className="font-medium">CSV (.csv)</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {paginated.length} rows
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 border rounded-md p-1">
           <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
           <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("table")}
            title="Table view"
          >
            <Table2 className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />

          </Button>
         
         
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
        <TabsList className="grid w-full grid-cols-5">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={tab.color || ""}>
              {tab.label} ({tab.value === "all" ? statusCounts.total : (statusCounts[tab.value] || 0)})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No submissions</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            No submissions match the current filters.
          </p>
        </div>
      ) : viewMode === "table" ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-muted select-none" onClick={() => toggleSort("site")}>
                    <span className="flex items-center">Site <SortIcon field="site" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-muted select-none" onClick={() => toggleSort("status")}>
                    <span className="flex items-center">Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-muted select-none" onClick={() => toggleSort("createdAt")}>
                    <span className="flex items-center">Date <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((sub, i) => (
                  <tr
                    key={sub._id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"} ${sub.status === "archived" ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={siteColors[sub.site] || "bg-gray-100 text-gray-800"}>{sub.site}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[160px] truncate">
                      {(sub.data.name || sub.data.from_name || sub.data.first_name || sub.data.subject || "—") as string}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">
                      {(sub.data.email as string) || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[sub.status]}>{sub.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModalSub(sub)} title="View full details">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {paginated.map((sub) => (
            <div
              key={sub._id}
              className={`flex items-center gap-3 border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer ${sub.status === "archived" ? "opacity-60" : ""}`}
              onClick={() => setModalSub(sub)}
            >
              <Badge variant="outline" className={`shrink-0 ${siteColors[sub.site] || ""}`}>{sub.site}</Badge>
              <span className="font-medium truncate flex-1">
                {(sub.data.name || sub.data.from_name || sub.data.first_name || sub.data.subject || "Form Submission") as string}
              </span>
              <span className="text-sm text-muted-foreground truncate hidden sm:block">
                {(sub.data.email as string) || ""}
              </span>
              <Badge className={`shrink-0 ${statusColors[sub.status]}`}>{sub.status}</Badge>
              <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginated.map((submission) => (
            <div key={submission._id} className="relative group">
              <SubmissionCard
                submission={submission}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                onClick={() => setModalSub(submission)}
              >
                <Eye className="h-3 w-3 mr-1" /> View
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...")
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">…</span>
                ) : (
                  <Button key={p} variant={page === p ? "default" : "outline"} size="icon" className="h-8 w-8 text-xs" onClick={() => setPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}