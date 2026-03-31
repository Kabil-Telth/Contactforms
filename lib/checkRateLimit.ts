import { NextRequest, NextResponse } from "next/server"

// in-memory store — resets when server restarts
const ipRequests = new Map<string, { count: number; resetAt: number }>()

const LIMITS = [
  { windowMs: 60 * 1000, max: 2 },    // 2 requests per 1 min
  { windowMs: 5 * 60 * 1000, max: 3 }, // 3 requests per 5 min
]

export async function checkRateLimit(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"

  const now = Date.now()

  for (const limit of LIMITS) {
    const key = `${ip}:${limit.windowMs}`  // unique key per IP per window
    const record = ipRequests.get(key)

    if (!record || now > record.resetAt) {
      // first request or window expired — reset
      ipRequests.set(key, { count: 1, resetAt: now + limit.windowMs })
    } else {
      record.count++
      if (record.count > limit.max) {
        return NextResponse.json(
          { error: `Too many requests — try again in ${limit.windowMs / 1000}s` },
          { status: 429 }
        )
      }
    }
  }

  return null  // not rate limited
}