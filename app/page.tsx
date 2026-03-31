"use client"

import { SidebarLayout } from "@/components/sidebar-layout"
import { SubmissionsDashboard } from "@/components/submissions-dashboard"

export default function HomePage() {
  return (
    <SidebarLayout>
      {(siteFilter, refreshCounts) => (
        <SubmissionsDashboard siteFilter={siteFilter} onStatusChange={refreshCounts} />
      )}
    </SidebarLayout>
  )
}