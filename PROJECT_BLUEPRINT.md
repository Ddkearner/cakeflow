# 🍰 CakeFlow: Zero-Cognitive-Load Cake Booking & Token OS

> **Core Philosophy:** Jo cheez pehle se pata hai use dobara mat poocho, jahan Tap se kaam chale wahan Type mat karwao, aur non-essential cheezon ko chhupa do.

---

## 1. The Core Vision & Problem Statement

### The Problem
* **Home Bakers & Cake Studios (3-15 orders/day):** Shaam ko WhatsApp chats ka dimaag ka dahi ho jata hai. GPay screenshots dhundna, spelling mistakes pe ladai hona, aur customers ka aakhri time "ghost" karke cancel kar dena jisse cake aur raw materials waste ho jate hain.
* **Customers:** WhatsApp pe lamba form nahi bharna chahte. Unhe bas apna cake time pe, sahi naam ke sath aur bina kisi jhanjhat ke chahiye.

### The Solution: 3-Way Zero-Friction Engine
1. **Super Admin (You):** 1-Click Baker Onboarding & Global control.
2. **Baker (Mobile PWA POS):** Zero-login, 10-second link generation via phone home screen.
3. **Customer (Mobile Web Checkout):** 1-Thumb, pre-filled order lock + ₹100 UPI advance token.

---

## 2. Tech Stack (₹0 Capital / 100% Free Tier)

| Layer | Technology | Free Tier Capacity | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js 14/15 (App Router, TypeScript) | Unlimited | Unified fullstack API + Frontend |
| **Hosting** | Vercel | Unlimited Free | Lightning-fast Edge deployment |
| **Database** | Supabase (PostgreSQL) | 500 MB (50,000+ orders) | Relational multi-tenant data |
| **Styling** | Tailwind CSS + Lucide Icons | Free | Mobile-first, responsive, craft-focused |
| **UI Components** | Inspired by Magic UI / 21st.dev | Free | Micro-interactions, spring animations, quiet sleek chrome |
| **Auth for Baker** | Magic URL + LocalStorage Token | Free | Zero passwords, zero OTP, zero session timeouts |
| **Communication** | `wa.me` Native Protocol | 100% Free & Official | Zero WhatsApp bans, no running servers |
| **Payments** | Direct UPI Intent Protocol (`upi://pay`) | Free | Direct to Baker's Bank account |

---

## 3. UI/UX & Design Philosophy (Unslop + Magic UI / 21st.dev)

* **Quiet Chrome:** No loud neon purple gradients or glowing borders. Neutral slate/zinc foundation with a warm pastry/bakery accent (e.g. rich amber/caramel or deep chocolate slate).
* **Zero Cognitive Load:**
  * Only **ONE mandatory input field** for the customer: *"Message on Cake"*.
  * Everything else is preset chips/buttons (0.5kg, 1kg, 2kg, Eggless).
  * Collapsed progressive drawers for secondary options (`+ Add candles or special notes`).
* **High-Craft Details:**
  * Smooth spring layout shifts.
  * Haptic-style feedback on buttons.
  * High-clarity typography with solid contrast (inter/geist-sans).

---

## 4. Multi-Tenant Architecture & Data Model

### Table 1: `bakers` (Store Profiles)
```sql
CREATE TABLE bakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,            -- e.g. 'sugarbloom'
  name TEXT NOT NULL,                   -- e.g. 'SugarBloom Cake Studio'
  tagline TEXT DEFAULT '100% Eggless & Fresh',
  phone TEXT NOT NULL,                  -- WhatsApp phone number (e.g. '919876543210')
  upi_id TEXT NOT NULL,                 -- e.g. 'baker@okhdfcbank'
  pickup_address TEXT NOT NULL,         -- Physical store location
  google_maps_url TEXT,
  secret_token TEXT UNIQUE NOT NULL,    -- Magic token for Baker PWA access
  default_token_amount INT DEFAULT 100, -- Advance booking token amount
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### Table 2: `orders` (Transactions & Slips)
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,    -- Short human readable ID: e.g. '#CK-104'
  baker_id UUID REFERENCES bakers(id) ON DELETE CASCADE,
  flavour TEXT NOT NULL,                -- e.g. 'Chocolate Truffle'
  weight TEXT NOT NULL,                 -- e.g. '1 Kg'
  is_eggless BOOLEAN DEFAULT true,
  total_price INT NOT NULL,             -- e.g. 700 (Locked by Baker)
  token_amount INT NOT NULL,            -- e.g. 100
  balance_amount INT NOT NULL,          -- e.g. 600 (Auto-calculated: total - token)
  delivery_date DATE NOT NULL,
  time_slot TEXT NOT NULL,              -- e.g. '6:00 PM - 7:00 PM'
  fulfilment_type TEXT DEFAULT 'pickup',-- 'pickup' OR 'delivery'
  delivery_address TEXT,
  cake_message TEXT,                    -- e.g. 'Happy Birthday Aarav'
  special_notes TEXT,
  status TEXT DEFAULT 'pending_token',  -- 'pending_token', 'confirmed', 'baked', 'completed'
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

---

## 5. Screen-by-Screen Flow & Interactions

```
+-------------------------------------------------------------------------------+
|                               1. SUPER ADMIN                                  |
|   /admin -> Create new Baker (Name, Slug, Phone, UPI) -> Generates Magic URL  |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                           2. BAKER PWA POS                                    |
|   /baker?token=XYZ -> Auto-saved to LocalStorage -> "Add to Home Screen"      |
|   - Tab 1: ⚡ 3-Tap Quick Link Generator (Flavour, Weight, Price)            |
|            -> Taps "Send to WhatsApp" -> Opens wa.me with prefilled link      |
|   - Tab 2: 📋 Kitchen Board (Sorted by time: Today's pending & ready cakes)   |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                         3. CUSTOMER CHECKOUT                                  |
|   /o/[orderNumber] -> Edge-loaded in <500ms                                   |
|   - Pre-filled summary card (Flavour, Weight, Price, Time)                     |
|   - Single text field: "Message on Cake"                                      |
|   - Toggle: [ Self Pickup ] or [ Home Delivery ]                              |
|   - CTA: [ 🟢 Pay ₹100 Advance Token via UPI ]                                |
+-------------------------------------------------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       4. UPI HANDOFF & RECEIPT                                |
|   Triggers: upi://pay?pa=baker@upi&am=100&pn=BakerName                        |
|   Customer lands on Verified Voucher:                                         |
|   - Order Slip #CK-104 (Shows Bal ₹600 Due at Pickup)                         |
|   - CTA: [ 📲 Send Order Slip to Baker on WhatsApp ]                          |
+-------------------------------------------------------------------------------+
```

---

## 6. Edge Cases & Safeguards Locked

1. **Anti-Scam Price Tampering:** The customer **CANNOT** edit the cake price. The price is strictly set and locked by the Baker during link creation.
2. **Double Data-Entry Elimination:** Baker selects flavour & weight in 3 taps; customer sees it pre-filled and only types the cake message.
3. **No App Store / No Security Blockers:** Baker installs via PWA (manifest + service worker) with 1 click; no Play Store warnings or untrusted APK alerts.
4. **Zero Number Bans:** No automated scraping bots or unofficial WhatsApp web scripts. 100% browser-based `wa.me` links executed on user tap.
5. **Spelling Dispute Armor:** The order slip contains the exact text the customer typed with their own hands. Zero "he-said-she-said" arguments.

---

## 7. Next Milestones for Execution

1. **Step 1:** Initialize Next.js project with Tailwind CSS, TypeScript, and Lucide icons.
2. **Step 2:** Setup Supabase client & SQL migrations for `bakers` and `orders`.
3. **Step 3:** Build Customer 1-Thumb checkout page (`/o/[id]`) with UPI intent handoff.
4. **Step 4:** Build Baker PWA POS page (`/baker`) with 3-tap link generator and LocalStorage persistence.
5. **Step 5:** Build Admin Panel (`/admin`) for rapid baker onboarding.

