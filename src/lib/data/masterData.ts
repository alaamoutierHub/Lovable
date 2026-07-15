// Commerly — master-data access layer (TanStack Query + Supabase).
// Generic CRUD over the master tables. Soft-delete via deleted_at.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client";

export type MasterEntityKey =
  | "channels" | "categories" | "brands" | "products" | "customers" | "promotion_mechanics";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number";
  required?: boolean;
}

export interface EntityDef {
  key: MasterEntityKey;
  label: string;
  singular: string;
  fields: FieldDef[];
  /** column used as the row's display title */
  titleField: string;
}

export const MASTER_ENTITIES: Record<MasterEntityKey, EntityDef> = {
  channels: {
    key: "channels", label: "Channels", singular: "Channel", titleField: "name",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text" },
      { key: "country", label: "Country (ISO-2)", type: "text" },
    ],
  },
  categories: {
    key: "categories", label: "Categories", singular: "Category", titleField: "name",
    fields: [{ key: "name", label: "Name", type: "text", required: true }],
  },
  brands: {
    key: "brands", label: "Brands", singular: "Brand", titleField: "name",
    fields: [{ key: "name", label: "Name", type: "text", required: true }],
  },
  products: {
    key: "products", label: "SKUs", singular: "SKU", titleField: "name",
    fields: [
      { key: "sku_code", label: "SKU code", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "normal_price", label: "Normal price", type: "number" },
      { key: "currency", label: "Currency", type: "text" },
    ],
  },
  customers: {
    key: "customers", label: "Customers / Retailers", singular: "Customer", titleField: "name",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "country", label: "Country (ISO-2)", type: "text" },
    ],
  },
  promotion_mechanics: {
    key: "promotion_mechanics", label: "Promotion Mechanics", singular: "Mechanic", titleField: "name",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text" },
    ],
  },
};

export type Row = Record<string, unknown> & { id: string };

function keyFor(entity: MasterEntityKey, orgId: string | null) {
  return ["master", entity, orgId] as const;
}

export function useMasterList(entity: MasterEntityKey, orgId: string | null) {
  return useQuery({
    queryKey: keyFor(entity, orgId),
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<Row[]> => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from(entity)
        .select("*")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });
}

export function useCreateMaster(entity: MasterEntityKey, orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (!supabase || !orgId) throw new Error("Supabase not connected");
      const { error } = await supabase.from(entity).insert({ ...values, organization_id: orgId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(entity, orgId) }),
  });
}

export function useUpdateMaster(entity: MasterEntityKey, orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      if (!supabase) throw new Error("Supabase not connected");
      const { error } = await supabase.from(entity).update(values).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(entity, orgId) }),
  });
}

export function useSoftDeleteMaster(entity: MasterEntityKey, orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Supabase not connected");
      const { error } = await supabase
        .from(entity)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(entity, orgId) }),
  });
}
