"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Error | Image to 3D</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --accent: #1A1A1A;
            --accent-hover: #2D2D2D;
            --surface: #FFFFFF;
            --surface-elevated: #F5F5F4;
            --border: rgba(0, 0, 0, 0.08);
            --border-hover: rgba(0, 0, 0, 0.12);
            --text-muted: #78716C;
            --text-secondary: #57534E;
            --error: #EF4444;
            --warm-tint: #F9F7F5;
            --background: #FFFFFF;
            --foreground: #0A0A0A;
          }
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background: linear-gradient(180deg, var(--warm-tint) 0%, var(--background) 100%);
            color: var(--foreground);
          }
          
          .container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .main {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 48px 24px;
          }
          
          .content {
            max-width: 420px;
            width: 100%;
            text-align: center;
          }
          
          .icon-box {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
          }
          
          .icon-box svg {
            width: 32px;
            height: 32px;
            color: var(--error);
          }
          
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: -0.02em;
          }
          
          .description {
            color: var(--text-muted);
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 8px;
          }
          
          .error-id {
            font-size: 12px;
            color: var(--text-muted);
            font-family: ui-monospace, monospace;
            margin-bottom: 24px;
          }
          
          .tips-box {
            background: var(--surface-elevated);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border);
            margin-bottom: 32px;
            text-align: left;
          }
          
          .tips-box h3 {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 12px;
          }
          
          .tips-box ul {
            list-style: none;
          }
          
          .tips-box li {
            font-size: 14px;
            color: var(--text-muted);
            padding: 4px 0;
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }
          
          .tips-box li span.bullet {
            color: var(--text-secondary);
            margin-top: 2px;
          }
          
          .actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          
          @media (min-width: 480px) {
            .actions {
              flex-direction: row;
              justify-content: center;
            }
          }
          
          .btn-primary {
            background: var(--accent);
            color: #ffffff;
            font-weight: 500;
            padding: 12px 20px;
            border-radius: 9999px;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
          }
          
          .btn-primary:hover {
            background: var(--accent-hover);
            transform: translateY(-1px);
          }
          
          .btn-secondary {
            background: transparent;
            color: var(--foreground);
            font-weight: 500;
            padding: 12px 20px;
            border-radius: 9999px;
            border: 1px solid var(--border-hover);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
          }
          
          .btn-secondary:hover {
            background: var(--surface-elevated);
          }
          
          .btn-primary svg, .btn-secondary svg {
            width: 16px;
            height: 16px;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <main className="main">
            <div className="content">
              {/* Error Icon */}
              <div className="icon-box">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>

              {/* Error Message */}
              <h1>Something went wrong</h1>
              <p className="description">
                We encountered a critical error. Our team has been notified.
              </p>

              {error.digest && (
                <p className="error-id">Error ID: {error.digest}</p>
              )}

              {/* Helpful Tips */}
              <div className="tips-box">
                <h3>What you can try:</h3>
                <ul>
                  <li>
                    <span className="bullet">•</span>
                    <span>Refresh the page and try again</span>
                  </li>
                  <li>
                    <span className="bullet">•</span>
                    <span>Clear your browser cache and cookies</span>
                  </li>
                  <li>
                    <span className="bullet">•</span>
                    <span>Check your internet connection</span>
                  </li>
                  <li>
                    <span className="bullet">•</span>
                    <span>If the problem persists, try again later</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="actions">
                <button onClick={reset} className="btn-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                  <span>Try Again</span>
                </button>
                <a href="/" className="btn-secondary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Go Home</span>
                </a>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
