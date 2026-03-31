import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { FormSubmission, SubmissionResponse } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const site = searchParams.get("site")
    const status = searchParams.get("status")

    const db = await getDatabase()
    const collection = db.collection<FormSubmission>("submissions")

    const filter: Record<string, unknown> = {}
    if (site) filter.site = site
    if (status) filter.status = status

    const submissions = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()

    const response: SubmissionResponse[] = submissions.map((sub) => ({
      _id: sub._id!.toString(),
      site: sub.site,
      data: sub.data,
      status: sub.status,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    }))

    return NextResponse.json(response)
  } catch (error) {
    console.error("Fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    )
  }
}
