import { rateLimits } from "./ratelimit"
import { NextRequest, NextResponse } from "next/server"

export async function checkRateLimit(request: NextRequest) {
  // get real IP — works on Vercel + local
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"                                   // fallback for local

  // check 1min limit first
  const minuteResult = await rateLimits.perMinute.limit(ip)
  if (!minuteResult.success) {
    return NextResponse.json(
      {
        error: "Too many requests — wait 1 minute",
        retryAfter: minuteResult.reset,            // timestamp when limit resets
      },
      { status: 429 }                              // 429 = Too Many Requests
    )
  }

  // check 5min limit
  const fiveMinResult = await rateLimits.per5Minutes.limit(ip)
  if (!fiveMinResult.success) {
    return NextResponse.json(
      {
        error: "Too many requests — wait 5 minutes",
        retryAfter: fiveMinResult.reset,
      },
      { status: 429 }
    )
  }

  return null  // null = not rate limited, proceed
}