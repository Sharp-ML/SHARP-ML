"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, LogOut, User, Sparkles, ArrowRight } from "lucide-react";
import { LayersIcon } from "@/components/ui/layers";
import Image from "next/image";
import { useState } from "react";

interface AuthGateProps {
  children: React.ReactNode;
}

// Demo card component showing 2D to 3D transformation
function DemoCard() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="relative w-full h-full flex items-center justify-center p-8"
    >
      <div className="w-full max-w-lg">
        {/* Card container */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 shadow-xl">
          {/* Before/After Header */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-[var(--text-muted)]">2D Image</span>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--primary)]">3D Scene</span>
          </div>

          {/* Image comparison container */}
          <div 
            className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[var(--surface-elevated)]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* 2D Original Image */}
            <motion.div
              className="absolute inset-0"
              animate={{
                opacity: isHovered ? 0 : 1,
              }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src="/demo-cat.png"
                alt="Original 2D image"
                fill
                className="object-cover"
                priority
              />
            </motion.div>

            {/* 3D Transformed View - Video on hover */}
            <motion.div
              className="absolute inset-0"
              animate={{
                opacity: isHovered ? 1 : 0,
              }}
              transition={{ duration: 0.5 }}
            >
              {isHovered && (
                <video
                  src="/cat-video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full object-cover"
                  style={{ height: "calc(100% + 80px)", objectPosition: "top" }}
                />
              )}
            </motion.div>

            {/* 2D/3D Label Chip - stays visible, only text changes */}
            <div 
              className={`absolute bottom-3 left-3 px-3 py-1.5 backdrop-blur-sm rounded-full z-10 overflow-hidden transition-colors duration-300 ${
                isHovered ? "bg-[var(--primary)]/90" : "bg-black/60"
              }`}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isHovered ? "3d" : "2d"}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs font-medium text-white block"
                >
                  {isHovered ? "3D" : "2D"}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Hover instruction */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              animate={{
                opacity: isHovered ? 0 : 1,
              }}
            >
              <div className="px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full">
                <span className="text-xs text-white/90">Hover to see 3D</span>
              </div>
            </motion.div>
          </div>

          {/* Caption */}
          <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
            Transform any photo into an interactive 3D scene in seconds
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function AuthGate({ children }: AuthGateProps) {
  const { data: session, status } = useSession();

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sign in screen if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left side - Login form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <div className="text-center mb-8">
              <div className="icon-box bg-[var(--primary)]/10 border-[var(--primary)]/20 mx-auto mb-6">
                <LayersIcon size={24} className="text-[var(--primary)]" isAnimating={true} />
              </div>
              <h1 className="text-2xl font-semibold mb-2">Welcome to Image to 3D</h1>
              <p className="text-[var(--text-muted)]">
                Sign in to transform your photos into interactive 3D scenes.
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
              <button
                onClick={() => signIn("google")}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>

              <p className="text-xs text-[var(--text-muted)] text-center mt-4">
                By signing in, you agree to our terms of service and privacy policy.
              </p>
            </div>

            <div className="mt-8 flex justify-center items-stretch gap-8 text-center">
              <div className="flex flex-col items-center justify-between py-4">
                <div className="text-2xl font-bold text-[var(--primary)] opacity-30">10</div>
                <div className="text-xs text-[var(--text-muted)]">Free scenes</div>
              </div>
              <div className="flex flex-col items-center justify-between py-4">
                <Sparkles className="size-6 text-[var(--primary)] opacity-30" />
                <div className="text-xs text-[var(--text-muted)]">AI-powered</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right side - Demo card (hidden on mobile) */}
        <div className="hidden lg:flex flex-1 bg-[var(--surface-elevated)] border-l border-[var(--border)]">
          <DemoCard />
        </div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}

// User menu component for the header
export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || "User"}
            className="w-8 h-8 rounded-full border border-[var(--border)]"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center">
            <User className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        )}
        <span className="text-sm font-medium hidden sm:block">
          {session.user.name || session.user.email}
        </span>
      </div>
      <button
        onClick={() => signOut()}
        className="p-2 rounded-lg hover:bg-[var(--surface)] transition-colors"
        title="Sign out"
      >
        <LogOut className="w-4 h-4 text-[var(--text-muted)]" />
      </button>
    </div>
  );
}
