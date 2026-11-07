export interface FlavourItem {
  id: string;
  name: string;
  prices: {
    [weight: string]: number; // e.g. { "0.5 Kg": 450, "1 Kg": 750, "1.5 Kg": 1100, "2 Kg": 1400 }
  };
}

export interface Baker {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  phone: string; // WhatsApp number with country code, e.g. 919876543210
  upi_id: string; // e.g. baker@okhdfcbank
  pickup_address: string;
  google_maps_url?: string;
  secret_token: string;
  default_token_amount: number;
  pin?: string; // 4-digit PIN for quick kitchen POS lock screen (default '1234')
  max_daily_cakes?: number; // Daily oven/time capacity limit (default 4)
  menu_items?: FlavourItem[];
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string; // e.g. #CK-101
  baker_id: string;
  baker?: Baker;
  flavour: string;
  weight: string;
  is_eggless: boolean;
  total_price: number;
  token_amount: number;
  balance_amount: number;
  delivery_date: string; // YYYY-MM-DD
  time_slot: string; // e.g. "6:00 PM - 7:00 PM"
  fulfilment_type: 'pickup' | 'delivery';
  delivery_address?: string;
  cake_message?: string;
  reference_image?: string;
  reference_images?: string[];
  addons?: Array<{ id: string; name: string; price: number }>;
  special_notes?: string;
  customer_name?: string;
  customer_phone?: string;
  status: 'pending_token' | 'confirmed' | 'baked' | 'completed' | 'cancelled';
  created_at: string;
}

