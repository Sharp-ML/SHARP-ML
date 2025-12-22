"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          {/* Error Icon */}
          <div className="icon-box bg-[var(--error)]/10 border-[var(--error)]/20 mx-auto mb-6 w-16 h-16 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-[var(--error)]" strokeWidth={1.5} />
          </div>

          {/* Error Message */}
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-[var(--text-muted)] mb-2">
            We encountered an unexpected error while processing your request.
          </p>
          
          {/* Error Details */}
          {error.digest && (
            <p className="text-xs text-[var(--text-muted)] mb-6 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          {/* Helpful Tips */}
          <div className="bg-[var(--surface-elevated)] rounded-xl p-5 border border-[var(--border)] mb-8 text-left">
            <h3 className="font-medium mb-3 text-sm">What you can try:</h3>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)] mt-0.5">•</span>
                <span>Refresh the page and try again</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)] mt-0.5">•</span>
                <span>Clear your browser cache and cookies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)] mt-0.5">•</span>
                <span>Check your internet connection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)] mt-0.5">•</span>
                <span>If the problem persists, please try again later</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={reset} className="btn-primary w-full sm:w-auto">
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              <span>Try Again</span>
            </button>
            <a href="/" className="btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2">
              <Home className="w-4 h-4" strokeWidth={2} />
              <span>Go Home</span>
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
