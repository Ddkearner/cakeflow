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
  "1:00 PM - 2:00 PM",
  "4:00 PM - 5:00 PM",
  "6:00 PM - 7:00 PM",
  "7:00 PM - 8:00 PM",
  "8:00 PM - 9:00 PM",
];

export default function BakerPOSPage() {
  const [baker, setBaker] = useState<Baker | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_token" | "confirmed" | "baked" | "completed">("all");

  // Smooth Sheet & Wizard State
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Wizard Field State
  const [weight, setWeight] = useState("1 Kg");
  const [flavour, setFlavour] = useState("Chocolate Truffle");
  const [customFlavour, setCustomFlavour] = useState("");
  const [isEggless, setIsEggless] = useState(true);
  const [totalPrice, setTotalPrice] = useState<number>(700);
  const [customPrice, setCustomPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [timeSlot, setTimeSlot] = useState("6:00 PM - 7:00 PM");
  const [customTime, setCustomTime] = useState("");

  // Swipe to Refresh (Pull down) State
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

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

    // Poll every 3s
    const pollInterval = setInterval(syncOrders, 3000);

    // Cross-tab instant update (e.g. when customer pays token on /o/[orderNumber])
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "cakeflow_orders" || !e.key) {
        syncOrders();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Update immediately when baker comes back to this tab
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

  // 2. SWIPE / PULL TO REFRESH HANDLERS (Mobile + Touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isCreating) return;
    const scrollPos = window.scrollY || document.documentElement.scrollTop;
    if (scrollPos > 10) return;
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || isCreating) return;
    const scrollPos = window.scrollY || document.documentElement.scrollTop;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0 && scrollPos <= 10) {
      // Natural logarithmic rubber-band resistance
      const pull = Math.min(85, diff * 0.45);
      setPullY(pull);
    } else {
      setPullY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullY >= 48) {
      setIsRefreshing(true);
      setPullY(52); // Keep indicator held while syncing
      if (baker) {
        const all = getLocalOrders();
        setOrders(all.filter((o) => o.baker_id === baker.id));
      }
      setTimeout(() => {
        setIsRefreshing(false);
        setPullY(0);
      }, 650);
    } else {
      setPullY(0);
    }
  };

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
    setStep(1);
    setIsCreating(true);
  };

  const handleCloseWizard = () => {
    setIsCreating(false);
  };

  const selectWeight = (w: string) => {
    setWeight(w);
    setStep(2);
  };

  const selectFlavour = (f: string) => {
    if (f === "Custom / Other") {
      setFlavour("Custom");
    } else {
      setFlavour(f);
      setCustomFlavour("");
      setStep(3);
    }
  };

  const selectPrice = (p: number) => {
    setTotalPrice(p);
    setStep(4);
  };

  const finalizeOrder = (slot?: string) => {
    if (!baker) return;
    const finalSlot = customTime.trim() ? customTime.trim() : (slot || timeSlot);
    const finalFlavour = customFlavour.trim() ? customFlavour.trim() : flavour;
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
    setStep(5);
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
    const message = `Please confirm your cake order details and advance token (₹${order.token_amount}) here:\n\n${link}\n\n${order.weight} ${order.flavour} (${order.is_eggless ? "Eggless" : "With Egg"})\nTime: ${order.time_slot}\nBalance Due at Pickup: ₹${order.balance_amount}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleCopyLink = (orderNum: string) => {
    const link = getCustomerLink(orderNum);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!baker) return null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`min-h-screen bg-[#f4f4f5] text-zinc-950 selection:bg-zinc-200 relative ${
        isCreating ? "h-screen overflow-hidden" : "overflow-y-auto"
      }`}
    >
      {/* =======================================================================
          SWIPE / PULL TO REFRESH FLOATING INDICATOR PILL
          ======================================================================= */}
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200 ${
          pullY > 0 || isRefreshing ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-95"
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg border border-zinc-200/80 text-xs font-semibold text-zinc-800">
          <RotateCw
            className={`w-3.5 h-3.5 text-zinc-800 transition-transform ${
              isRefreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: !isRefreshing ? `rotate(${pullY * 5}deg)` : undefined,
            }}
          />
          <span>
            {isRefreshing
              ? "Updating orders..."
              : pullY >= 48
              ? "Release to refresh"
              : "Pull to refresh"}
          </span>
        </div>
      </div>

      <div
        className="max-w-xl mx-auto min-h-screen flex flex-col relative transition-transform duration-150 ease-out"
        style={{
          transform: pullY > 0 ? `translateY(${pullY * 0.4}px)` : undefined,
        }}
      >
        
        {/* =======================================================================
            TOP HEADER AREA (SCROLLS AWAY AND HIDES BUTTON AS SHEET ROLLS UP)
            ======================================================================= */}
        <header
          className={`shrink-0 transition-all duration-300 flex flex-col items-center justify-center text-center px-6 ${
            isCreating ? "pt-5 pb-2" : "pt-12 pb-8"
          }`}
        >
          {/* Default Title & Rainbow Button */}
          {!isCreating && (
            <div className="space-y-3.5 transition-all">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-950">
                  {baker.name}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5 max-w-xs mx-auto truncate">
                  {baker.pickup_address || "Indiranagar, Bengaluru"}
                </p>
              </div>

              <div className="pt-0.5">
                <RainbowButton onClick={handleStartNewOrder}>
                  <Plus className="w-4 h-4" />
                  New Order
                </RainbowButton>
              </div>
            </div>
          )}

          {/* =======================================================================
              STEP WIZARD (EXPANDS FULLSCREEN WHEN CREATING)
              ======================================================================= */}
          {isCreating && (
            <div className="w-full py-2 animate-in fade-in duration-200">
              {/* Top Navigation Bar: Back & Step Indicator */}
              <div className="flex items-center justify-between pb-4 px-1">
                <button
                  type="button"
                  onClick={() => {
                    if (step > 1 && step < 5) {
                      setStep((prev) => (prev - 1) as any);
                    } else {
                      handleCloseWizard();
                    }
                  }}
                  className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200/50 transition-colors"
                >
                  {step > 1 && step < 5 ? (
                    <ArrowLeft className="w-5 h-5" />
                  ) : (
                    <X className="w-5 h-5" />
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        step === i
                          ? "w-6 bg-zinc-950"
                          : step > i
                          ? "w-1.5 bg-zinc-400"
                          : "w-1.5 bg-zinc-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* STEP 1: WEIGHT & EGGLESS PREFERENCE */}
              {step === 1 && (
                <div className="space-y-4 text-center animate-in fade-in slide-in-from-bottom-3 duration-200">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                      Cake Type & Weight
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">Select dietary preference and cake size</p>
                  </div>

                  {/* EGGLESS / WITH EGG TOGGLE */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-200/70 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => setIsEggless(true)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all ${
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
                      className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                        !isEggless
                          ? "bg-white text-zinc-950 shadow-xs"
                          : "text-zinc-600 hover:text-zinc-950"
                      }`}
                    >
                      With Egg
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {WEIGHT_OPTIONS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => selectWeight(w)}
                        className={`py-4 rounded-2xl font-semibold text-base transition-all active:scale-95 duration-150 ${
                          weight === w
                            ? "bg-zinc-950 text-white"
                            : "bg-white text-zinc-900 hover:bg-zinc-100"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: FLAVOUR */}
              {step === 2 && (
                <div className="space-y-5 text-center animate-in fade-in slide-in-from-bottom-3 duration-200">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                      Select Flavour
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">For {weight} cake</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    {FLAVOUR_OPTIONS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => selectFlavour(f)}
                        className="py-4 px-3 rounded-2xl bg-white text-zinc-900 font-medium text-sm hover:bg-zinc-950 hover:text-white transition-all active:scale-95 duration-150 truncate"
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {flavour === "Custom" && (
                    <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Type custom flavour..."
                        value={customFlavour}
                        onChange={(e) => setCustomFlavour(e.target.value)}
                        className="w-full px-4 py-3.5 rounded-2xl bg-white text-zinc-950 text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={!customFlavour.trim()}
                        onClick={() => setStep(3)}
                        className="w-full py-3.5 rounded-2xl bg-zinc-950 text-white font-medium text-sm disabled:opacity-40 transition-opacity"
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: PRICE */}
              {step === 3 && (
                <div className="space-y-5 text-center animate-in fade-in slide-in-from-bottom-3 duration-200">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                      Agreed Price
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {weight} • {customFlavour || flavour}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {PRICE_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => selectPrice(p)}
                        className="py-5 rounded-2xl bg-white text-zinc-900 font-bold text-lg hover:bg-zinc-950 hover:text-white transition-all active:scale-95 duration-150"
                      >
                        ₹{p}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Or custom amount (₹)"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="flex-1 px-4 py-3.5 rounded-2xl bg-white text-zinc-950 text-sm focus:outline-none font-medium"
                    />
                    {customPrice && (
                      <button
                        type="button"
                        onClick={() => {
                          setTotalPrice(Number(customPrice));
                          setStep(4);
                        }}
                        className="px-5 py-3.5 rounded-2xl bg-zinc-950 text-white font-medium text-sm active:scale-95 transition-all"
                      >
                        Next
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: DATE & TIME SLOT */}
              {step === 4 && (
                <div className="space-y-4 text-center animate-in fade-in slide-in-from-bottom-3 duration-200">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-950">
                      Delivery Date & Time
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {weight} • {customFlavour || flavour} ({isEggless ? "Eggless" : "With Egg"})
                    </p>
                  </div>

                  {/* DATE SELECTION CHIPS */}
                  <div className="p-3.5 rounded-2xl bg-white space-y-2.5 text-left shadow-xs">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Select Delivery Date
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(() => {
                        const today = new Date().toISOString().split("T")[0];
                        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
                        const dayAfter = new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0];
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => setDeliveryDate(today)}
                              className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center ${
                                deliveryDate === today
                                  ? "bg-zinc-950 text-white shadow-xs"
                                  : "bg-[#f4f4f5] text-zinc-700 hover:bg-zinc-200"
                              }`}
                            >
                              Today
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeliveryDate(tomorrow)}
                              className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center ${
                                deliveryDate === tomorrow
                                  ? "bg-zinc-950 text-white shadow-xs"
                                  : "bg-[#f4f4f5] text-zinc-700 hover:bg-zinc-200"
                              }`}
                            >
                              Tomorrow
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeliveryDate(dayAfter)}
                              className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center ${
                                deliveryDate === dayAfter
                                  ? "bg-zinc-950 text-white shadow-xs"
                                  : "bg-[#f4f4f5] text-zinc-700 hover:bg-zinc-200"
                              }`}
                            >
                              Day After
                            </button>
                          </>
                        );
                      })()}
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-xs text-zinc-500 shrink-0">Or pick date:</span>
                      <input
                        type="date"
                        value={deliveryDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-[#f4f4f5] text-xs text-zinc-950 font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* TIME SLOT PRESETS */}
                  <div className="p-3.5 rounded-2xl bg-white space-y-2.5 text-left shadow-xs">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Select Time Slot
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            setTimeSlot(slot);
                            setCustomTime("");
                          }}
                          className={`py-2.5 px-2 rounded-xl text-xs font-medium transition-all text-center truncate ${
                            timeSlot === slot && !customTime
                              ? "bg-zinc-950 text-white font-semibold shadow-xs"
                              : "bg-[#f4f4f5] text-zinc-800 hover:bg-zinc-200"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>

                    {/* Custom Time Input */}
                    <div className="pt-1 space-y-1">
                      <input
                        type="text"
                        placeholder="Or custom time (e.g. 8:30 PM Party, 12 AM Midnight)"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Finalize CTA Button */}
                  <button
                    type="button"
                    onClick={() => finalizeOrder()}
                    className="w-full py-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm transition-all active:scale-[0.98] shadow-xs"
                  >
                    Generate Order Link →
                  </button>
                </div>
              )}

              {/* STEP 5: FINAL READY LINK */}
              {step === 5 && createdOrder && (
                <div className="space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-white text-zinc-950 flex items-center justify-center mx-auto shadow-xs">
                    <Check className="w-6 h-6" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
                      Order #{createdOrder.order_number} Ready
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {createdOrder.weight} {createdOrder.flavour} • ₹{createdOrder.total_price}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <button
                      onClick={() => handleSendViaWhatsApp(createdOrder)}
                      className="w-full py-4 rounded-2xl bg-zinc-950 text-white font-semibold text-sm hover:bg-zinc-800 transition-all active:scale-98 flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send via WhatsApp
                    </button>

                    <button
                      onClick={() => handleCopyLink(createdOrder.order_number)}
                      className="w-full py-3.5 rounded-2xl bg-white text-zinc-900 font-medium text-xs hover:bg-zinc-100 transition-all active:scale-98"
                    >
                      {copiedLink ? "Copied!" : "Copy Link"}
                    </button>

                    <button
                      onClick={handleCloseWizard}
                      className="w-full py-3 text-xs font-medium text-zinc-400 hover:text-zinc-950 transition-colors"
                    >
                      Back to Orders
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </header>

        {/* =======================================================================
            BOTTOM SHEET (ROLLS UP AS USER SCROLLS, STOPS AT TOP, HIDING BUTTON)
            ======================================================================= */}
        {!isCreating && (() => {
          // Filter by status
          const filteredOrders = orders.filter((o) => {
            if (statusFilter === "all") return true;
            return o.status === statusFilter;
          });

          // Group by date
          const groupedOrders: { [date: string]: Order[] } = {};
          filteredOrders.forEach((o) => {
            const d = o.delivery_date || "Upcoming";
            if (!groupedOrders[d]) groupedOrders[d] = [];
            groupedOrders[d].push(o);
          });

          const sortedDates = Object.keys(groupedOrders).sort();

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

          const todayEarned = orders
            .filter((o) => o.status === "completed")
            .reduce((sum, o) => sum + o.total_price, 0);

          return (
            <section className="flex-1 min-h-[calc(100vh-60px)] bg-white rounded-t-[2.5rem] px-6 pt-3 pb-24 shadow-xs">
              {/* STICKY SHEET HANDLE, TITLE & FILTERS */}
              <div className="sticky top-0 bg-white z-20 pt-2 pb-3 space-y-2.5">
                <div className="w-10 h-1 rounded-full bg-zinc-200 mx-auto" />
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Orders ({filteredOrders.length})
                  </h2>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                    Earned Today: ₹{todayEarned.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  {[
                    { key: "all", label: "All" },
                    { key: "pending_token", label: "Waiting" },
                    { key: "confirmed", label: "Baking" },
                    { key: "baked", label: "Baked" },
                    { key: "completed", label: "Success" },
                  ].map((tab) => {
                    const count =
                      tab.key === "all"
                        ? orders.length
                        : orders.filter((o) => o.status === tab.key).length;
                    const isActive = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key as any)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                          isActive
                            ? "bg-zinc-950 text-white shadow-xs"
                            : "bg-zinc-100 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`text-[10px] ${
                            isActive ? "text-zinc-300" : "text-zinc-400"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ORDERS LIST GROUPED BY DATE */}
              <div className="space-y-4 pt-1">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="p-4 rounded-2xl bg-[#f4f4f5] animate-pulse space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="h-4 w-32 bg-zinc-200 rounded-md" />
                          <div className="h-4 w-16 bg-zinc-200 rounded-full" />
                        </div>
                        <div className="h-10 bg-white/70 rounded-xl" />
                        <div className="flex justify-between">
                          <div className="h-3 w-20 bg-zinc-200 rounded" />
                          <div className="h-3 w-24 bg-zinc-200 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <p className="text-sm font-medium text-zinc-950">
                      No {statusFilter === "all" ? "" : statusFilter === "pending_token" ? "waiting" : statusFilter} orders
                    </p>
                    <p className="text-xs text-zinc-400">
                      {statusFilter === "all"
                        ? "Tap 'New Order' above to create your first link."
                        : "No orders match this filter."}
                    </p>
                  </div>
                ) : (
                  sortedDates.map((dateKey) => (
                    <div key={dateKey} className="space-y-3">
                      {/* BREAK-EVEN DATE SEPARATOR */}
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-[1px] flex-1 bg-zinc-100" />
                        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-100">
                          {getFriendlyDateHeader(dateKey)}
                        </span>
                        <div className="h-[1px] flex-1 bg-zinc-100" />
                      </div>

                      {groupedOrders[dateKey].map((ord) =>
                        ord.status === "pending_token" ? (
                          /* COMPACT COLLAPSED CARD FOR WAITING ORDERS */
                          <div
                            key={ord.id}
                            className="p-3.5 rounded-2xl bg-[#f4f4f5] flex items-center justify-between gap-3 transition-transform active:scale-[0.99] duration-150"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-zinc-950 truncate">
                                {ord.order_number} • {ord.weight} {ord.flavour}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                                <span>{ord.time_slot}</span>
                                <span>•</span>
                                <span className="font-medium text-zinc-700">₹{ord.total_price}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-zinc-600 font-medium">
                                  Waiting ₹{ord.token_amount}
                                </span>
                              </div>
                            </div>

                            {/* WhatsApp Share Button */}
                            <button
                              onClick={() => handleSendViaWhatsApp(ord)}
                              className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-600 transition-colors active:scale-95 flex items-center justify-center shrink-0"
                              title="Share on WhatsApp"
                            >
                              <svg className="w-4 h-4 fill-emerald-500" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </button>
                          </div>
                        ) : ord.status === "completed" ? (
                          /* COMPACT COLLAPSED CARD FOR DELIVERED / COMPLETED ORDERS */
                          <div
                            key={ord.id}
                            className="p-3.5 rounded-2xl bg-emerald-50/80 flex items-center justify-between gap-3 transition-transform active:scale-[0.99] duration-150"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-zinc-950 truncate">
                                {ord.order_number} • {ord.weight} {ord.flavour}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-emerald-800/80 mt-0.5">
                                <span>{ord.time_slot}</span>
                                <span>•</span>
                                <span className="font-semibold text-emerald-950">₹{ord.total_price}</span>
                                <span>•</span>
                                <span>Paid ✓</span>
                              </div>
                            </div>

                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">
                              Delivered ✓
                            </span>
                          </div>
                        ) : (
                          /* FULL EXPANDED CARD FOR CONFIRMED / BAKED */
                          <div
                            key={ord.id}
                            className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3 transition-all active:scale-[0.99] duration-150"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-sm font-semibold text-zinc-950">
                                  {ord.order_number} • {ord.weight} {ord.flavour}
                                </div>
                                <div className="text-xs text-zinc-400 mt-0.5">
                                  {ord.time_slot}
                                </div>
                              </div>

                              <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white text-zinc-700">
                                {ord.status}
                              </span>
                            </div>

                            {/* Customer & Fulfilment Details */}
                            {ord.customer_name && (
                              <div className="flex items-center justify-between text-xs px-1">
                                <div className="text-zinc-700">
                                  <span className="text-zinc-400">Customer: </span>
                                  <span className="font-semibold text-zinc-950">
                                    {ord.customer_name}
                                  </span>
                                  {ord.customer_phone && (
                                    <a
                                      href={`tel:${ord.customer_phone}`}
                                      className="ml-2 text-zinc-500 hover:text-zinc-950 font-mono text-[11px] underline"
                                      title="Click to call"
                                    >
                                      +{ord.customer_phone}
                                    </a>
                                  )}
                                </div>
                                <span className="text-[10px] font-semibold text-zinc-600 bg-white px-2 py-0.5 rounded-full">
                                  {ord.fulfilment_type === "delivery" ? "Home Delivery" : "Self Pickup"}
                                </span>
                              </div>
                            )}

                            {/* Delivery Address (if home delivery) */}
                            {ord.fulfilment_type === "delivery" && ord.delivery_address && (
                              <div className="p-2.5 rounded-xl bg-white text-xs space-y-0.5">
                                <div className="text-[10px] text-zinc-400 uppercase font-medium">
                                  Delivery Address
                                </div>
                                <div className="text-zinc-950 font-medium">
                                  {ord.delivery_address}
                                </div>
                              </div>
                            )}

                            {/* Cake Message Display */}
                            <div className="p-3 rounded-xl bg-white text-xs space-y-0.5">
                              <div className="text-[10px] text-zinc-400 uppercase font-medium">
                                Text on Cake
                              </div>
                              <div className="font-medium text-zinc-950">
                                {ord.cake_message ? `"${ord.cake_message}"` : "None (Plain Top)"}
                              </div>
                            </div>

                            {/* Extra Add-on Items Display */}
                            {ord.addons && ord.addons.length > 0 && (
                              <div className="p-3 rounded-xl bg-white text-xs space-y-1.5">
                                <div className="text-[10px] text-zinc-400 uppercase font-medium">
                                  Extra Add-ons ({ord.addons.length})
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {ord.addons.map((a, i) => (
                                    <span
                                      key={i}
                                      className="px-2.5 py-1 rounded-lg bg-[#f4f4f5] text-zinc-900 font-medium text-[11px]"
                                    >
                                      {a.name} (+₹{a.price})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Multiple Customer Reference Photos (if attached) */}
                            {((ord.reference_images && ord.reference_images.length > 0) || ord.reference_image) && (
                              <div className="p-3 rounded-xl bg-white text-xs space-y-1.5">
                                <div className="text-[10px] text-zinc-400 uppercase font-medium">
                                  Reference Photos ({(ord.reference_images || [ord.reference_image]).length})
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                  {(ord.reference_images || [ord.reference_image]).map((img, i) => (
                                    <img
                                      key={i}
                                      src={img!}
                                      alt="Reference"
                                      className="w-16 h-16 rounded-lg object-cover bg-zinc-100 shrink-0 border border-zinc-200/60"
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Special Note */}
                            {ord.special_notes && (
                              <div className="p-2.5 rounded-xl bg-white text-xs space-y-0.5">
                                <div className="text-[10px] text-zinc-400 uppercase font-medium">
                                  Special Note
                                </div>
                                <div className="text-zinc-950 italic font-medium">
                                  "{ord.special_notes}"
                                </div>
                              </div>
                            )}

                            {/* Financial Summary */}
                            <div className="flex items-center justify-between text-xs text-zinc-600 px-0.5">
                              <span>Total: ₹{ord.total_price}</span>
                              <span className="font-semibold text-zinc-950">
                                Balance: ₹{ord.balance_amount}
                              </span>
                            </div>

                            {/* Status Actions */}
                            <div className="pt-1 flex gap-2">
                              {ord.status !== "baked" && (
                                <MovingBorderButton
                                  onClick={() => updateOrderStatus(ord.id, "baked")}
                                  containerClassName="flex-1 h-9"
                                  className="bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-50"
                                >
                                  Mark Baked
                                </MovingBorderButton>
                              )}
                              {ord.status === "baked" && (
                                <button
                                  onClick={() => updateOrderStatus(ord.id, "completed")}
                                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors active:scale-95 shadow-xs"
                                >
                                  Collected ✓
                                </button>
                              )}
                              <button
                                onClick={() => handleSendViaWhatsApp(ord)}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-600 transition-colors active:scale-95 flex items-center justify-center shrink-0"
                                title="Share on WhatsApp"
                              >
                                <svg className="w-4 h-4 fill-emerald-500" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })()}
      </div>
    </div>
  );
}
