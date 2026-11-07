import { Baker, Order, FlavourItem } from "./types";
import { supabase } from "./supabase";

export const DEFAULT_FLAVOURS: FlavourItem[] = [
  {
    id: "f-1",
    name: "Chocolate Truffle",
    prices: { "0.5 Kg": 450, "1 Kg": 750, "1.5 Kg": 1100, "2 Kg": 1400 },
  },
  {
    id: "f-2",
    name: "Pineapple Fresh",
    prices: { "0.5 Kg": 350, "1 Kg": 600, "1.5 Kg": 900, "2 Kg": 1150 },
  },
  {
    id: "f-3",
    name: "Black Forest",
    prices: { "0.5 Kg": 400, "1 Kg": 700, "1.5 Kg": 1000, "2 Kg": 1300 },
  },
  {
    id: "f-4",
    name: "Red Velvet Cream Cheese",
    prices: { "0.5 Kg": 500, "1 Kg": 850, "1.5 Kg": 1250, "2 Kg": 1600 },
  },
  {
    id: "f-5",
    name: "Rasmalai Tres Leches",
    prices: { "0.5 Kg": 550, "1 Kg": 950, "1.5 Kg": 1400, "2 Kg": 1800 },
  },
  {
    id: "f-6",
    name: "Blueberry Cheesecake",
    prices: { "0.5 Kg": 600, "1 Kg": 1100, "1.5 Kg": 1600, "2 Kg": 2000 },
  },
];

export const SEED_BAKERS: Baker[] = [
  {
    id: "baker-1",
    slug: "sugarbloom",
    name: "SugarBloom Cake Studio",
    tagline: "100% Eggless & Freshly Baked Artisan Cakes",
    phone: "919876543210",
    upi_id: "sugarbloom@okhdfcbank",
    pickup_address: "Shop 4, 12th Main Road, Indiranagar, Bengaluru, Karnataka 560038",
    google_maps_url: "https://maps.google.com/?q=Indiranagar+Bangalore",
    secret_token: "sugarbloom_pos_key",
    default_token_amount: 100,
    pin: "1234",
    max_daily_cakes: 4,
    menu_items: DEFAULT_FLAVOURS,
    created_at: new Date().toISOString(),
  },
  {
    id: "baker-2",
    slug: "chocola",
    name: "The Velvet Oven",
    tagline: "Gourmet Custom Cakes & Cheesecakes",
    phone: "919811223344",
    upi_id: "velvetoven@okaxis",
    pickup_address: "Sector 45, Gurugram, Haryana 122003",
    google_maps_url: "https://maps.google.com/?q=Gurugram+Sector+45",
    secret_token: "velvet_oven_pos_key",
    default_token_amount: 200,
    pin: "1234",
    max_daily_cakes: 4,
    menu_items: DEFAULT_FLAVOURS,
    created_at: new Date().toISOString(),
  },
];

export const SEED_ORDERS: Order[] = [
  {
    id: "order-1",
    order_number: "CK-892",
    baker_id: "baker-1",
    flavour: "Chocolate Truffle",
    weight: "1 Kg",
    is_eggless: true,
    total_price: 750,
    token_amount: 100,
    balance_amount: 650,
    delivery_date: new Date().toISOString().split("T")[0],
    time_slot: "6:30 PM - 7:30 PM",
    fulfilment_type: "pickup",
    cake_message: "Happy Birthday Aarav!",
    customer_name: "Rohan Sharma",
    customer_phone: "919988776655",
    status: "confirmed",
    created_at: new Date().toISOString(),
  },
  {
    id: "order-2",
    order_number: "CK-893",
    baker_id: "baker-1",
    flavour: "Red Velvet Cream Cheese",
    weight: "0.5 Kg",
    is_eggless: true,
    total_price: 550,
    token_amount: 100,
    balance_amount: 450,
    delivery_date: new Date().toISOString().split("T")[0],
    time_slot: "8:00 PM - 9:00 PM",
    fulfilment_type: "delivery",
    delivery_address: "Flat 402, Pine Towers, Indiranagar",
    cake_message: "Happy Anniversary Mom & Dad",
    customer_name: "Priya Menon",
    customer_phone: "919877665544",
    status: "pending_token",
    created_at: new Date().toISOString(),
  },
];

const STORAGE_KEYS = {
  BAKERS: "cakeflow_bakers_v1",
  ORDERS: "cakeflow_orders_v1",
  ACTIVE_BAKER_TOKEN: "cakeflow_active_baker_token",
};

// ============================================================================
// LOCAL STORAGE METHODS (INSTANT 0MS CLIENT FEEDBACK)
// ============================================================================
export function getLocalBakers(): Baker[] {
  if (typeof window === "undefined") return SEED_BAKERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BAKERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BAKERS, JSON.stringify(SEED_BAKERS));
      return SEED_BAKERS;
    }
    const parsed: Baker[] = JSON.parse(raw);
    let updated = false;
    const sanitized = parsed.map((b) => {
      if (!b.menu_items || b.menu_items.length === 0) {
        updated = true;
        return { ...b, menu_items: DEFAULT_FLAVOURS };
      }
      return b;
    });
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.BAKERS, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return SEED_BAKERS;
  }
}

export function saveLocalBaker(baker: Baker): void {
  if (typeof window === "undefined") return;
  const bakers = getLocalBakers();
  const index = bakers.findIndex((b) => b.id === baker.id || b.slug === baker.slug);
  if (index >= 0) {
    bakers[index] = baker;
  } else {
    bakers.unshift(baker);
  }
  localStorage.setItem(STORAGE_KEYS.BAKERS, JSON.stringify(bakers));

  // Background Cloud Sync to Supabase
  syncBakerToCloud(baker).catch(() => {});
}

export function getLocalOrders(): Order[] {
  if (typeof window === "undefined") return SEED_ORDERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(SEED_ORDERS));
      return SEED_ORDERS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_ORDERS;
  }
}

export function saveLocalOrder(order: Order): void {
  if (typeof window === "undefined") return;
  const orders = getLocalOrders();
  const index = orders.findIndex(
    (o) => o.id === order.id || o.order_number === order.order_number
  );
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order);
  }
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

  // Background Cloud Sync to Supabase
  syncOrderToCloud(order).catch(() => {});
}

export function getOrderByNumber(orderNumber: string): Order | undefined {
  const orders = getLocalOrders();
  const normalized = orderNumber.toUpperCase().replace("#", "");
  return orders.find(
    (o) => o.order_number.toUpperCase().replace("#", "") === normalized
  );
}

export function getBakerBySlug(slug: string): Baker | undefined {
  const bakers = getLocalBakers();
  return bakers.find((b) => b.slug.toLowerCase() === slug.toLowerCase());
}

export function getBakerByToken(token: string): Baker | undefined {
  const bakers = getLocalBakers();
  return bakers.find((b) => b.secret_token === token);
}

// ============================================================================
// SUPABASE CLOUD SYNC & FETCH METHODS
// ============================================================================

export async function syncOrderToCloud(order: Order): Promise<boolean> {
  try {
    const payload = {
      id: order.id,
      order_number: order.order_number,
      baker_id: order.baker_id,
      flavour: order.flavour,
      weight: order.weight,
      is_eggless: order.is_eggless,
      total_price: order.total_price,
      token_amount: order.token_amount,
      balance_amount: order.balance_amount,
      delivery_date: order.delivery_date,
      time_slot: order.time_slot,
      fulfilment_type: order.fulfilment_type || "pickup",
      delivery_address: order.delivery_address || null,
      cake_message: order.cake_message || null,
      reference_image: order.reference_image || null,
      reference_images: order.reference_images || [],
      addons: order.addons || [],
      special_notes: order.special_notes || null,
      status: order.status || "pending_token",
      customer_name: order.customer_name || null,
      customer_phone: order.customer_phone || null,
    };

    const { error } = await supabase.from("orders").upsert(payload, {
      onConflict: "id",
    });

    if (error) {
      console.warn("Supabase order sync warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase network error:", err);
    return false;
  }
}

export async function syncBakerToCloud(baker: Baker): Promise<boolean> {
  try {
    const payload = {
      id: baker.id,
      slug: baker.slug,
      name: baker.name,
      tagline: baker.tagline,
      phone: baker.phone,
      upi_id: baker.upi_id,
      pickup_address: baker.pickup_address,
      google_maps_url: baker.google_maps_url || null,
      secret_token: baker.secret_token,
      default_token_amount: baker.default_token_amount || 100,
      pin: baker.pin || "1234",
      max_daily_cakes: baker.max_daily_cakes || 4,
      menu_items: baker.menu_items || DEFAULT_FLAVOURS,
    };

    const { error } = await supabase.from("bakers").upsert(payload, {
      onConflict: "id",
    });

    if (error) {
      console.warn("Supabase baker sync warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Supabase baker sync network error:", err);
    return false;
  }
}

export async function fetchRemoteOrderByNumber(
  orderNumber: string
): Promise<Order | null> {
  try {
    const normalized = orderNumber.toUpperCase().replace("#", "");
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .ilike("order_number", normalized)
      .maybeSingle();

    if (error || !data) return null;

    const order: Order = {
      id: data.id,
      order_number: data.order_number,
      baker_id: data.baker_id,
      flavour: data.flavour,
      weight: data.weight,
      is_eggless: data.is_eggless,
      total_price: data.total_price,
      token_amount: data.token_amount,
      balance_amount: data.balance_amount,
      delivery_date: data.delivery_date,
      time_slot: data.time_slot,
      fulfilment_type: data.fulfilment_type,
      delivery_address: data.delivery_address || undefined,
      cake_message: data.cake_message || undefined,
      reference_image: data.reference_image || undefined,
      reference_images: data.reference_images || undefined,
      addons: data.addons || undefined,
      special_notes: data.special_notes || undefined,
      status: data.status,
      customer_name: data.customer_name || undefined,
      customer_phone: data.customer_phone || undefined,
      created_at: data.created_at,
    };

    // Update local cache
    saveLocalOrder(order);
    return order;
  } catch {
    return null;
  }
}

export async function fetchRemoteOrdersByBaker(bakerId: string): Promise<Order[]> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("baker_id", bakerId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    const orders: Order[] = data.map((d) => ({
      id: d.id,
      order_number: d.order_number,
      baker_id: d.baker_id,
      flavour: d.flavour,
      weight: d.weight,
      is_eggless: d.is_eggless,
      total_price: d.total_price,
      token_amount: d.token_amount,
      balance_amount: d.balance_amount,
      delivery_date: d.delivery_date,
      time_slot: d.time_slot,
      fulfilment_type: d.fulfilment_type,
      delivery_address: d.delivery_address || undefined,
      cake_message: d.cake_message || undefined,
      reference_image: d.reference_image || undefined,
      reference_images: d.reference_images || undefined,
      addons: d.addons || undefined,
      special_notes: d.special_notes || undefined,
      status: d.status,
      customer_name: d.customer_name || undefined,
      customer_phone: d.customer_phone || undefined,
      created_at: d.created_at,
    }));

    // Merge with local storage
    if (typeof window !== "undefined" && orders.length > 0) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    }

    return orders;
  } catch {
    return [];
  }
}

export async function fetchRemoteBaker(bakerId: string): Promise<Baker | null> {
  try {
    const { data, error } = await supabase
      .from("bakers")
      .select("*")
      .eq("id", bakerId)
      .maybeSingle();

    if (error || !data) return null;

    const baker: Baker = {
      id: data.id,
      slug: data.slug,
      name: data.name,
      tagline: data.tagline,
      phone: data.phone,
      upi_id: data.upi_id,
      pickup_address: data.pickup_address,
      google_maps_url: data.google_maps_url || undefined,
      secret_token: data.secret_token,
      default_token_amount: data.default_token_amount || 100,
      pin: data.pin || "1234",
      max_daily_cakes: data.max_daily_cakes || 4,
      menu_items: data.menu_items || DEFAULT_FLAVOURS,
      created_at: data.created_at,
    };

    saveLocalBaker(baker);
    return baker;
  } catch {
    return null;
  }
}
