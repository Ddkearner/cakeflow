"use client";

import { useState, useEffect, useRef } from "react";
import { Baker, Order } from "@/lib/types";
import {
  getLocalBakers,
  getBakerByToken,
  getLocalOrders,
  saveLocalOrder,
} from "@/lib/store";
import {
  generateOrderNumber,
  formatCurrency,
  buildWhatsAppLink,
} from "@/lib/utils";
import {
  X,
  ArrowLeft,
  Send,
  Copy,
  Check,
  Plus,
  RotateCw,
  Clock,
  Phone,
} from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { MovingBorderButton } from "@/components/ui/moving-border";

const WEIGHT_OPTIONS = ["0.5 Kg", "1 Kg", "1.5 Kg", "2 Kg"];
const FLAVOUR_OPTIONS = [
  "Chocolate Truffle",
  "Pineapple Fresh",
  "Black Forest",
  "Red Velvet",
  "Rasmalai",
  "Custom / Other",
];
const PRICE_PRESETS = [550, 700, 850, 1000];
const TIME_SLOTS = [
  "11:00 AM - 1:00 PM",
  "2:00 PM - 4:00 PM",
  "6:00 PM - 7:00 PM",
  "7:00 PM - 8:00 PM",
  "8:00 PM - 9:00 PM",
];

const isValidCakeMessage = (msg?: string) => {
  if (!msg) return false;
  const t = msg.trim().toLowerCase();
  return (
    t.length > 0 &&
    t !== "none" &&
    t !== "no" &&
    t !== "nil" &&
    t !== "n/a" &&
    t !== "null"
  );
};

export default function BakerPOSPage() {
  const [baker, setBaker] = useState<Baker | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Clean 3-Mode Filter: "kitchen" (Active to-bake & ready) vs "waiting" vs "delivered"
  const [statusFilter, setStatusFilter] = useState<"kitchen" | "waiting" | "delivered">("kitchen");

  // Order Builder Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Quick Order Preset Fields
  const [weight, setWeight] = useState("1 Kg");
  const [flavour, setFlavour] = useState("Chocolate Truffle");
  const [customFlavour, setCustomFlavour] = useState("");
  const [isEggless, setIsEggless] = useState(true);
  const [totalPrice, setTotalPrice] = useState<number>(700);
  const [customPrice, setCustomPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [timeSlot, setTimeSlot] = useState("6:00 PM - 7:00 PM");
  const [customTime, setCustomTime] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    let currentToken = urlToken;
    if (urlToken) {
      localStorage.setItem("cakeflow_active_token", urlToken);
    } else {
      currentToken = localStorage.getItem("cakeflow_active_token");
    }

    const allBakers = getLocalBakers();
    let currentBaker: Baker | undefined;

    if (currentToken) {
      currentBaker = getBakerByToken(currentToken);
    }

    if (!currentBaker && allBakers.length > 0) {
      currentBaker = allBakers[0];
    }

    if (currentBaker) {
      setBaker(currentBaker);
      const all = getLocalOrders();
      setOrders(all.filter((o) => o.baker_id === currentBaker.id));
    }

    const timer = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(timer);
  }, []);

  const refreshOrders = (bakerId: string) => {
    const all = getLocalOrders();
    const bakerOrders = all.filter((o) => o.baker_id === bakerId);
    setOrders(bakerOrders);
  };

  // 1. AUTO REFRESH: Poll every 3 seconds + Storage listener (cross-tab sync) + Window focus listener
  useEffect(() => {
    if (!baker) return;

    const syncOrders = () => {
      const all = getLocalOrders();
      const bakerOrders = all.filter((o) => o.baker_id === baker.id);
      setOrders((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(bakerOrders)) {
          return bakerOrders;
        }
        return prev;
      });
    };

    const pollInterval = setInterval(syncOrders, 3000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "cakeflow_orders" || !e.key) {
        syncOrders();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const handleFocus = () => {
      syncOrders();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [baker]);

  const handleStartNewOrder = () => {
    setWeight("1 Kg");
    setFlavour("Chocolate Truffle");
    setCustomFlavour("");
    setIsEggless(true);
    setTotalPrice(700);
    setCustomPrice("");
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setTimeSlot("6:00 PM - 7:00 PM");
    setCustomTime("");
    setCreatedOrder(null);
    setIsCreating(true);
  };

  const handleCloseWizard = () => {
    setIsCreating(false);
    setCreatedOrder(null);
  };

  const finalizeOrder = () => {
    if (!baker) return;
    const finalSlot = customTime.trim() ? customTime.trim() : timeSlot;
    const finalFlavour =
      flavour === "Custom / Other"
        ? (customFlavour.trim() || "Custom Cake")
        : flavour;
    const finalPrice = customPrice ? Number(customPrice) : totalPrice;
    const token = baker.default_token_amount || 100;
    const balance = Math.max(0, finalPrice - token);
    const orderNumber = generateOrderNumber();

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      order_number: orderNumber,
      baker_id: baker.id,
      baker,
      flavour: finalFlavour,
      weight,
      is_eggless: isEggless,
      total_price: finalPrice,
      token_amount: token,
      balance_amount: balance,
      delivery_date: deliveryDate,
      time_slot: finalSlot,
      fulfilment_type: "pickup",
      status: "pending_token",
      created_at: new Date().toISOString(),
    };

    saveLocalOrder(newOrder);
    setCreatedOrder(newOrder);
    refreshOrders(baker.id);
  };

  const updateOrderStatus = (orderId: string, newStatus: Order["status"]) => {
    const all = getLocalOrders();
    const target = all.find((o) => o.id === orderId);
    if (target) {
      target.status = newStatus;
      saveLocalOrder(target);
      if (baker) refreshOrders(baker.id);
    }
  };

  const getCustomerLink = (orderNum: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/o/${orderNum}`;
  };

  const handleSendViaWhatsApp = (order: Order) => {
    const link = getCustomerLink(order.order_number);
    const message = `Please confirm your cake order details and advance token (₹${order.token_amount}) here:\n\n${link}\n\n${order.weight} ${order.flavour} (${order.is_eggless ? "100% Eggless" : "With Egg"})\nTime: ${order.time_slot}\nBalance Due at Pickup: ₹${order.balance_amount}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleCopyLink = (orderNum: string) => {
    const link = getCustomerLink(orderNum);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!baker) return null;

  // Filter calculations
  const kitchenOrders = orders.filter((o) => o.status === "confirmed" || o.status === "baked");
  const waitingOrders = orders.filter((o) => o.status === "pending_token");
  const deliveredOrders = orders.filter((o) => o.status === "completed");

  const displayedOrders =
    statusFilter === "kitchen"
      ? kitchenOrders
      : statusFilter === "waiting"
      ? waitingOrders
      : deliveredOrders;

  const todayEarned = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total_price, 0);

  const getFriendlyDateHeader = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === tomorrow) return "Tomorrow";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 selection:bg-zinc-200 relative overflow-x-hidden">
      <div className="max-w-xl mx-auto min-h-screen flex flex-col relative">
        {/* =======================================================================
            COMPACT HIGH-UTILITY TOP APP BAR (SINGLE ROW - ZERO SCREEN WASTE)
            ======================================================================= */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-100 px-5 py-3.5 flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <h1 className="text-base font-bold text-zinc-950 tracking-tight flex items-center gap-1.5 truncate">
              <span>{baker.name}</span>
              <span className="w-3.5 h-3.5 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                ✓
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {baker.pickup_address || "Indiranagar, Bengaluru"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full">
              ₹{todayEarned.toLocaleString("en-IN")}
            </span>

            <RainbowButton
              onClick={handleStartNewOrder}
              size="sm"
              className="h-8 rounded-xl px-3 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Order</span>
            </RainbowButton>
          </div>
        </header>

        {/* =======================================================================
            STREAMLINED 3-SEGMENT KITCHEN FILTER BAR (ZERO SCROLL, ZERO FATIGUE)
            ======================================================================= */}
        <div className="px-5 pt-3 pb-2 sticky top-[57px] z-10 bg-white border-b border-zinc-100/60">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-zinc-100 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter("kitchen")}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                statusFilter === "kitchen"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-950"
              }`}
            >
              <span>Kitchen</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === "kitchen" ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {kitchenOrders.length}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("waiting")}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                statusFilter === "waiting"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-950"
              }`}
            >
              <span>Waiting</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === "waiting" ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {waitingOrders.length}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter("delivered")}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                statusFilter === "delivered"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-950"
              }`}
            >
              <span>Delivered</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === "delivered" ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {deliveredOrders.length}
              </span>
            </button>
          </div>
        </div>

        {/* =======================================================================
            FLAT KITCHEN TICKETS LIST (ZERO NESTED BOXES)
            ======================================================================= */}
        <main className="flex-1 px-5 pt-3 pb-24 space-y-3">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="p-4 rounded-2xl bg-[#f4f4f5] animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <div className="h-5 w-40 bg-zinc-200 rounded-md" />
                    <div className="h-5 w-16 bg-zinc-200 rounded-full" />
                  </div>
                  <div className="h-3 w-48 bg-zinc-200 rounded" />
                  <div className="h-10 bg-white rounded-xl" />
                </div>
              ))}
            </div>
          ) : displayedOrders.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <p className="text-sm font-bold text-zinc-950">
                {statusFilter === "kitchen"
                  ? "Kitchen is all caught up!"
                  : statusFilter === "waiting"
                  ? "No waiting orders"
                  : statusFilter === "delivered"
                  ? "No delivered orders yet"
                  : "No orders yet"}
              </p>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                {statusFilter === "kitchen"
                  ? "New confirmed customer orders will appear here automatically."
                  : "Tap 'New Order' at the top to create a booking link."}
              </p>
            </div>
          ) : (
            displayedOrders.map((ord) => {
              // 1. COLLAPSED VIEW FOR DELIVERED ORDERS
              if (ord.status === "completed") {
                return (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100/50 flex items-center justify-between gap-3 transition-transform active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-zinc-950 truncate">
                        {ord.weight} {ord.flavour}
                      </div>
                      <div className="text-xs text-emerald-800/80 mt-0.5 flex items-center gap-1.5 truncate">
                        <span>{getFriendlyDateHeader(ord.delivery_date)}</span>
                        <span>•</span>
                        <span>{ord.time_slot}</span>
                        <span>•</span>
                        <span className="font-semibold text-emerald-950">₹{ord.total_price}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                      Delivered ✓
                    </span>
                  </div>
                );
              }

              // 2. COMPACT COLLAPSED VIEW FOR WAITING ORDERS (PENDING TOKEN)
              if (ord.status === "pending_token") {
                return (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-2xl bg-[#f4f4f5] flex items-center justify-between gap-3 transition-transform active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-zinc-950 truncate">
                        #{ord.order_number} • {ord.weight} {ord.flavour}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                        <span>{getFriendlyDateHeader(ord.delivery_date)}</span>
                        <span>•</span>
                        <span>{ord.time_slot}</span>
                        <span>•</span>
                        <span className="font-semibold text-zinc-900">₹{ord.total_price}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSendViaWhatsApp(ord)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-600 transition-colors active:scale-95 flex items-center gap-1.5 shrink-0 text-xs font-semibold shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 fill-emerald-600" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      <span>Share</span>
                    </button>
                  </div>
                );
              }

              // 3. FLAT CHEF TICKET FOR ACTIVE ORDERS (CONFIRMED / BAKING OR BAKED / READY)
              return (
                <div
                  key={ord.id}
                  className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3 transition-all active:scale-[0.99]"
                >
                  {/* Top Line: Cake & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold text-zinc-950 truncate">
                        {ord.weight} {ord.flavour}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                        <span className="font-semibold text-zinc-800">
                          {ord.is_eggless ? "100% Eggless" : "With Egg"}
                        </span>
                        <span>•</span>
                        <span>{getFriendlyDateHeader(ord.delivery_date)}</span>
                        <span>•</span>
                        <span>{ord.time_slot}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                        ord.status === "confirmed"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      {ord.status === "confirmed" ? "In Oven / Baking" : "Ready for Handover"}
                    </span>
                  </div>

                  {/* Customer Line (Simple & Flat) */}
                  {(ord.customer_name || ord.delivery_address) && (
                    <div className="flex items-center justify-between text-xs text-zinc-700 pt-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold text-zinc-950">
                          {ord.customer_name || "Customer"}
                        </span>
                        {ord.customer_phone && (
                          <a
                            href={`tel:${ord.customer_phone}`}
                            className="text-zinc-500 font-mono text-[11px] hover:text-zinc-950 underline"
                          >
                            +{ord.customer_phone}
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-500 shrink-0">
                        {ord.fulfilment_type === "delivery"
                          ? `Delivery: ${ord.delivery_address || "Address provided"}`
                          : "Self Pickup"}
                      </span>
                    </div>
                  )}

                  {/* Text on Cake (ONLY IF CUSTOMER ACTUALLY WROTE ONE) */}
                  {isValidCakeMessage(ord.cake_message) && (
                    <div className="px-3 py-2 rounded-xl bg-white text-xs border border-zinc-200/60 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider shrink-0">
                        Piped:
                      </span>
                      <span className="font-bold text-zinc-950 truncate">
                        "{ord.cake_message}"
                      </span>
                    </div>
                  )}

                  {/* Extra Party Addons (ONLY IF EXISTS) */}
                  {ord.addons && ord.addons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {ord.addons.map((a, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 rounded-md bg-white text-zinc-800 text-[11px] font-semibold border border-zinc-200/50"
                        >
                          + {a.name} (₹{a.price})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reference Design Photos (ONLY IF EXISTS) */}
                  {((ord.reference_images && ord.reference_images.length > 0) || ord.reference_image) && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-0.5">
                      {(ord.reference_images || [ord.reference_image]).map((img, i) => (
                        <img
                          key={i}
                          src={img!}
                          alt="Design"
                          className="w-16 h-16 rounded-xl object-cover bg-white shrink-0 border border-zinc-200/60"
                        />
                      ))}
                    </div>
                  )}

                  {/* Special Note (ONLY IF EXISTS AND NOT NONE) */}
                  {ord.special_notes && isValidCakeMessage(ord.special_notes) && (
                    <p className="text-xs text-zinc-500 italic bg-white/70 p-2 rounded-lg">
                      Note: "{ord.special_notes}"
                    </p>
                  )}

                  {/* Financial Ledger & 1 Clear Action Button */}
                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <div className="text-zinc-400 text-[10px]">Handover Balance</div>
                      <div className="font-bold text-zinc-950 text-base">₹{ord.balance_amount}</div>
                    </div>

                    <div className="flex-1 max-w-[200px] flex justify-end">
                      {ord.status === "confirmed" && (
                        <MovingBorderButton
                          onClick={() => updateOrderStatus(ord.id, "baked")}
                          containerClassName="w-full h-10"
                          className="bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-50"
                        >
                          Mark as Baked ✓
                        </MovingBorderButton>
                      )}

                      {ord.status === "baked" && (
                        <button
                          onClick={() => updateOrderStatus(ord.id, "completed")}
                          className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95 shadow-xs"
                        >
                          Collected & Paid ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>

        {/* =======================================================================
            FAST 1-SCREEN ORDER BUILDER (ZERO WIZARD FRICTION)
            ======================================================================= */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <h2 className="text-base font-bold text-zinc-950">
                    {createdOrder ? "Order Link Ready" : "New Order Link"}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    {createdOrder
                      ? "Share with customer to collect token"
                      : "Create custom booking link in seconds"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseWizard}
                  className="w-8 h-8 rounded-full bg-[#f4f4f5] hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createdOrder ? (
                /* SUCCESS VIEW */
                <div className="p-6 space-y-4 text-center my-auto animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-mono font-bold">
                      #{createdOrder.order_number}
                    </span>
                    <h3 className="text-lg font-bold text-zinc-950 mt-1.5">
                      {createdOrder.weight} {createdOrder.flavour}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {createdOrder.is_eggless ? "100% Eggless" : "With Egg"} • Total ₹{createdOrder.total_price} • Advance ₹{createdOrder.token_amount}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => handleSendViaWhatsApp(createdOrder)}
                      className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to Customer via WhatsApp</span>
                    </button>
                    <button
                      onClick={() => handleCopyLink(createdOrder.order_number)}
                      className="w-full py-3 rounded-2xl bg-[#f4f4f5] hover:bg-zinc-200 text-zinc-900 font-semibold text-xs flex items-center justify-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedLink ? "Link Copied!" : "Copy Booking Link"}</span>
                    </button>
                    <button
                      onClick={handleCloseWizard}
                      className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-950"
                    >
                      Back to Kitchen
                    </button>
                  </div>
                </div>
              ) : (
                /* SINGLE-SCREEN ORDER BUILDER */
                <>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
                    {/* 1. Preference Toggle */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#f4f4f5]">
                      <button
                        type="button"
                        onClick={() => setIsEggless(true)}
                        className={`py-2 rounded-lg font-semibold transition-all ${
                          isEggless
                            ? "bg-white text-zinc-950 shadow-xs"
                            : "text-zinc-600 hover:text-zinc-950"
                        }`}
                      >
                        100% Eggless
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEggless(false)}
                        className={`py-2 rounded-lg font-semibold transition-all ${
                          !isEggless
                            ? "bg-white text-zinc-950 shadow-xs"
                            : "text-zinc-600 hover:text-zinc-950"
                        }`}
                      >
                        With Egg
                      </button>
                    </div>

                    {/* 2. Weight */}
                    <div>
                      <label className="font-bold text-zinc-950 block mb-1.5">
                        Weight
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {WEIGHT_OPTIONS.map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setWeight(w)}
                            className={`py-2 rounded-xl font-bold transition-all ${
                              weight === w
                                ? "bg-zinc-950 text-white shadow-xs"
                                : "bg-[#f4f4f5] text-zinc-800 hover:bg-zinc-200"
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Flavour */}
                    <div>
                      <label className="font-bold text-zinc-950 block mb-1.5">
                        Flavour
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {FLAVOUR_OPTIONS.map((f) => {
                          const isSelected = flavour === f;
                          return (
                            <button
                              key={f}
                              type="button"
                              onClick={() => {
                                setFlavour(f);
                                if (f !== "Custom / Other") setCustomFlavour("");
                              }}
                              className={`py-2.5 px-3 rounded-xl font-semibold text-left truncate transition-all ${
                                isSelected
                                  ? "bg-zinc-950 text-white shadow-xs"
                                  : "bg-[#f4f4f5] text-zinc-800 hover:bg-zinc-200"
                              }`}
                            >
                              {f}
                            </button>
                          );
                        })}
                      </div>
                      {flavour === "Custom / Other" && (
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type custom flavour (e.g. Lotus Biscoff)..."
                          value={customFlavour}
                          onChange={(e) => setCustomFlavour(e.target.value)}
                          className="w-full mt-2 px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-medium focus:outline-none"
                        />
                      )}
                    </div>

                    {/* 4. Total Price */}
                    <div>
                      <label className="font-bold text-zinc-950 block mb-1.5">
                        Total Price
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {PRICE_PRESETS.map((p) => {
                          const isSelected = !customPrice && totalPrice === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setTotalPrice(p);
                                setCustomPrice("");
                              }}
                              className={`py-2 rounded-xl font-bold transition-all ${
                                isSelected
                                  ? "bg-zinc-950 text-white shadow-xs"
                                  : "bg-[#f4f4f5] text-zinc-800 hover:bg-zinc-200"
                              }`}
                            >
                              ₹{p}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="number"
                        placeholder="Or enter custom amount (e.g. 1200)"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="w-full mt-2 px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-medium focus:outline-none"
                      />
                    </div>

                    {/* 5. Date & Time */}
                    <div>
                      <label className="font-bold text-zinc-950 block mb-1.5">
                        When Needed
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {(() => {
                          const today = new Date().toISOString().split("T")[0];
                          const tomorrow = new Date(Date.now() + 86400000)
                            .toISOString()
                            .split("T")[0];
                          const dayAfter = new Date(Date.now() + 86400000 * 2)
                            .toISOString()
                            .split("T")[0];
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => setDeliveryDate(today)}
                                className={`py-2 rounded-xl font-semibold ${
                                  deliveryDate === today
                                    ? "bg-zinc-950 text-white"
                                    : "bg-[#f4f4f5] text-zinc-700"
                                }`}
                              >
                                Today
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeliveryDate(tomorrow)}
                                className={`py-2 rounded-xl font-semibold ${
                                  deliveryDate === tomorrow
                                    ? "bg-zinc-950 text-white"
                                    : "bg-[#f4f4f5] text-zinc-700"
                                }`}
                              >
                                Tomorrow
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeliveryDate(dayAfter)}
                                className={`py-2 rounded-xl font-semibold ${
                                  deliveryDate === dayAfter
                                    ? "bg-zinc-950 text-white"
                                    : "bg-[#f4f4f5] text-zinc-700"
                                }`}
                              >
                                Day After
                              </button>
                            </>
                          );
                        })()}
                      </div>
                      <input
                        type="date"
                        value={deliveryDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full mb-2 px-3 py-2 rounded-xl bg-[#f4f4f5] text-xs text-zinc-950 font-medium focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {TIME_SLOTS.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setTimeSlot(slot);
                              setCustomTime("");
                            }}
                            className={`py-2 px-2 rounded-xl text-[11px] font-semibold text-center truncate ${
                              timeSlot === slot && !customTime
                                ? "bg-zinc-950 text-white"
                                : "bg-[#f4f4f5] text-zinc-700 hover:bg-zinc-200"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Or custom time (e.g. 8:30 PM)"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 placeholder-zinc-400 focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Sticky Modal Bottom Action Bar */}
                  <div className="p-4 border-t border-zinc-100 bg-white space-y-2 shrink-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium truncate max-w-[240px]">
                        {weight} • {flavour === "Custom / Other" ? customFlavour || "Custom" : flavour} ({isEggless ? "Eggless" : "Egg"})
                      </span>
                      <span className="font-bold text-zinc-950 text-sm">
                        ₹{customPrice ? Number(customPrice) : totalPrice}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={finalizeOrder}
                      className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs transition-all active:scale-[0.99] shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>⚡ Generate Booking Link</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
