"use client";

import { useState, useEffect, useRef } from "react";
import { Baker, Order } from "@/lib/types";
import {
  getLocalBakers,
  getBakerByToken,
  getLocalOrders,
  saveLocalOrder,
  fetchRemoteOrdersByBaker,
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
  MapPin,
  Download,
} from "lucide-react";

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
  const [proofOrder, setProofOrder] = useState<Order | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

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
      fetchRemoteOrdersByBaker(currentBaker.id).then((remote) => {
        if (remote && remote.length > 0) setOrders(remote);
      });
    }

    const timer = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(timer);
  }, []);

  const refreshOrders = async (bakerId: string) => {
    const all = getLocalOrders();
    const bakerOrders = all.filter((o) => o.baker_id === bakerId);
    setOrders(bakerOrders);
    const remote = await fetchRemoteOrdersByBaker(bakerId);
    if (remote && remote.length > 0) setOrders(remote);
  };

  // 1. AUTO REFRESH: Poll every 3 seconds + Storage listener (cross-tab sync) + Window focus listener
  useEffect(() => {
    if (!baker) return;

    const syncOrders = async () => {
      const all = getLocalOrders();
      const bakerOrders = all.filter((o) => o.baker_id === baker.id);
      setOrders(bakerOrders);

      // Cloud Sync from Supabase
      const remote = await fetchRemoteOrdersByBaker(baker.id);
      if (remote && remote.length > 0) {
        setOrders(remote);
      }
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
            UNIFIED STICKY APP BAR (TOP ROW + TABS IN ONE SHELL - ZERO COLLISION)
            ======================================================================= */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-200/80">
          <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-zinc-950 tracking-tight flex items-center gap-1.5 truncate">
                <span>{baker.name}</span>
                <span className="w-3.5 h-3.5 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                  ✓
                </span>
              </h1>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                {baker.pickup_address || "Indiranagar, Bengaluru"}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                ₹{todayEarned.toLocaleString("en-IN")}
              </span>

              <button
                type="button"
                onClick={handleStartNewOrder}
                className="h-8 rounded-xl px-3 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Order</span>
              </button>
            </div>
          </div>

          {/* 3-Segment Filter Tabs */}
          <div className="px-4 sm:px-5 pb-2.5">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter("kitchen")}
                className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  statusFilter === "kitchen"
                    ? "bg-white text-zinc-950 shadow-2xs font-bold"
                    : "text-zinc-500 hover:text-zinc-950"
                }`}
              >
                <span>Kitchen</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === "kitchen"
                      ? "bg-zinc-950 text-white"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {kitchenOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("waiting")}
                className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  statusFilter === "waiting"
                    ? "bg-white text-zinc-950 shadow-2xs font-bold"
                    : "text-zinc-500 hover:text-zinc-950"
                }`}
              >
                <span>Waiting</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === "waiting"
                      ? "bg-zinc-950 text-white"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {waitingOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("delivered")}
                className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  statusFilter === "delivered"
                    ? "bg-white text-zinc-950 shadow-2xs font-bold"
                    : "text-zinc-500 hover:text-zinc-950"
                }`}
              >
                <span>Delivered</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === "delivered"
                      ? "bg-zinc-950 text-white"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {deliveredOrders.length}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* =======================================================================
            MAIN ORDER FEED
            ======================================================================= */}
        <main className="flex-1 px-4 sm:px-5 pt-3 pb-24 space-y-3">
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
              // 1. COLLAPSED VIEW FOR DELIVERED ORDERS (CLICK FOR FULL PROOF)
              if (ord.status === "completed") {
                return (
                  <div
                    key={ord.id}
                    onClick={() => setProofOrder(ord)}
                    className="p-3.5 rounded-2xl bg-[#f4f4f5] hover:bg-zinc-200/60 border border-zinc-200/70 flex items-center justify-between gap-3 transition-all active:scale-[0.99] cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-zinc-950 truncate">
                        {ord.weight} {ord.flavour}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 truncate">
                        <span>{getFriendlyDateHeader(ord.delivery_date)}</span>
                        <span>•</span>
                        <span>{ord.time_slot}</span>
                        <span>•</span>
                        <span className="font-bold text-zinc-900">₹{ord.total_price}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                        Delivered ✓
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-400">Proof →</span>
                    </div>
                  </div>
                );
              }

              // 2. COMPACT VIEW FOR WAITING ORDERS (PENDING TOKEN)
              if (ord.status === "pending_token") {
                return (
                  <div
                    key={ord.id}
                    className="p-4 rounded-2xl bg-[#f4f4f5] border border-zinc-200/70 space-y-3 transition-transform active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100 text-xs gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold bg-zinc-100 text-zinc-950 px-2 py-0.5 rounded-md">
                          #{ord.order_number}
                        </span>
                        <span className="font-semibold text-amber-900 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md text-[11px]">
                          ₹{ord.token_amount} advance pending
                        </span>
                      </div>
                      <span className="font-bold text-zinc-900 text-xs shrink-0">
                        ₹{ord.total_price}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-bold text-zinc-950">
                        {ord.weight} {ord.flavour}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Slot: <span className="font-semibold text-zinc-800">{getFriendlyDateHeader(ord.delivery_date)} • {ord.time_slot}</span>
                      </div>
                      <div className="text-xs text-zinc-600 pt-0.5">
                        Customer: <span className="font-bold text-zinc-900">{ord.customer_name || "Name not entered"}</span>
                        {ord.customer_phone && <span className="font-mono text-zinc-700"> • +{ord.customer_phone}</span>}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-zinc-100 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(ord.order_number)}
                        className="h-9 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold border border-zinc-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {copiedLink ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendViaWhatsApp(ord)}
                        className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        <span>Send Link</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // 3. ZERO-COGNITIVE-LOAD GRAY KITCHEN TICKET
              return (
                <div
                  key={ord.id}
                  className="p-4 rounded-2xl bg-[#f4f4f5] border border-zinc-200/70 space-y-3 transition-all"
                >
                  {/* Top Header: Order ID + Fulfilment + Ready Time */}
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 text-xs gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold bg-white text-zinc-950 px-2 py-0.5 rounded-md border border-zinc-200 shadow-2xs">
                        #{ord.order_number}
                      </span>
                      <span className="text-zinc-600 font-medium">
                        {ord.fulfilment_type === "delivery" ? "Delivery" : "Pickup"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-zinc-900 font-bold shrink-0">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{getFriendlyDateHeader(ord.delivery_date)} • {ord.time_slot}</span>
                    </div>
                  </div>

                  {/* Cake Specification & Diet Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-zinc-950 leading-snug">
                      {ord.weight} {ord.flavour}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        ord.is_eggless
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-200 text-zinc-800"
                      }`}
                    >
                      {ord.is_eggless ? "Eggless" : "With Egg"}
                    </span>
                  </div>

                  {/* Piping on Cake (Clean, Plain & High-Contrast) */}
                  {isValidCakeMessage(ord.cake_message) && (
                    <div className="text-xs">
                      <span className="text-zinc-500 font-medium">Piping: </span>
                      <span className="font-bold text-zinc-950">"{ord.cake_message?.trim()}"</span>
                    </div>
                  )}

                  {/* Customer Details: Full Name, Mobile, Address - Just Simple Like That (No extra buttons) */}
                  <div className="pt-2 border-t border-zinc-200/60 text-xs space-y-0.5">
                    <div className="font-bold text-zinc-950 text-sm">
                      {ord.customer_name || "Guest Customer"}
                    </div>
                    {ord.customer_phone && (
                      <div className="font-mono text-zinc-700">
                        <a href={`tel:${ord.customer_phone}`} className="hover:underline">
                          +{ord.customer_phone}
                        </a>
                      </div>
                    )}
                    {ord.fulfilment_type === "delivery" ? (
                      <div className="text-zinc-600 leading-relaxed pt-0.5 break-words">
                        <span className="font-medium text-zinc-800">Address: </span>
                        <span>{ord.delivery_address || "Pending from customer"}</span>
                      </div>
                    ) : (
                      <div className="text-zinc-500 pt-0.5">
                        Fulfilment: Self Pickup
                      </div>
                    )}
                  </div>

                  {/* Reference Design Photos & Addons (if present) */}
                  {(((ord.reference_images && ord.reference_images.length > 0) || ord.reference_image) || (ord.addons && ord.addons.length > 0)) && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none pt-0.5">
                      {(ord.reference_images || (ord.reference_image ? [ord.reference_image] : [])).map((img, i) => (
                        <div
                          key={i}
                          onClick={() => setEnlargedImage(img)}
                          className="cursor-pointer relative w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 border border-zinc-200/80 group"
                        >
                          <img
                            src={img}
                            alt="Ref"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                      {ord.addons?.map((a, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded-lg bg-white text-zinc-800 text-[10px] font-semibold border border-zinc-200/80 shrink-0"
                        >
                          +{a.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bottom Action Bar: Only 1 Single Relevant Button */}
                  <div className="pt-2.5 border-t border-zinc-200/60 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block">
                        To Collect
                      </span>
                      <span className="text-base font-bold text-zinc-950">
                        ₹{ord.balance_amount}
                      </span>
                    </div>

                    <div>
                      {ord.status === "confirmed" && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(ord.id, "baked")}
                          className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <span>Mark as Baked</span>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      )}

                      {ord.status === "baked" && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(ord.id, "completed")}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <span>Handover & Paid</span>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
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
            APPLE / STRIPE MINIMALIST ORDER MODAL (ZERO COGNITIVE LOAD)
            ======================================================================= */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
              {/* Clean Modal Header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <h2 className="text-base font-bold text-zinc-950">
                    {createdOrder ? "Order Link Ready" : "New Order Link"}
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {createdOrder
                      ? "Share with customer to collect token"
                      : "Quick advance booking link"}
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
                      #{createdOrder.order_number} Ready
                    </span>
                    <h3 className="text-lg font-bold text-zinc-950 mt-2">
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
                /* ULTRA-LEAN 3-CARD BUILDER (0 COGNITIVE LOAD) */
                <>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs">
                    {/* CARD 1: THE CAKE SPEC */}
                    <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Cake Specification
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEggless(!isEggless)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                            isEggless
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {isEggless ? "100% Eggless ✓" : "With Egg"}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="text-[10px] text-zinc-400 font-medium block mb-1">
                            Weight
                          </label>
                          <select
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs focus:outline-none border border-zinc-200/60"
                          >
                            {WEIGHT_OPTIONS.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="text-[10px] text-zinc-400 font-medium block mb-1">
                            Flavour
                          </label>
                          <select
                            value={flavour}
                            onChange={(e) => {
                              setFlavour(e.target.value);
                              if (e.target.value !== "Custom / Other") setCustomFlavour("");
                            }}
                            className="w-full px-3 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs focus:outline-none border border-zinc-200/60"
                          >
                            {FLAVOUR_OPTIONS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {flavour === "Custom / Other" && (
                        <input
                          type="text"
                          autoFocus
                          placeholder="Type custom flavour name..."
                          value={customFlavour}
                          onChange={(e) => setCustomFlavour(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                        />
                      )}
                    </div>

                    {/* CARD 2: AGREED PRICE */}
                    <div className="p-3.5 rounded-2xl bg-[#f4f4f5] flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Agreed Total Price
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          ₹{baker.default_token_amount || 100} advance token
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-zinc-200/60">
                        <span className="text-zinc-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          value={customPrice || totalPrice}
                          onChange={(e) => {
                            setCustomPrice(e.target.value);
                            setTotalPrice(Number(e.target.value) || 0);
                          }}
                          className="w-20 text-right font-bold text-base text-zinc-950 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* CARD 3: HANDOVER DATE & TIME */}
                    <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          When Needed
                        </span>
                        <div className="flex items-center gap-1">
                          {["Today", "Tomorrow"].map((label) => {
                            const dStr =
                              label === "Today"
                                ? new Date().toISOString().split("T")[0]
                                : new Date(Date.now() + 86400000)
                                    .toISOString()
                                    .split("T")[0];
                            const isSel = deliveryDate === dStr;
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => setDeliveryDate(dStr)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                  isSel
                                    ? "bg-zinc-950 text-white"
                                    : "bg-white text-zinc-600 hover:text-zinc-950"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={deliveryDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white text-xs font-semibold text-zinc-950 focus:outline-none border border-zinc-200/60"
                        />
                        <select
                          value={timeSlot}
                          onChange={(e) => {
                            setTimeSlot(e.target.value);
                            setCustomTime("");
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white text-xs font-semibold text-zinc-950 focus:outline-none border border-zinc-200/60"
                        >
                          {TIME_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Sticky 1-Tap Action Bar */}
                  <div className="p-4 border-t border-zinc-100 bg-white space-y-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={finalizeOrder}
                      className="w-full py-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm transition-all active:scale-[0.99] shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>⚡ Create & Share on WhatsApp</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* =======================================================================
            OFFICIAL ORDER PROOF / AUDIT RECORD MODAL (FOR DELIVERED ORDERS)
            ======================================================================= */}
        {proofOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-zinc-950">
                      Order Booking Proof
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                      #{proofOrder.order_number}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Official booking & payment audit trail
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProofOrder(null)}
                  className="w-8 h-8 rounded-full bg-[#f4f4f5] hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Audit Sheet */}
              <div id="proof-sheet" className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs">
                {/* Status Banner */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>Delivered & Fully Paid</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700">
                    {getFriendlyDateHeader(proofOrder.delivery_date)}
                  </span>
                </div>

                {/* Cake Specification */}
                <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                    Cake Specification
                  </span>
                  <div className="text-base font-bold text-zinc-950">
                    {proofOrder.weight} {proofOrder.flavour}
                  </div>
                  <div className="text-zinc-600">
                    {proofOrder.is_eggless ? "100% Eggless" : "With Egg"} • Slot: {proofOrder.time_slot}
                  </div>
                </div>

                {/* Customer & Address Details */}
                <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                    Customer Information
                  </span>
                  <div className="font-bold text-zinc-950 text-sm">
                    {proofOrder.customer_name || "Customer"}
                  </div>
                  {proofOrder.customer_phone && (
                    <div className="font-mono text-zinc-600">
                      Phone: +{proofOrder.customer_phone}
                    </div>
                  )}
                  <div className="text-zinc-700 pt-0.5">
                    {proofOrder.fulfilment_type === "delivery"
                      ? `Delivery Address: ${proofOrder.delivery_address || "Provided to baker"}`
                      : `Pickup Address: ${baker.pickup_address}`}
                  </div>
                </div>

                {/* Text on Cake (Piped) */}
                <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                    Text on Cake (Piped)
                  </span>
                  <p className="font-bold text-zinc-950 italic text-sm">
                    {isValidCakeMessage(proofOrder.cake_message)
                      ? `"${proofOrder.cake_message}"`
                      : "None (Plain Top / No text requested)"}
                  </p>
                </div>

                {/* Reference Design Photos */}
                {((proofOrder.reference_images && proofOrder.reference_images.length > 0) || proofOrder.reference_image) && (
                  <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-2">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                      Customer Reference Photos
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      {(proofOrder.reference_images || [proofOrder.reference_image]).map((img, i) => (
                        <img
                          key={i}
                          src={img!}
                          alt="Customer Design"
                          className="w-20 h-20 rounded-xl object-cover bg-white shrink-0 border border-zinc-200"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-on Items */}
                {proofOrder.addons && proofOrder.addons.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                      Party Add-ons
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {proofOrder.addons.map((a, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-white text-zinc-900 font-semibold text-xs border border-zinc-200/50"
                        >
                          {a.name} (+₹{a.price})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial Ledger */}
                <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                    Payment Ledger Proof
                  </span>
                  <div className="flex justify-between text-zinc-600">
                    <span>Total Cake & Order Value:</span>
                    <span className="font-bold text-zinc-950">₹{proofOrder.total_price}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800">
                    <span>Token Advance (Paid via UPI):</span>
                    <span className="font-bold">₹{proofOrder.token_amount} ✓</span>
                  </div>
                  <div className="flex justify-between text-zinc-950 border-t border-zinc-200 pt-1 font-bold">
                    <span>Balance Settled at Handover:</span>
                    <span>₹{proofOrder.balance_amount} ✓</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-zinc-100 bg-white space-y-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download / Print Proof PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProofOrder(null)}
                  className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-950"
                >
                  Close Proof
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Image Enlargement Modal */}
        {enlargedImage && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setEnlargedImage(null)}
          >
            <div className="relative max-w-sm w-full">
              <button
                type="button"
                onClick={() => setEnlargedImage(null)}
                className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
              <img
                src={enlargedImage}
                alt="Enlarged Reference"
                className="w-full rounded-2xl max-h-[80vh] object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
