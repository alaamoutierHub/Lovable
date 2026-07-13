import { useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { can } from "../lib/auth/permissions";
import { Card, Badge, Button, Input } from "../components/ui/primitives";
import { SettingsTabs } from "../components/SettingsTabs";
import { CONNECTORS, type Connector } from "../lib/integrations/registry";
import { useIntegrations, useConnectIntegration, useDisconnectIntegration } from "../lib/data/integrations";

const PHASE_TONE = { mvp: "green", phase2: "amber", phase3: "slate" } as const;
const PHASE_LABEL = { mvp: "Available", phase2: "Phase 2", phase3: "Phase 3" } as const;

export default function IntegrationsSettingsPage() {
  const { activeOrgId, role } = useAuth();
  const integrations = useIntegrations(activeOrgId);
  const connect = useConnectIntegration(activeOrgId);
  const disconnect = useDisconnectIntegration(activeOrgId);
  const isAdmin = can(role, "manage_integrations");
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  const statusOf = (key: string) => integrations.data?.[key]?.status ?? "disconnected";

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings</h1>
      <SettingsTabs />
      <p className="mb-4 text-sm text-slate-500">
        Connect external services. Server secrets (AI, email, billing) are set in Supabase Edge Function
        secrets — never in the browser. Only public client config is entered here.
        {!isAdmin && " Managing integrations requires an admin role."}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {CONNECTORS.map((c) => {
          const status = statusOf(c.key);
          const row = integrations.data?.[c.key];
          const draft = drafts[c.key] ?? {};
          return (
            <Card key={c.key}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</h3>
                    <Badge tone={PHASE_TONE[c.phase]}>{PHASE_LABEL[c.phase]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{c.description}</p>
                </div>
                <Badge tone={status === "connected" ? "green" : status === "error" ? "red" : "slate"}>
                  {status}
                </Badge>
              </div>

              {c.serverSecret && (
                <p className="mb-2 text-xs text-slate-400">
                  Server secret: <code>{c.serverSecret}</code> (set in Supabase, not here).
                </p>
              )}
              {row?.last_error && <p className="mb-2 text-xs text-red-600">{row.last_error}</p>}

              {isAdmin && (
                <div className="space-y-2">
                  {c.clientSafe && c.configFields.map((f) => (
                    <Input
                      key={f.key}
                      placeholder={f.label + (f.placeholder ? ` — ${f.placeholder}` : "")}
                      value={draft[f.key] ?? (row?.config?.[f.key] as string) ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [c.key]: { ...d[c.key], [f.key]: e.target.value } }))
                      }
                    />
                  ))}
                  <div className="flex gap-2">
                    {status === "connected" ? (
                      <Button variant="ghost" className="text-red-600" onClick={() => disconnect.mutate(c.key)}>
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        onClick={() => connect.mutate({ provider: c.key, config: buildConfig(c, draft) })}
                        disabled={connect.isPending}
                      >
                        {c.clientSafe ? "Connect" : "Mark connected"}
                      </Button>
                    )}
                    {c.docsUrl && (
                      <a href={c.docsUrl} target="_blank" rel="noreferrer"
                        className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        Docs ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function buildConfig(c: Connector, draft: Record<string, string>): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};
  for (const f of c.configFields) if (draft[f.key]) cfg[f.key] = draft[f.key];
  return cfg;
}
