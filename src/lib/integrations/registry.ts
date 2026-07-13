// PromoLift — connector registry (docs §10). Adding an integration is data, not
// core-logic changes: register it here, and the Settings page renders it with
// status, connect/disconnect, and audit. Secrets are NEVER stored here — server
// secrets live in Supabase Edge Function secrets; only public client config
// (e.g. a PostHog project key) is captured in the UI.

export type IntegrationCategory = "ai" | "analytics" | "email" | "data" | "billing" | "messaging";
export type IntegrationPhase = "mvp" | "phase2" | "phase3";

export interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
}

export interface Connector {
  key: string;               // matches integrations.provider
  name: string;
  description: string;
  category: IntegrationCategory;
  phase: IntegrationPhase;
  /** true => configured via public client values (safe in browser); false => server secret only */
  clientSafe: boolean;
  /** public config fields the admin can enter (client-safe only) */
  configFields: ConfigField[];
  /** name of the server-side secret this connector needs (documentation only) */
  serverSecret?: string;
  docsUrl?: string;
}

export const CONNECTORS: Connector[] = [
  {
    key: "anthropic", name: "Anthropic (Claude)", category: "ai", phase: "mvp",
    description: "Server-side AI summaries. Key set as a Supabase Edge Function secret.",
    clientSafe: false, configFields: [], serverSecret: "ANTHROPIC_API_KEY",
    docsUrl: "https://console.anthropic.com",
  },
  {
    key: "openai", name: "OpenAI", category: "ai", phase: "phase2",
    description: "Alternative AI provider behind the same server-side proxy.",
    clientSafe: false, configFields: [], serverSecret: "OPENAI_API_KEY",
  },
  {
    key: "posthog", name: "PostHog", category: "analytics", phase: "mvp",
    description: "Product analytics. Project API key is client-safe (event capture only).",
    clientSafe: true,
    configFields: [
      { key: "projectApiKey", label: "Project API key", placeholder: "phc_..." },
      { key: "host", label: "Host", placeholder: "https://us.i.posthog.com" },
    ],
    docsUrl: "https://posthog.com",
  },
  {
    key: "sentry", name: "Sentry", category: "analytics", phase: "mvp",
    description: "Error monitoring. DSN is client-safe.",
    clientSafe: true,
    configFields: [{ key: "dsn", label: "DSN", placeholder: "https://...@sentry.io/..." }],
    docsUrl: "https://sentry.io",
  },
  {
    key: "resend", name: "Resend", category: "email", phase: "phase2",
    description: "Transactional email (approvals, report delivery). Server secret.",
    clientSafe: false, configFields: [], serverSecret: "RESEND_API_KEY",
    docsUrl: "https://resend.com",
  },
  {
    key: "google_sheets", name: "Google Sheets", category: "data", phase: "phase3",
    description: "Import/export via Google OAuth (CSV import is available today).",
    clientSafe: false, configFields: [],
  },
  {
    key: "stripe", name: "Stripe", category: "billing", phase: "phase2",
    description: "Subscription billing. Server secret; webhooks server-side.",
    clientSafe: false, configFields: [], serverSecret: "STRIPE_SECRET_KEY",
  },
  {
    key: "slack", name: "Slack", category: "messaging", phase: "phase3",
    description: "Notifications to channels (MCP-ready).",
    clientSafe: false, configFields: [],
  },
];

export function connectorByKey(key: string): Connector | undefined {
  return CONNECTORS.find((c) => c.key === key);
}
