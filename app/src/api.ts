const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export interface FlowerState {
  flower: string;
  last30: number;
  n: number;
  norm: number;
  state: "dormant" | "wilting" | "ok" | "blooming";
  hours: number;
}

export interface TxRow {
  d: string;
  mcc: number | null;
  eur: number;
}

export interface GardenState {
  id: string;
  age: number;
  zip: string;
  today: string;
  balance: number;
  salary: number;
  hourly: number;
  payday_window: [number, number];
  salary_received_this_month: boolean;
  days_to_payday: number;
  rent: number;
  rent_window: [number, number];
  rent_paid: boolean;
  next_rent_window: { month: string; d0: number; d1: number };
  bills_due: number;
  essentials_due: number;
  pond_target: number;
  pond_fill: number;
  safe_today: number;
  safe_week: number;
  month_free: number;
  spent_cycle: number;
  left_cycle: number;
  spent_week_leaks: number;
  storm: boolean;
  mood: "sun" | "cloud" | "storm";
  weather: "sun" | "partly" | "cloud" | "storm";
  stage: number;
  stage_name: string;
  save_first_pct: number;
  invest_month: number;
  essentials_p75_month: number;
  utilities_month: number;
  flowers: FlowerState[];
  restaurants_tx: TxRow[];
  top_flower: string;
  top_flower_tx: TxRow[];
  restaurants_weekend_share: number;
  invest_total: number;
  invest_months: number;
  invest_last: number;
  leaks_norm_month: number;
  baskets_last30: { B1a: number; B1b: number; B2: number; B3: number };
  sim_minus20_restaurants_6m: number;
  sim_minus20_hours: number;
}

export interface Persona {
  id: string;
  label: string;
}

export async function fetchPersonas(): Promise<Persona[]> {
  const r = await fetch(`${BASE}/api/personas`);
  if (!r.ok) throw new Error(`personas ${r.status}`);
  return r.json();
}

export interface TxResult {
  rows: { d: string; mcc: number | null; label: string; eur: number }[];
  count: number;
  period: string;
  sql: string;
}

export async function fetchTransactions(
  customerId: string,
  flower: string,
  today: string,
  days = 30,
): Promise<TxResult> {
  const r = await fetch(
    `${BASE}/api/customers/${customerId}/transactions?flower=${flower}&days=${days}&today=${today}`,
  );
  if (!r.ok) throw new Error(`transactions ${r.status}`);
  return r.json();
}

export interface SimChip {
  kind: "flower" | "pond" | "stage";
  text: string;
  changed: boolean;
}

export interface SimResult {
  category: string;
  cut_pct: number;
  months: number;
  disabled: boolean;
  monthly_cumulative: number[];
  monthly_pond: number[];
  monthly_pocket: number[];
  month_labels: string[];
  total: number;
  hours: number;
  today: { flower_state: FlowerState["state"]; pond_fill: number; stage: number; stage_name: string };
  future: { flower_state: FlowerState["state"]; pond_fill: number; pond_to_pocket: number; stage: number; stage_name: string };
  eur_per_day_now: number;
  eur_per_day_future: number;
  chips: SimChip[];
  norm: number;
}

export async function fetchSimulate(
  customerId: string,
  today: string,
  category: string,
  cutPct: number,
  saveFirstPct: number,
): Promise<SimResult> {
  const r = await fetch(`${BASE}/api/customers/${customerId}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ today, category, cut_pct: cutPct, save_first_pct: saveFirstPct }),
  });
  if (!r.ok) throw new Error(`simulate ${r.status}`);
  return r.json();
}

export interface ChatReply {
  text: string;
  tool: string;
  used_llm: boolean;
  receipts: { count: number; rows: { d: string; mcc: number | null; label: string; eur: number }[]; sql: string };
  action?: { type: "simulate"; category: string; cut_pct: number } | null;
  provider?: "anthropic" | "gemini" | "template";
}

export async function fetchChat(
  customerId: string,
  today: string,
  message: string,
  saveFirstPct: number,
  history?: { role: string; text: string }[],
): Promise<ChatReply> {
  const r = await fetch(`${BASE}/api/customers/${customerId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ today, message, save_first_pct: saveFirstPct, history: history ?? [] }),
  });
  if (!r.ok) throw new Error(`chat ${r.status}`);
  return r.json();
}

export async function fetchGarden(
  customerId: string,
  today: string,
  saveFirstPct: number,
): Promise<GardenState> {
  const r = await fetch(
    `${BASE}/api/customers/${customerId}/garden?today=${today}&save_first_pct=${saveFirstPct}`,
  );
  if (!r.ok) throw new Error(`garden ${r.status}`);
  return r.json();
}

export interface Benchmarks {
  id: string;
  today: string;
  window: { start: string; end: string };
  age_band: number;
  peers_count: number;
  hbs: { group: string; source: string; unit: string };
  flowers: { flower: string; me: number; peers: number; hbs: number | null }[];
  baskets: { basket: string; me: number; peers: number; hbs: number | null }[];
}

export async function fetchBenchmarks(customerId: string, today: string): Promise<Benchmarks> {
  const r = await fetch(`${BASE}/api/customers/${customerId}/benchmarks?today=${today}`);
  if (!r.ok) throw new Error(`benchmarks ${r.status}`);
  return r.json();
}
