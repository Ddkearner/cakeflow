"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Order, Baker } from "@/lib/types";
import {
  getOrderByNumber,
  saveLocalOrder,
  getLocalBakers,
} from "@/lib/store";
import {
  buildUpiIntentLink,
  buildWhatsAppLink,
} from "@/lib/utils";
import {
  Check,
  MapPin,
  Copy,
  ShieldCheck,
  ExternalLink,
  Camera,
  X,
  Plus,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const AVAILABLE_ADDONS = [
  { id: "sparkler", name: "Magic Sparkler Candle", price: 40 },
  { id: "number_candle", name: "Number Candle (0-9)", price: 30 },
  { id: "party_popper", name: "Party Popper", price: 50 },
  { id: "balloons", name: "Metallic Balloons Set", price: 80 },
  { id: "birthday_cap", name: "Party Cap", price: 30 },
  { id: "cutlery", name: "Wooden Knife & Plates", price: 30 },
];

export default function CustomerCheckoutPage() {
  const params = useParams();
  const orderNumber = (params?.orderNumber as string) || "";

  const [order, setOrder] = useState<Order | null>(null);
  const [baker, setBaker] = useState<Baker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Essential Form Fields
  const [cakeMessage, setCakeMessage] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfilmentType, setFulfilmentType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<
    Array<{ id: string; name: string; price: number }>
  >([]);
  const [showAddonsSection, setShowAddonsSection] = useState(false);

  // Payment & Modal States
  const [isPaid, setIsPaid] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orderNumber) {
      setIsLoading(false);
      return;
    }
    const found = getOrderByNumber(orderNumber);
    if (found) {
      setOrder(found);
      setCakeMessage(found.cake_message || "");
      if (found.reference_images && found.reference_images.length > 0) {
        setReferenceImages(found.reference_images);
      } else if (found.reference_image) {
        setReferenceImages([found.reference_image]);
      }
      if (found.addons && found.addons.length > 0) {
        setSelectedAddons(found.addons);
        setShowAddonsSection(true);
      }
      setCustomerName(found.customer_name || "");
      setCustomerPhone(found.customer_phone || "");
      setFulfilmentType(found.fulfilment_type || "pickup");
      setDeliveryAddress(found.delivery_address || "");
      if (
        found.status === "confirmed" ||
        found.status === "baked" ||
        found.status === "completed"
      ) {
        setIsPaid(true);
      }

      const bakers = getLocalBakers();
      const b = bakers.find((item) => item.id === found.baker_id);
      if (b) setBaker(b);
    }
    const timer = setTimeout(() => setIsLoading(false), 150);
    return () => clearTimeout(timer);
  }, [orderNumber]);

  // Handle Image Upload & Compression
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
          setReferenceImages((prev) => [...prev, compressedBase64].slice(0, 4));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAddon = (item: { id: string; name: string; price: number }) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === item.id);
      if (exists) {
        return prev.filter((a) => a.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  // Price Calculations
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const basePrice = order?.total_price || 0;
  const finalTotalPrice = basePrice + addonsTotal;
  const tokenAmount = order?.token_amount || 100;
  const finalBalanceAmount = Math.max(0, finalTotalPrice - tokenAmount);

  const handlePayAndConfirm = () => {
    if (!order || !baker) return;

    const updated: Order = {
      ...order,
      total_price: finalTotalPrice,
      balance_amount: finalBalanceAmount,
      cake_message: cakeMessage.trim() || undefined,
      reference_image: referenceImages[0] || undefined,
      reference_images: referenceImages.length > 0 ? referenceImages : undefined,
      addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      fulfilment_type: fulfilmentType,
      delivery_address:
        fulfilmentType === "delivery" ? deliveryAddress.trim() : undefined,
      status: "confirmed",
    };

    saveLocalOrder(updated);
    setOrder(updated);
    setIsPaid(true);

    const upiLink = buildUpiIntentLink({
      upiId: baker.upi_id,
      name: baker.name,
      amount: tokenAmount,
      orderNumber: order.order_number,
    });

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = upiLink;
    } else {
      setShowQrModal(true);
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleSendSimpleWhatsApp = () => {
    if (!order || !baker) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const msg = `Hi ${baker.name}, I have confirmed Order #${order.order_number} (${customerName || "Customer"}) and paid ₹${tokenAmount} token advance.\n\nReceipt: ${origin}/o/${order.order_number}`;
    const waUrl = buildWhatsAppLink(baker.phone, msg);
    window.open(waUrl, "_blank");
  };

  const handleCopyUpi = () => {
    if (!baker) return;
    navigator.clipboard.writeText(baker.upi_id);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // =========================================================================
  // SKELETON LOADER
  // =========================================================================
  if (isLoading) {
    return (
      <main className="max-w-md mx-auto min-h-[100dvh] bg-white px-5 pt-6 pb-12 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="space-y-1.5">
            <div className="h-5 w-32 rounded-lg bg-zinc-100 animate-pulse" />
            <div className="h-3.5 w-44 rounded-md bg-zinc-100 animate-pulse" />
          </div>
          <div className="h-7 w-20 rounded-full bg-zinc-100 animate-pulse" />
        </div>
        <div className="h-44 w-full rounded-3xl bg-[#f4f4f5] animate-pulse" />
        <div className="h-64 w-full rounded-3xl bg-[#f4f4f5] animate-pulse" />
      </main>
    );
  }

  if (!order || !baker) {
    return (
      <div className="max-w-md mx-auto min-h-[100dvh] flex items-center justify-center p-6 text-center bg-white text-zinc-950">
        <div className="p-8 rounded-3xl bg-[#f4f4f5] max-w-sm space-y-2">
          <h2 className="text-base font-bold text-zinc-950">
            Order #{orderNumber} Not Found
          </h2>
          <p className="text-xs text-zinc-500">
            Please check the link provided by the bakery on WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  const upiIntentUrl = buildUpiIntentLink({
    upiId: baker.upi_id,
    name: baker.name,
    amount: tokenAmount,
    orderNumber: order.order_number,
  });

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    upiIntentUrl
  )}`;

  return (
    <div className="min-h-[100dvh] bg-white text-zinc-950 flex flex-col justify-between max-w-md mx-auto relative overflow-x-hidden selection:bg-zinc-200">
      {/* =======================================================================
          TOP BAR (MINIMALIST BRANDING)
          ======================================================================= */}
      <header className="px-5 pt-4 pb-3 border-b border-zinc-100 bg-white sticky top-0 z-20 print:hidden flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-bold text-zinc-950 tracking-tight truncate">
              {baker.name}
            </h1>
            <span className="w-3.5 h-3.5 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
              ✓
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
            {baker.pickup_address}
          </p>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-[#f4f4f5] text-[11px] font-semibold text-zinc-700 shrink-0 font-mono">
          #{order.order_number}
        </span>
      </header>

      {/* =======================================================================
          MAIN CONTENT AREA
          ======================================================================= */}
      <main className="flex-1 px-4 pt-3.5 pb-28">
        {isPaid ? (
          /* ===================================================================
              VIEW: CLEAN VERIFIED RECEIPT
              =================================================================== */
          <div className="space-y-4 animate-in fade-in duration-200">
            <div
              id="receipt-voucher"
              className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-100/70 space-y-4 print:border-none print:p-0 print:bg-white"
            >
              {/* Print Header */}
              <div className="hidden print:block pb-3 border-b border-zinc-200">
                <h1 className="text-lg font-bold text-zinc-950">{baker.name}</h1>
                <p className="text-xs text-zinc-500">{baker.pickup_address}</p>
                <p className="text-xs text-zinc-500">Phone: +{baker.phone}</p>
              </div>

              {/* Status Banner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                    ✓
                  </span>
                  <span>Token Paid (₹{order.token_amount})</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-full font-mono">
                  #{order.order_number}
                </span>
              </div>

              {/* Cake Spec */}
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-zinc-950">
                  {order.weight} {order.flavour}
                </h2>
                <p className="text-xs text-zinc-600">
                  {order.is_eggless ? "100% Eggless" : "With Egg"} • {order.time_slot} ({order.delivery_date})
                </p>
              </div>

              {/* Message on Cake */}
              {order.cake_message && order.cake_message.trim() && (
                <div className="p-3 rounded-2xl bg-white space-y-0.5">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                    Text on Cake
                  </span>
                  <p className="text-sm font-semibold text-zinc-950">
                    "{order.cake_message}"
                  </p>
                </div>
              )}

              {/* Reference Photos */}
              {referenceImages.length > 0 && (
                <div className="p-3 rounded-2xl bg-white space-y-2">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider block">
                    Design Reference ({referenceImages.length})
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {referenceImages.map((imgUrl, i) => (
                      <div
                        key={i}
                        onClick={() => setEnlargedImage(imgUrl)}
                        className="cursor-pointer relative w-16 h-16 rounded-xl overflow-hidden bg-zinc-100 shrink-0"
                      >
                        <img
                          src={imgUrl}
                          alt={`Design ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Add-ons */}
              {order.addons && order.addons.length > 0 && (
                <div className="p-3 rounded-2xl bg-white space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider block">
                    Party Items
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {order.addons.map((addon) => (
                      <span
                        key={addon.id}
                        className="px-2 py-0.5 rounded-lg bg-zinc-100 text-zinc-800 text-xs font-medium"
                      >
                        {addon.name} (+₹{addon.price})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fulfilment Details */}
              <div className="p-3 rounded-2xl bg-white text-xs space-y-2">
                {order.customer_name && (
                  <div className="flex items-center justify-between text-zinc-800">
                    <span className="text-zinc-500">Customer</span>
                    <span className="font-semibold">
                      {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ""}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-2 pt-1 border-t border-zinc-100 text-zinc-700">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900">
                      {order.fulfilment_type === "delivery" ? "Home Delivery" : "Self Pickup"}
                    </div>
                    <div className="text-zinc-500 mt-0.5 break-words">
                      {order.fulfilment_type === "delivery"
                        ? order.delivery_address || "Address shared with baker"
                        : baker.pickup_address}
                    </div>
                    {order.fulfilment_type === "pickup" && baker.google_maps_url && (
                      <a
                        href={baker.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-1 hover:underline print:hidden"
                      >
                        <span>Open in Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Balance Due */}
              <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                <span className="text-zinc-600">Balance due at handover:</span>
                <span className="text-base font-bold text-zinc-950">
                  ₹{order.balance_amount}
                </span>
              </div>
            </div>

            {/* Voucher Actions */}
            <div className="space-y-2 pt-1 print:hidden">
              <button
                onClick={handleDownloadPdf}
                className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Download Receipt (PDF)</span>
              </button>

              <button
                onClick={handleSendSimpleWhatsApp}
                className="w-full py-3.5 rounded-2xl bg-[#f4f4f5] hover:bg-zinc-200 text-zinc-800 font-semibold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Notify Baker on WhatsApp</span>
              </button>
            </div>
          </div>
        ) : (
          /* ===================================================================
              VIEW: 0-COGNITIVE LOAD 2-CARD CHECKOUT
              =================================================================== */
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* CARD 1: THE CAKE & TOKEN SPOTLIGHT */}
            <div className="p-4 rounded-3xl bg-[#f4f4f5] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-zinc-950 tracking-tight leading-snug">
                    {order.weight} {order.flavour}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {order.is_eggless ? "100% Eggless" : "With Egg"} • {order.time_slot}
                  </p>
                </div>
              </div>

              {/* Price Row: Giant Token Clarity */}
              <div className="pt-3 border-t border-zinc-200/60 flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold text-zinc-950 tracking-tight">
                    ₹{tokenAmount}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700">
                    Token to lock slot
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div>Total: <span className="font-semibold text-zinc-900">₹{finalTotalPrice}</span></div>
                  <div>Balance at handover: <span className="font-semibold text-zinc-900">₹{finalBalanceAmount}</span></div>
                </div>
              </div>
            </div>

            {/* CARD 2: BOOKING DETAILS (SEAMLESS SINGLE CONTAINER) */}
            <div className="p-4 rounded-3xl bg-[#f4f4f5] space-y-3.5">
              {/* Handover Toggle: Pickup vs Delivery */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-200/70">
                  <button
                    type="button"
                    onClick={() => setFulfilmentType("pickup")}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      fulfilmentType === "pickup"
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    Self Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfilmentType("delivery")}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      fulfilmentType === "delivery"
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    Home Delivery
                  </button>
                </div>

                {fulfilmentType === "pickup" ? (
                  <p className="text-[11px] text-zinc-500 px-1 truncate">
                    Pickup from: {baker.pickup_address}
                  </p>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter complete delivery address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs placeholder-zinc-400 focus:outline-none font-medium mt-1"
                  />
                )}
              </div>

              {/* Customer Contact */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs placeholder-zinc-400 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="WhatsApp No."
                    value={customerPhone}
                    onChange={(e) =>
                      setCustomerPhone(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs placeholder-zinc-400 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Message on Cake */}
              <div>
                <input
                  type="text"
                  maxLength={40}
                  placeholder="Text on cake (e.g. Happy Birthday Rohan) — optional"
                  value={cakeMessage}
                  onChange={(e) => setCakeMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs placeholder-zinc-400 focus:outline-none font-medium"
                />
              </div>

              {/* Design Reference Upload (Discreet & Compact) */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageChange}
                />

                {referenceImages.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                    {referenceImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative w-14 h-14 rounded-xl overflow-hidden bg-white shrink-0 border border-zinc-200/60"
                      >
                        <img
                          src={imgUrl}
                          alt={`Ref ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeReferenceImage(idx)}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/75 text-white flex items-center justify-center text-[9px]"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {referenceImages.length < 4 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-14 h-14 rounded-xl bg-white border border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-900 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-medium">Add</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-zinc-100/80 flex items-center justify-center gap-2 text-xs font-medium text-zinc-600 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Attach reference photo (optional)</span>
                  </button>
                )}
              </div>

              {/* Party Addons (Discreet Accordion) */}
              <div className="pt-1">
                {!showAddonsSection && selectedAddons.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAddonsSection(true)}
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-zinc-100/80 flex items-center justify-between text-xs text-zinc-600 font-medium transition-colors"
                  >
                    <span>Party items (candles, sparklers...)</span>
                    <span className="text-[11px] font-semibold text-zinc-900">+ Add</span>
                  </button>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-zinc-200/60">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-800">
                        Party Add-ons
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddonsSection(false)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-600 font-medium"
                      >
                        {selectedAddons.length > 0
                          ? `(${selectedAddons.length} added)`
                          : "Hide"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {AVAILABLE_ADDONS.map((item) => {
                        const isSelected = selectedAddons.some((a) => a.id === item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleAddon(item)}
                            className={`p-2 rounded-xl text-left text-xs transition-all flex items-center justify-between ${
                              isSelected
                                ? "bg-zinc-950 text-white font-medium"
                                : "bg-white text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <span className="truncate pr-1">{item.name}</span>
                            <span
                              className={`text-[10px] shrink-0 font-semibold ${
                                isSelected ? "text-zinc-300" : "text-zinc-400"
                              }`}
                            >
                              +₹{item.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =======================================================================
          STICKY 1-TAP PAYMENT BUTTON
          ======================================================================= */}
      {!isPaid && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-zinc-100 px-4 py-3 max-w-md mx-auto print:hidden">
          <button
            type="button"
            onClick={handlePayAndConfirm}
            className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-zinc-900 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Pay ₹{tokenAmount} Token via UPI</span>
          </button>
          <p className="text-[10px] text-zinc-400 text-center mt-1 font-medium">
            GPay • PhonePe • Paytm • CRED • Instant Confirmation
          </p>
        </div>
      )}

      {/* =======================================================================
          DESKTOP UPI QR CODE MODAL
          ======================================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#f4f4f5] text-zinc-500 hover:text-zinc-950 flex items-center justify-center text-xs"
            >
              ✕
            </button>

            <div>
              <h3 className="text-base font-bold text-zinc-950">Scan & Pay Token</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Scan with any UPI app to confirm your booking
              </p>
            </div>

            <div className="p-3 bg-white border border-zinc-100 rounded-2xl inline-block shadow-xs">
              <img
                src={qrCodeUrl}
                alt="UPI QR Code"
                className="w-44 h-44 mx-auto rounded-xl"
              />
            </div>

            <div className="text-center space-y-1">
              <div className="text-xl font-bold text-zinc-950">₹{tokenAmount}</div>
              <div className="text-[11px] text-zinc-400 font-mono">
                {baker.upi_id}
              </div>
            </div>

            <button
              onClick={handleCopyUpi}
              className="w-full py-2.5 rounded-xl bg-[#f4f4f5] hover:bg-zinc-200 text-xs font-semibold text-zinc-800 transition-colors flex items-center justify-center gap-1.5"
            >
              {copiedUpi ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">UPI ID Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy UPI ID</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =======================================================================
          IMAGE ENLARGEMENT MODAL
          ======================================================================= */}
      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-sm w-full">
            <button
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
  );
}