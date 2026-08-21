import type { NextAuthConfig } from "next-auth";

/**
 * Config Edge-safe (sem Prisma/bcrypt) — usada pelo middleware.
 * `auth.ts` estende isto com o provider de credenciais, que só roda em runtime Node.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // jwt/session precisam estar aqui (não só em auth.ts) porque o middleware
    // instancia NextAuth(authConfig) separadamente — sem isso, auth.user.role
    // fica undefined dentro do callback `authorized` abaixo.
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.schoolId = user.schoolId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.role = token.role;
      session.user.schoolId = token.schoolId;
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isLoginPage = pathname.startsWith("/login");

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false;

      if (pathname.startsWith("/admin") && auth.user.role !== "PLATFORM_ADMIN") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
