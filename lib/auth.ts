import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import { prisma } from "./prisma";

// Free tier limit
export const FREE_SCENE_LIMIT = 3;

// Check if we have all required env vars for auth
const hasAuthConfig = 
  process.env.GOOGLE_CLIENT_ID && 
  process.env.GOOGLE_CLIENT_SECRET;

// Create a placeholder config for build time when env vars aren't available
const authConfig = hasAuthConfig ? {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }: { session: any; user: any }) {
      // Add user id and usage info to session
      if (session.user) {
        session.user.id = user.id;
        
        // Get fresh user data for usage tracking
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            sceneCount: true,
            isPaid: true,
            emailVerified: true,
          },
        });
        
        if (dbUser) {
          session.user.sceneCount = dbUser.sceneCount;
          session.user.isPaid = dbUser.isPaid;
          session.user.emailVerified = dbUser.emailVerified;
          session.user.canUpload = dbUser.isPaid || dbUser.sceneCount < FREE_SCENE_LIMIT;
          session.user.remainingUploads = dbUser.isPaid 
            ? Infinity 
            : Math.max(0, FREE_SCENE_LIMIT - dbUser.sceneCount);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Use the main page for sign in
  },
  trustHost: true,
} : {
  providers: [],
  trustHost: true,
};

const nextAuth = NextAuth(authConfig);

export const { handlers, signIn, signOut, auth } = nextAuth;

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      sceneCount?: number;
      isPaid?: boolean;
      emailVerified?: Date | null;
      canUpload?: boolean;
      remainingUploads?: number;
    };
  }
}
