"use client"

import { useState, useEffect, useCallback } from "react"
import { signOut } from "next-auth/react"
import { Menu, X, LogOut, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"

const SITES = [
  { value: "all",             label: "All Sites" },
  { value: "nahm-som.org",    label: "nahm-som.org" },
  { value: "medpassedu.org",  label: "medpassedu.org" },
  { value: "telth.care",      label: "telth.care" },
  { value: "telth.org",       label: "telth.org" },
  { value: "natlife.org.in",  label: "natlife.org.in" },
  { value: "telth.ai",  label: "telth.ai" },
  { value: "harleyhealthsystem.com",  label: "eterna" },
  { value: "mytelth.com",  label: "Mytelth" },
  { value: "localhost",       label: "localhost (dev)" },
]

const siteColors: Record<string, string> = {
  "nahm-som.org":   "bg-purple-500",
  "medpassedu.org": "bg-blue-500",
  "telth.care":     "bg-teal-500",
  "telth.org":      "bg-orange-500",
  "natlife.org.in": "bg-green-500",
  "localhost":      "bg-gray-400",
}

/**
 * Canonical site key from any origin string.
 *
 * ALLOWED_ORIGINS examples → canonical key:
 *   "https://nahm-som.org"        → "nahm-som.org"
 *   "https://www.nahm-som.org"    → "nahm-som.org"
 *   "https://natlife.org.in"      → "natlife.org.in"
 *   "https://www.natlife.org.in"  → "natlife.org.in"
 *   "http://localhost:8080"       → "localhost"
 *   "http://localhost:5500"       → "localhost"
 *   "http://127.0.0.1:5500"       → "localhost"
 */
function normalizeSite(raw: string): string {
  let s = raw.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, "")  // strip protocol
  s = s.replace(/\/$/, "")           // strip trailing slash
  s = s.replace(/^www\./, "")        // strip www.
  s = s.replace(/:\d+$/, "")         // strip port (:8080, :5500 …)
  if (s === "127.0.0.1") s = "localhost"
  return s
}

interface SidebarLayoutProps {
  children: (siteFilter: string, refreshCounts: () => void) => React.ReactNode
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState("all")
  const [newCounts, setNewCounts] = useState<Record<string, number>>({})

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/submissions?status=new")
      const data = await res.json()
      if (!Array.isArray(data)) return

      const counts: Record<string, number> = { all: data.length }
      for (const sub of data) {
        const key = normalizeSite(sub.site)
        counts[key] = (counts[key] || 0) + 1
      }
      setNewCounts(counts)
    } catch (e) {
      console.error("Failed to fetch counts:", e)
    }
  }, [])

  useEffect(() => {
    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [fetchCounts])

  const handleSelect = (value: string) => {
    setSelected(value)
    setOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-background">

      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-30 h-full w-60 bg-sidebar border-r flex flex-col
        transform transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <span className="font-semibold text-sm tracking-tight">Submissions</span>
          <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {SITES.map((site) => {
            const count = newCounts[site.value] || 0
            const isActive = selected === site.value

            return (
              <button
                key={site.value}
                onClick={() => handleSelect(site.value)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left
                  transition-colors
                  ${isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-sidebar-foreground"}
                `}
              >
                {site.value === "all" ? (
                  <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <span className={`h-2 w-2 rounded-full shrink-0 ${siteColors[site.value] || "bg-gray-400"}`} />
                )}

                <span className="truncate flex-1">{site.label}</span>

                {count > 0 && (
                  <span className={`
                    text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                    ${isActive ? "bg-white/20 text-white" : "bg-blue-500 text-white"}
                  `}>
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="border-t px-2 py-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              {SITES.find(s => s.value === selected)?.label || "All Sites"}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Form submissions dashboard
            </p>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children(selected, fetchCounts)}
        </main>
      </div>
    </div>
  )
}