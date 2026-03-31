import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const path = req.nextUrl.pathname

  const isLoginPage = path === "/login"
  const isApiSubmit = path === "/api/submit"
  const isAuthRoute = path.startsWith("/api/auth")  // ← NextAuth internal routes

  // always allow these — never block
  if (isApiSubmit || isAuthRoute) return NextResponse.next()

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon).*)"],
}
