// PromoLift — thin, dependency-free analytics wrapper (PostHog-compatible).
// No-ops safely when unconfigured. Configured from env (VITE_POSTHOG_KEY/HOST) or
// at runtime via the Integrations settings. Sends events to PostHog's capture
// endpoint; the project API key is client-safe (capture only).

interface AnalyticsConfig {
  projectApiKey: string;
  host: string;
}

let config: AnalyticsConfig | null = null;

function anonId(): string {
  try {
    const k = "promolift_anon_id";
    let id = localStorage.getItem(k);
    if (!id) {
      id = (crypto as Crypto).randomUUID();
      localStorage.setItem(k, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export function configureAnalytics(cfg: Partial<AnalyticsConfig> | null | undefined): void {
  const key = cfg?.projectApiKey || (import.meta.env.VITE_POSTHOG_KEY as string | undefined);
  const host = cfg?.host || (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";
  config = key ? { projectApiKey: key, host: host.replace(/\/$/, "") } : null;
}

export const isAnalyticsConfigured = (): boolean => config !== null;

/** Fire-and-forget capture. Returns false (no-op) when unconfigured. */
export function track(event: string, properties: Record<string, unknown> = {}): boolean {
  if (!config) return false;
  try {
    void fetch(`${config.host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        api_key: config.projectApiKey,
        event,
        distinct_id: anonId(),
        properties: { ...properties, $lib: "promolift" },
      }),
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export const trackPageview = (path: string) => track("$pageview", { $current_url: path });
