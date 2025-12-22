"use client";

import { motion } from "framer-motion";
import { Search, Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          {/* 404 Icon */}
          <div className="icon-box bg-[var(--surface-elevated)] border-[var(--border)] mx-auto mb-6 w-16 h-16 rounded-2xl">
            <Search className="w-8 h-8 text-[var(--text-muted)]" strokeWidth={1.5} />
          </div>

          {/* 404 Display */}
          <div className="mb-4">
            <span className="text-6xl font-bold tracking-tight text-[var(--text-muted)]">
              404
            </span>
          </div>

          {/* Message */}
          <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
          <p className="text-[var(--text-muted)] mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/" className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2">
              <Home className="w-4 h-4" strokeWidth={2} />
              <span>Back to Home</span>
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
