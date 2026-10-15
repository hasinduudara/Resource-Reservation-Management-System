"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("Global error digest:", error.digest);
    }
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Unexpected Error | RRSM</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
          }
          .card {
            max-width: 28rem;
            width: 100%;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }
          .icon-ring {
            margin: 0 auto;
            width: 3.5rem;
            height: 3.5rem;
            border-radius: 9999px;
            background: rgba(239,68,68,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #f87171;
          }
          h1 { font-size: 1.25rem; font-weight: 700; }
          p  { font-size: 0.875rem; color: #94a3b8; line-height: 1.5; }
          .digest { font-size: 0.7rem; color: #475569; font-family: monospace; }
          .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
          button, a.btn {
            display: inline-flex; align-items: center; justify-content: center;
            padding: 0.5rem 1rem; border-radius: 0.375rem;
            font-size: 0.875rem; font-weight: 500; text-decoration: none;
            cursor: pointer; border: none; transition: opacity 0.15s;
          }
          button:hover, a.btn:hover { opacity: 0.85; }
          .btn-primary { background: #6366f1; color: #fff; }
          .btn-outline { background: transparent; color: #e2e8f0; border: 1px solid #334155; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon-ring">
            <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div>
            <h1>Something went wrong</h1>
            <p>
              A critical error occurred. Please try again. If the problem
              persists, contact your system administrator.
            </p>
            {error.digest && (
              <p className="digest" style={{ marginTop: "0.5rem" }}>
                Ref: {error.digest}
              </p>
            )}
          </div>

          <div className="actions">
            <button type="button" className="btn-primary" onClick={() => reset()}>
              Try again
            </button>
            <a href="/" className="btn btn-outline">
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
