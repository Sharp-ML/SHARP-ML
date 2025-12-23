"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneCount: number;
  limit: number;
}

export function UpgradeModal({ isOpen, onClose, sceneCount, limit }: UpgradeModalProps) {
  const handleContactSupport = () => {
    // Opens a DM compose window on X/Twitter
    window.open("https://x.com/messages/compose?recipient_id=1325862778603769856", "_blank");
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
                <h2 className="text-lg font-semibold text-gray-900">Limit Reached</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 pb-5">
                {/* Message */}
                <p className="text-gray-600 text-sm mt-2 mb-4">
                  You&apos;ve reached your limit of {limit} scenes. Want more? Reach out and let us know!
                </p>

                {/* Usage info */}
                <div className="mb-4 p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Your usage</span>
                    <span className="text-xs font-medium text-gray-700">
                      {sceneCount} / {limit} scenes
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2196F3] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (sceneCount / limit) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Contact Support Button */}
                <button
                  onClick={handleContactSupport}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#2196F3] hover:bg-[#1E88E5] text-white font-semibold text-base transition-colors flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25"
                >
                  <MessageCircle className="w-5 h-5" />
                  Contact Support
                </button>

                {/* Footer text */}
                <p className="text-center text-gray-400 text-xs mt-4">
                  We&apos;ll get back to you soon
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
