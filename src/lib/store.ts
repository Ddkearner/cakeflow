import { Baker, Order } from "./types";

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

// Client-side helper functions for LocalStorage persistence
export function getLocalBakers(): Baker[] {
  if (typeof window === "undefined") return SEED_BAKERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BAKERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BAKERS, JSON.stringify(SEED_BAKERS));
      return SEED_BAKERS;
    }
    return JSON.parse(raw);
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
  const index = orders.findIndex((o) => o.id === order.id || o.order_number === order.order_number);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order);
  }
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
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

