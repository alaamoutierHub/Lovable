import { useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Can } from "../components/guards";
import { Button, Card, Field, Input, Badge } from "../components/ui/primitives";
import { SettingsTabs } from "../components/SettingsTabs";
import {
  MASTER_ENTITIES, MasterEntityKey, useMasterList, useCreateMaster,
  useSoftDeleteMaster, type Row,
} from "../lib/data/masterData";

export default function MasterDataPage() {
  const { activeOrgId } = useAuth();
  const [entity, setEntity] = useState<MasterEntityKey>("channels");
  const def = MASTER_ENTITIES[entity];

  const list = useMasterList(entity, activeOrgId);
  const create = useCreateMaster(entity, activeOrgId);
  const del = useSoftDeleteMaster(entity, activeOrgId);

  const [form, setForm] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    for (const f of def.fields) {
      if (f.required && !form[f.key]?.trim()) {
        setFormErr(`${f.label} is required.`);
        return;
      }
    }
    const values: Record<string, unknown> = {};
    for (const f of def.fields) {
      const raw = form[f.key];
      if (raw == null || raw === "") continue;
      values[f.key] = f.type === "number" ? Number(raw) : raw;
    }
    create.mutate(values, {
      onSuccess: () => setForm({}),
      onError: (e) => setFormErr((e as Error).message),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings</h1>
      <SettingsTabs />
      <p className="mb-4 text-sm text-slate-500">Channels, brands, categories, SKUs, customers and mechanics.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(MASTER_ENTITIES) as MasterEntityKey[]).map((k) => (
          <button
            key={k}
            onClick={() => { setEntity(k); setForm({}); setFormErr(null); }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              entity === k
                ? "bg-brand text-brand-fg"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {MASTER_ENTITIES[k].label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Can permission="create">
          <Card>
            <h3 className="mb-3 font-semibold">Add {def.singular}</h3>
            <form onSubmit={submit} className="space-y-3">
              {def.fields.map((f) => (
                <Field key={f.key} label={f.label + (f.required ? " *" : "")}>
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                </Field>
              ))}
              {formErr && <p className="text-sm text-red-600">{formErr}</p>}
              <Button type="submit" disabled={create.isPending} className="w-full">
                {create.isPending ? "Saving…" : `Add ${def.singular}`}
              </Button>
            </form>
          </Card>
        </Can>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{def.label}</h3>
            <Badge>{list.data?.length ?? 0}</Badge>
          </div>
          {list.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {list.isError && <p className="text-sm text-red-600">{(list.error as Error).message}</p>}
          {list.data && list.data.length === 0 && (
            <p className="text-sm text-slate-400">No {def.label.toLowerCase()} yet.</p>
          )}
          {list.data && list.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                    {def.fields.map((f) => <th key={f.key} className="py-2 pr-4">{f.label}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((row: Row) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      {def.fields.map((f) => (
                        <td key={f.key} className="py-2 pr-4 text-slate-700 dark:text-slate-200">
                          {String(row[f.key] ?? "—")}
                        </td>
                      ))}
                      <td className="py-2 text-right">
                        <Can permission="delete">
                          <Button
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => {
                              if (confirm(`Delete this ${def.singular}?`)) del.mutate(row.id);
                            }}
                          >
                            Delete
                          </Button>
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
