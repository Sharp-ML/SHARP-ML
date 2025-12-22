"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check, Loader2, AlertCircle } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneCount: number;
  limit: number;
}

const FEATURES = [
  "Unlimited 3D scene generation",
  "Priority processing",
  "High-resolution exports",
  "Share scenes with anyone",
  "Access to new features",
];

export function UpgradeModal({ isOpen, onClose, sceneCount, limit }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
          >
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 p-6 pb-8">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Upgrade to Pro</h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      Unlock unlimited 3D scenes
                    </p>
                  </div>
                </div>

                {/* Usage indicator */}
                <div className="bg-[var(--surface)]/80 backdrop-blur rounded-xl p-4 border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--text-muted)]">Scenes used</span>
                    <span className="text-sm font-medium">
                      {sceneCount} / {limit}
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (sceneCount / limit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    {sceneCount >= limit
                      ? "You've reached your free limit"
                      : `${limit - sceneCount} free scenes remaining`}
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="p-6">
                <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                  What you&apos;ll get
                </h3>
                <ul className="space-y-3 mb-6">
                  {FEATURES.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className="p-1 rounded-full bg-green-500/10">
                        <Check className="w-3 h-3 text-green-500" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={handleUpgrade}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Upgrade Now
                    </>
                  )}
                </button>

                <p className="text-xs text-[var(--text-muted)] text-center mt-4">
                  One-time payment • Secure checkout via Stripe
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
