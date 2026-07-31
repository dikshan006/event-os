import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) return null;

        // Suspended tenants cannot sign in at all.
        if (user.studioId) {
          const studio = await prisma.studio.findUnique({ where: { id: user.studioId } });
          if (!studio || studio.status === "SUSPENDED") return null;
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, role: user.role, studioId: user.studioId } as any;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role;
        token.studioId = (user as any).studioId;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as any).id = token.uid;
      (session.user as any).role = token.role;
      (session.user as any).studioId = token.studioId;
      return session;
    },
  },
});

export type SessionUser = { id: string; name: string; email: string; role: "ADMIN" | "PLANNER" | "MEMBER"; studioId: string | null };
