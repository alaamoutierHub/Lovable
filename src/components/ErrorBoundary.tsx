// Commerly — top-level error boundary (Sentry-ready). Reports to Sentry's store
// endpoint when VITE_SENTRY_DSN is set; otherwise logs to console. Keeps the app
// from white-screening on a render error.
import { Component, type ErrorInfo, type ReactNode } from "react";

function reportToSentry(error: Error, info: ErrorInfo) {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  // eslint-disable-next-line no-console
  console.error("[Commerly] Uncaught error:", error, info.componentStack);
  if (!dsn) return;
  try {
    // Minimal DSN parse: https://<key>@<host>/<projectId>
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return;
    const [, key, host, projectId] = m;
    const endpoint = `https://${host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`;
    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        platform: "javascript",
        exception: { values: [{ type: error.name, value: error.message }] },
        extra: { componentStack: info.componentStack },
      }),
    }).catch(() => {});
  } catch {
    /* never let error reporting throw */
  }
}

interface State { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportToSentry(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
          <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-800 dark:bg-slate-900">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-500">{this.state.message ?? "An unexpected error occurred."}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
