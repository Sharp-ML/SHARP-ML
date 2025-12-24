"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster 
        position="bottom-center" 
        toastOptions={{ 
          style: { 
            width: "480px",
          },
          classNames: {
            toast: "!py-4 hover:!py-4",
            content: "flex-1 mr-4",
            actionButton: "!h-8 !px-3 !rounded-lg !transition-none hover:!opacity-100",
            cancelButton: "!h-8 !px-3 !rounded-lg !transition-none hover:!opacity-100",
          },
        }} 
      />
    </SessionProvider>
  );
}
