import { supabase } from "@/integrations/supabase/client";

export type EspStatus = {
  status: {
    capetown: { stage: string; stage_updated: string };
    eskom: { stage: string; stage_updated: string };
  };
};

export type EspAreaEvent = {
  start: string;
  end: string;
  note: string;
  source: string;
};

export type EspAreaScheduleDay = {
  date: string;
  name: string;
  stages: string[][];
};

export type EspAreaInfo = {
  events: EspAreaEvent[];
  info: { name: string; region: string };
  schedule: { days: EspAreaScheduleDay[] };
};

export type EspAreaSearchResult = {
  id: string;
  name: string;
  region: string;
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("loadshedding", { body });
  if (error) throw new Error(error.message ?? "Load shedding request failed");
  if (!data?.success) throw new Error(data?.error ?? "Unknown error");
  return data.data as T;
}

export const loadshedding = {
  status: () => invoke<EspStatus>({ action: "status" }),
  area: (area_id: string) => invoke<EspAreaInfo>({ action: "area", area_id }),
  search: (search: string) => invoke<{ areas: EspAreaSearchResult[] }>({ action: "areas_search", search }),
};
