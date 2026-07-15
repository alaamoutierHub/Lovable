import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Can } from "../components/guards";
import { Button, Card, Field, Input, Badge } from "../components/ui/primitives";
import { SettingsTabs } from "../components/SettingsTabs";
import {
  MASTER_ENTITIES, MasterEntityKey, useMasterList, useCreateMaster,
  useUpdateMaster, useSoftDeleteMaster, type Row,
} from "../lib/data/masterData";

export default function MasterDataPage() {
  const { activeOrgId } = useAuth();
  const [entity, setEntity] = useState<MasterEntityKey>("channels");
  const def = MASTER_ENTITIES[entity];

  const list = useMasterList(entity, activeOrgId);
  const create = useCreateMaster(entity, activeOrgId);
  const update = useUpdateMaster(entity, activeOrgId);
  const del = useSoftDeleteMaster(entity, activeOrgId);

  const [form, setForm] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Inline edit state: the row being edited and its draft values.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editErr, setEditErr] = useState<string | null>(null);

  function resetEntity(k: MasterEntityKey) {
    setEntity(k); setForm({}); setFormErr(null); setSearch("");
    setEditingId(null); setEditForm({}); setEditErr(null);
  }

  // Build a values object from a string draft, applying required checks + number coercion.
  function collect(draft: Record<string, string>): { values: Record<string, unknown> } | { error: string } {
    for (const f of def.fields) {
      if (f.required && !draft[f.key]?.trim()) return { error: `${f.label} is required.` };
    }
    const values: Record<string, unknown> = {};
    for (const f of def.fields) {
      const raw = draft[f.key];
      if (raw == null || raw === "") continue;
      values[f.key] = f.type === "number" ? Number(raw) : raw;
    }
    return { values };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const res = collect(form);
    if ("error" in res) { setFormErr(res.error); return; }
    create.mutate(res.values, {
      onSuccess: () => setForm({}),
      onError: (e) => setFormErr((e as Error).message),
    });
  }

  function startEdit(row: Row) {
    const draft: Record<string, string> = {};
    for (const f of def.fields) {
      const v = row[f.key];
      draft[f.key] = v == null ? "" : String(v);
    }
    setEditingId(row.id);
    setEditForm(draft);
    setEditErr(null);
  }

  function saveEdit(id: string) {
    setEditErr(null);
    const res = collect(editForm);
    if ("error" in res) { setEditErr(res.error); return; }
    update.mutate(
      { id, values: res.values },
      {
        onSuccess: () => { setEditingId(null); setEditForm({}); },
        onError: (e) => setEditErr((e as Error).message),
      },
    );
  }

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r[def.titleField] ?? "").toLowerCase().includes(q));
  }, [rows, search, def.titleField]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings</h1>
      <SettingsTabs />
      <p className="mb-4 text-sm text-slate-500">Channels, brands, categories, SKUs, customers and mechanics.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(MASTER_ENTITIES) as MasterEntityKey[]).map((k) => (
          <button
            key={k}
            onClick={() => resetEntity(k)}
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">{def.label}</h3>
            <div className="flex items-center gap-2">
              <Input
                className="w-48"
                placeholder={`Filter by ${def.fields[0]?.label.toLowerCase() ?? "name"}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Badge>{filtered.length}</Badge>
            </div>
          </div>
          {list.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {list.isError && <p className="text-sm text-red-600">{(list.error as Error).message}</p>}
          {list.data && list.data.length === 0 && (
            <p className="text-sm text-slate-400">No {def.label.toLowerCase()} yet.</p>
          )}
          {list.data && list.data.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-slate-400">No {def.label.toLowerCase()} match “{search}”.</p>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                    {def.fields.map((f) => <th key={f.key} className="py-2 pr-4">{f.label}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row: Row) => {
                    const isEditing = editingId === row.id;
                    return (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 align-top">
                        {def.fields.map((f) => (
                          <td key={f.key} className="py-2 pr-4 text-slate-700 dark:text-slate-200">
                            {isEditing ? (
                              <Input
                                type={f.type === "number" ? "number" : "text"}
                                value={editForm[f.key] ?? ""}
                                onChange={(e) => setEditForm((s) => ({ ...s, [f.key]: e.target.value }))}
                              />
                            ) : (
                              String(row[f.key] ?? "—")
                            )}
                          </td>
                        ))}
                        <td className="py-2 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              {editErr && <span className="mr-1 text-xs text-red-600">{editErr}</span>}
                              <Button
                                onClick={() => saveEdit(row.id)}
                                disabled={update.isPending}
                                className="px-2 py-1 text-xs"
                              >
                                {update.isPending ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                variant="ghost"
                                className="px-2 py-1 text-xs"
                                onClick={() => { setEditingId(null); setEditErr(null); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Can permission="edit">
                                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => startEdit(row)}>
                                  Edit
                                </Button>
                              </Can>
                              <Can permission="delete">
                                <Button
                                  variant="ghost"
                                  className="px-2 py-1 text-xs text-red-600"
                                  onClick={() => {
                                    if (confirm(`Delete this ${def.singular}?`)) del.mutate(row.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              </Can>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
