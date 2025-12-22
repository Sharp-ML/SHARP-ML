"use client";

import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "Server Configuration Error",
    description:
      "There's a problem with the server configuration. Please try again later or contact support if the issue persists.",
  },
  AccessDenied: {
    title: "Access Denied",
    description:
      "You don't have permission to sign in. Please use a different account or contact support.",
  },
  Verification: {
    title: "Verification Error",
    description:
      "The verification link may have expired or already been used. Please try signing in again.",
  },
  OAuthSignin: {
    title: "Sign In Error",
    description:
      "There was a problem starting the sign-in process. Please try again.",
  },
  OAuthCallback: {
    title: "Sign In Error",
    description:
      "There was a problem completing the sign-in process. Please try again.",
  },
  OAuthCreateAccount: {
    title: "Account Creation Error",
    description:
      "There was a problem creating your account. Please try again or use a different sign-in method.",
  },
  EmailCreateAccount: {
    title: "Account Creation Error",
    description:
      "There was a problem creating your account with email. Please try again.",
  },
  Callback: {
    title: "Callback Error",
    description:
      "There was a problem processing your sign-in. Please try again.",
  },
  OAuthAccountNotLinked: {
    title: "Account Not Linked",
    description:
      "This email is already associated with another account. Please sign in with the original provider.",
  },
  SessionRequired: {
    title: "Session Required",
    description: "Please sign in to access this page.",
  },
  Default: {
    title: "Authentication Error",
    description:
      "An unexpected error occurred during authentication. Please try again.",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error") || "Default";

  const { title, description } =
    errorMessages[errorType] || errorMessages.Default;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full text-center"
    >
      {/* Error Icon */}
      <div className="icon-box bg-[var(--error)]/10 border-[var(--error)]/20 mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center border">
        <AlertCircle
          className="w-8 h-8 text-[var(--error)]"
          strokeWidth={1.5}
        />
      </div>

      {/* Error Message */}
      <h1 className="text-2xl font-semibold mb-2">{title}</h1>
      <p className="text-[var(--text-muted)] mb-2">{description}</p>

      {/* Error Type */}
      {errorType !== "Default" && (
        <p className="text-xs text-[var(--text-muted)] mb-6 font-mono">
          Error Type: {errorType}
        </p>
      )}

      {/* Helpful Tips */}
      <div className="bg-[var(--surface-elevated)] rounded-xl p-5 border border-[var(--border)] mb-8 text-left">
        <h3 className="font-medium mb-3 text-sm">What you can try:</h3>
        <ul className="space-y-2 text-sm text-[var(--text-muted)]">
          <li className="flex items-start gap-2">
            <span className="text-[var(--text-secondary)] mt-0.5">•</span>
            <span>Clear your browser cookies and try again</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--text-secondary)] mt-0.5">•</span>
            <span>Try signing in with a different Google account</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--text-secondary)] mt-0.5">•</span>
            <span>Disable any ad blockers or privacy extensions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--text-secondary)] mt-0.5">•</span>
            <span>If the problem persists, please try again later</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/" className="btn-primary w-full sm:w-auto">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          <span>Back to Home</span>
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
          <span>Try Again</span>
        </button>
      </div>
    </motion.div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Suspense
          fallback={
            <div className="max-w-md w-full text-center">
              <div className="icon-box bg-[var(--error)]/10 border-[var(--error)]/20 mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center border">
                <AlertCircle
                  className="w-8 h-8 text-[var(--error)]"
                  strokeWidth={1.5}
                />
              </div>
              <h1 className="text-2xl font-semibold mb-2">Loading...</h1>
            </div>
          }
        >
          <AuthErrorContent />
        </Suspense>
      </main>
    </div>
  );
}
