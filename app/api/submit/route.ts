import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { FormSubmission } from "@/lib/types"
import { checkRateLimit } from "@/lib/checkRateLimit"


// Allowed sites - add all your domains here
const ALLOWED_ORIGINS = [
  "https://nahm-som.org",       
  "https://medpassedu.org",     
  "https://telth.care",         
  "https://telth.org",         
  "https://natlife.org",      
  "http://localhost:8080",    
  "http://localhost:5500",    
  "http://127.0.0.1:5500",    
]

function getCorsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin)
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",  // only allow listed origins
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

export async function POST(request: NextRequest) {
     const origin = request.headers.get("origin") || ""
  const corsHeaders = getCorsHeaders(origin)

  // check rate limit first before anything else
  const rateLimitResponse = await checkRateLimit(request)
  if (rateLimitResponse) {
    return new NextResponse(rateLimitResponse.body, {
      status: 429,
      headers: {
        ...Object.fromEntries(rateLimitResponse.headers),
        ...corsHeaders,   // always include CORS even on rate limit response
      },
    })
  }
  try {
    const body = await request.json()

    // Auto-detect site from origin
    const site = new URL(origin).hostname  // "nahm-som.org"

    if (!site) {
      return NextResponse.json(
        { error: "Could not detect site" },
        { status: 400, headers: corsHeaders }
      )
    }

    const db = await getDatabase()
    const collection = db.collection<FormSubmission>("submissions")

    const submission: FormSubmission = {
      site,
      data: body,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(submission)

    return NextResponse.json(
      { success: true, id: result.insertedId },
      { status: 201, headers: corsHeaders }  // ← cors headers in every response
    )
  } catch (error) {
    console.error("Submission error:", error)
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  
  return new NextResponse(null, {   // ← use new NextResponse(null) not NextResponse.json({})
    status: 204,                    // ← 204 No Content is correct for preflight
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",   // ← cache preflight for 24hrs
    }
  })
}

export async function GET() {
  return Response.json({
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassSet: !!process.env.ADMIN_PASSWORD,
    secretSet: !!process.env.NEXTAUTH_SECRET,
  })
}

GET()