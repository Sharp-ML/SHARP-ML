"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Infinity, Share2, Loader2 } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneCount: number;
  limit: number;
}

const FEATURES = [
  {
    icon: Infinity,
    title: "Unlimited Scenes",
    description: "Generate as many 3D scenes as you want",
  },
  {
    icon: Zap,
    title: "Priority Processing",
    description: "Your renders get processed first",
  },
  {
    icon: Share2,
    title: "Share & Export",
    description: "High-res exports and shareable links",
  },
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] z-50 p-4"
          >
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-1">
                <h2 className="text-lg font-semibold text-gray-900">Upgrade to Pro</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 pb-5">
                {/* Primary CTA Button */}
                <button
                  onClick={handleUpgrade}
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-semibold text-base transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-3 shadow-lg shadow-blue-500/25"
                >
                {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Upgrade Now"
                  )}
                </button>

                {/* Error message */}
                {error && (
                  <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  </div>
                )}

                {/* Divider text */}
                <p className="text-center text-gray-400 text-sm my-4">
                  or see what&apos;s included
                </p>

                {/* Feature cards */}
                <div className="space-y-2">
                  {FEATURES.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50"
                      >
                        <div>
                          <h3 className="font-medium text-gray-900 text-sm">
                            {feature.title}
                          </h3>
                          <p className="text-gray-500 text-xs">
                            {feature.description}
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 ml-3">
                          <Icon className="w-5 h-5 text-[#2196F3]" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Usage info */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Your usage</span>
                    <span className="text-xs font-medium text-gray-700">
                      {sceneCount} / {limit} scenes
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2196F3] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (sceneCount / limit) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Footer text */}
                <p className="text-center text-gray-400 text-xs mt-4">
                  One-time payment • Secure checkout
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
