import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
     authorize(credentials) {
  console.log("FULL CREDENTIALS OBJECT:", JSON.stringify(credentials))
  console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL)
  console.log("ADMIN_PASSWORD:", process.env.ADMIN_PASSWORD)

  const email = credentials?.email as string
  const password = credentials?.password as string

  const emailMatch = email?.trim() === process.env.ADMIN_EMAIL?.trim()
  const passMatch = password?.trim() === process.env.ADMIN_PASSWORD?.trim()

  console.log("emailMatch:", emailMatch, "passMatch:", passMatch)

  if (emailMatch && passMatch) {
    return { id: "1", name: "Admin", email }
  }
  return null
}
    }),
  ],
  pages: {
    signIn: "/login",  // custom login page route
  },
  session: {
    strategy: "jwt",   // jwt session — no db needed for single user
  },
})