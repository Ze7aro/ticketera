import { authConfigured } from "@/lib/auth-config";
import { z } from "zod";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { consumeLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/modules/users/validation";
import { dummyHash, verifyPassword } from "@/modules/users/password";
import { sessionIsCurrent } from "@/modules/users/policy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: "/auth/login", error: "/auth/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  useSecureCookies:
    process.env.APP_URL?.startsWith("https://") ??
    process.env.NODE_ENV === "production",
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials, request) {
        if (!authConfigured()) return null;
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        await consumeLimit("login-global", "all", 300, 900);
        await consumeLimit("login-email", parsed.data.email, 8, 900);
        // Only Vercel's platform-provided IP is trusted; arbitrary forwarded headers are ignored.
        if (process.env.VERCEL === "1")
          await consumeLimit(
            "login-ip",
            request.headers.get("x-vercel-forwarded-for") ?? "unknown",
            40,
            900,
          );
        const user = await getDb().user.findUnique({
          where: { email: parsed.data.email },
        });
        const valid = await verifyPassword(
          parsed.data.password,
          user?.passwordHash ?? dummyHash,
        );
        if (!valid || !user?.active) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (!authConfigured()) return null;
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
        token.issuedAt = Date.now();
      }
      if (!token.sub) return null;
      const current = await getDb().user.findUnique({
        where: { id: token.sub },
        select: {
          active: true,
          role: true,
          sessionVersion: true,
          name: true,
          email: true,
        },
      });
      if (!sessionIsCurrent(current, token.sessionVersion, token.issuedAt))
        return null;
      token.role = current!.role;
      token.name = current!.name;
      token.email = current!.email;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = z.enum(["ADMIN", "CONTROLLER"]).parse(token.role);
      session.user.sessionVersion = z
        .number()
        .int()
        .parse(token.sessionVersion);
      return session;
    },
    redirect({ url }) {
      const origin = new URL(process.env.APP_URL ?? "http://localhost:3000")
        .origin;
      if (url.startsWith("/") && !url.startsWith("//"))
        return `${origin}${url}`;
      return new URL(url, origin).origin === origin
        ? url
        : `${origin}/auth/continue`;
    },
  },
  logger: {
    error() {
      console.error("AUTH_ERROR: no se pudo completar la autenticación.");
    },
  },
});
