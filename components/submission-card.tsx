"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { SubmissionResponse, SubmissionStatus } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

interface SubmissionCardProps {
  submission: SubmissionResponse
  onStatusChange: (id: string, status: SubmissionStatus) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const statusColors: Record<SubmissionStatus, string> = {
  new: "bg-blue-500 hover:bg-blue-600",
  seen: "bg-yellow-500 hover:bg-yellow-600",
  replied: "bg-green-500 hover:bg-green-600",
  archived: "bg-muted text-muted-foreground hover:bg-muted",
}

const siteColors: Record<string, string> = {
  "nahm-som.org": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "medpassedu.org": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "telth.care": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "telth.org": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "natlife.org": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
}

export function SubmissionCard({ submission, onStatusChange, onDelete }: SubmissionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (status: SubmissionStatus) => {
    setLoading(true)
    await onStatusChange(submission._id, status)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this submission?")) {
      setLoading(true)
      await onDelete(submission._id)
    }
  }

  const siteColor = siteColors[submission.site] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"

  return (
    <Card className={`transition-all ${submission.status === "archived" ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={siteColor}>
              {submission.site}
            </Badge>
            <Badge className={statusColors[submission.status]}>
              {submission.status}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
          </span>
        </div>
        <CardTitle className="text-base mt-2">
          {(submission.data.subject as string) || 
           (submission.data.from_name as string) || 
           (submission.data.name as string) || 
           (submission.data.first_name as string) ||
           "Form Submission"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {submission.data.email && (
              <div>
                <span className="text-muted-foreground">Email:</span>{" "}
                <a href={`mailto:${submission.data.email}`} className="text-primary hover:underline">
                  {submission.data.email as string}
                </a>
              </div>
            )}
            {submission.data.phone && (
              <div>
                <span className="text-muted-foreground">Phone:</span>{" "}
                {submission.data.phone as string}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full justify-between"
          >
            {expanded ? "Hide Details" : "Show All Data"}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {expanded && (
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                {JSON.stringify(submission.data, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <Select
              value={submission.status}
              onValueChange={(value) => handleStatusChange(value as SubmissionStatus)}
              disabled={loading}
            >
              <SelectTrigger className="w-32">
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
              size="icon"
              onClick={handleDelete}
              disabled={loading}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
