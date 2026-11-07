"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Order, Baker } from "@/lib/types";
import {
  getOrderByNumber,
  saveLocalOrder,
  getLocalBakers,
  fetchRemoteOrderByNumber,
  fetchRemoteBaker,
  DEFAULT_ADDONS,
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

export default function CustomerCheckoutPage() {
  const params = useParams();
  const orderNumber = (params?.orderNumber as string) || "";

  const [order, setOrder] = useState<Order | null>(null);
  const [baker, setBaker] = useState<Baker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const availableAddons =
    baker?.addon_items && baker.addon_items.length > 0
      ? baker.addon_items
      : DEFAULT_ADDONS;

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

    const loadOrderData = async () => {
      let found = getOrderByNumber(orderNumber);
      if (!found) {
        found = (await fetchRemoteOrderByNumber(orderNumber)) || undefined;
      }

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
        let b = bakers.find((item) => item.id === found?.baker_id);
        if (!b && found.baker_id) {
          b = (await fetchRemoteBaker(found.baker_id)) || undefined;
        }
        if (b) setBaker(b);
      }
      setIsLoading(false);
    };

    loadOrderData();
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
          TOP BAR (MINIMALIST BRANDING) - ONLY ON CHECKOUT FORM
          ======================================================================= */}
      {!isPaid && (
        <header className="px-5 pt-3.5 pb-2.5 border-b border-zinc-100 bg-white sticky top-0 z-20 print:hidden flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-sm font-bold text-zinc-950 tracking-tight truncate">
              {baker.name}
            </h1>
            <span className="w-3.5 h-3.5 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
              ✓
            </span>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-[#f4f4f5] text-[11px] font-semibold text-zinc-700 shrink-0 font-mono">
            #{order.order_number}
          </span>
        </header>
      )}

      {/* =======================================================================
          MAIN CONTENT AREA
          ======================================================================= */}
      <main className={`flex-1 px-4 ${isPaid ? "pt-6 pb-12" : "pt-3.5 pb-28"}`}>
        {isPaid ? (
          /* ===================================================================
              VIEW: DELIGHTFUL PAYMENT SUCCESS & DIGITAL BOOKING PASS
              =================================================================== */
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* 1. Celebratory Success Hero */}
            <div className="flex flex-col items-center text-center pt-2 pb-1 space-y-2.5 print:hidden">
              <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 animate-in zoom-in-50 duration-300">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-zinc-950 tracking-tight">
                  Booking Confirmed!
                </h2>
                <p className="text-xs text-zinc-500">
                  ₹{order.token_amount} advance token received • Slot is locked
                </p>
              </div>
            </div>

            {/* 2. Digital Booking Pass (The Ticket) */}
            <div
              id="receipt-voucher"
              className="rounded-3xl bg-[#f4f4f5] border border-zinc-200/80 overflow-hidden space-y-0 print:border-none print:p-0 print:bg-white"
            >
              {/* Pass Top Banner */}
              <div className="p-4 bg-zinc-950 text-white flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">
                    Booking Pass
                  </div>
                  <div className="text-sm font-bold truncate max-w-[200px]">
                    {baker.name}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold font-mono">
                    #{order.order_number}
                  </span>
                </div>
              </div>

              {/* Pass Body Content */}
              <div className="p-4 space-y-3.5 bg-[#f4f4f5]">
                {/* Cake Highlight */}
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-zinc-950 leading-snug">
                    {order.weight} {order.flavour}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-zinc-200/60 text-[11px]">
                      {order.is_eggless ? "100% Eggless" : "With Egg"}
                    </span>
                    <span>•</span>
                    <span>{order.time_slot}</span>
                  </div>
                </div>

                {/* Handover & Slot Schedule */}
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/60 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                        Date & Ready Time
                      </span>
                      <div className="font-bold text-zinc-900">
                        {order.delivery_date} ({order.time_slot})
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-[11px] font-semibold text-zinc-700 shrink-0">
                      {order.fulfilment_type === "delivery" ? "Home Delivery" : "Self Pickup"}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 flex items-start gap-2 text-zinc-700">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400 mt-0.5" />
                    <div className="min-w-0 text-[11px]">
                      <div className="font-semibold text-zinc-900">
                        {order.fulfilment_type === "delivery" ? "Deliver to:" : "Pickup from:"}
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

                {/* Message on Cake (if present) */}
                {order.cake_message && order.cake_message.trim() && (
                  <div className="p-3 rounded-2xl bg-white border border-zinc-200/60 space-y-0.5">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                      Text to be piped on Cake
                    </span>
                    <p className="text-sm font-semibold text-zinc-950">
                      "{order.cake_message}"
                    </p>
                  </div>
                )}

                {/* Reference Photos (if uploaded) */}
                {referenceImages.length > 0 && (
                  <div className="p-3 rounded-2xl bg-white border border-zinc-200/60 space-y-2">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider block">
                      Cake Design Screenshot ({referenceImages.length})
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                      {referenceImages.map((imgUrl, i) => (
                        <div
                          key={i}
                          onClick={() => setEnlargedImage(imgUrl)}
                          className="cursor-pointer relative w-16 h-16 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/60"
                        >
                          <img
                            src={imgUrl}
                            alt={`Design ${i + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Addons (if any) */}
                {order.addons && order.addons.length > 0 && (
                  <div className="p-3 rounded-2xl bg-white border border-zinc-200/60 space-y-1.5">
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

                {/* Customer Info (if present) */}
                {order.customer_name && (
                  <div className="px-1 flex items-center justify-between text-xs text-zinc-600">
                    <span>Customer:</span>
                    <span className="font-semibold text-zinc-900">
                      {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ""}
                    </span>
                  </div>
                )}

                {/* Financial Tear-off Ledger */}
                <div className="pt-3 border-t border-dashed border-zinc-300 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Total Cake Value:</span>
                    <span className="font-semibold text-zinc-800">₹{order.total_price}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 font-semibold">
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Token Advance Paid:
                    </span>
                    <span>₹{order.token_amount}</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-zinc-950 font-bold">
                    <span>Balance Due at Handover:</span>
                    <span className="text-base text-zinc-950">₹{order.balance_amount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Action Buttons */}
            <div className="space-y-2 pt-1 print:hidden">
              <button
                onClick={handleSendSimpleWhatsApp}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span>Notify Baker on WhatsApp</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Save / Download PDF Pass</span>
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

            {/* CARD 2: BOOKING DETAILS (ZERO COGNITIVE LOAD) */}
            <div className="p-4 rounded-3xl bg-[#f4f4f5] space-y-3">
              {/* Handover Toggle: Pickup vs Delivery */}
              <div className="space-y-2">
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
                  <div className="px-1 text-xs text-zinc-600 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{baker.pickup_address}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter complete delivery address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs placeholder-zinc-400 focus:outline-none border border-transparent focus:border-zinc-300 font-medium"
                  />
                )}
              </div>

              {/* Grouped Customer Info Block (Single unified container) */}
              <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-zinc-100">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none font-medium bg-transparent"
                  />
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="WhatsApp No."
                    value={customerPhone}
                    onChange={(e) =>
                      setCustomerPhone(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full px-3.5 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none font-medium bg-transparent font-mono"
                  />
                </div>
                <div className="border-t border-zinc-100">
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="Text on cake (e.g. Happy Birthday Rohan) — optional"
                    value={cakeMessage}
                    onChange={(e) => setCakeMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none font-medium bg-transparent"
                  />
                </div>
              </div>

              {/* Extras Row: Photo Reference & Party Items as Clean Dual Chips */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageChange}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    referenceImages.length > 0
                      ? "bg-zinc-950 text-white border-zinc-950"
                      : "bg-white text-zinc-700 border-zinc-200/80 hover:bg-zinc-50"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {referenceImages.length > 0
                      ? `${referenceImages.length} Photo Added`
                      : "Reference Photo"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddonsSection(!showAddonsSection)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    selectedAddons.length > 0 || showAddonsSection
                      ? "bg-zinc-950 text-white border-zinc-950"
                      : "bg-white text-zinc-700 border-zinc-200/80 hover:bg-zinc-50"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {selectedAddons.length > 0
                      ? `${selectedAddons.length} Added`
                      : "Party Items"}
                  </span>
                </button>
              </div>

              {/* Reference Images Thumbnails (if uploaded) */}
              {referenceImages.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
                  {referenceImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative w-14 h-14 rounded-xl overflow-hidden bg-white shrink-0 border border-zinc-200/80"
                    >
                      <img
                        src={imgUrl}
                        alt={`Ref ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeReferenceImage(idx)}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/80 text-white flex items-center justify-center text-[9px]"
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
              )}

              {/* Party Addons Section (Expands smoothly on demand) */}
              {showAddonsSection && (
                <div className="space-y-2 pt-2 border-t border-zinc-200/60 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800">
                      Party Items & Accessories
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddonsSection(false)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-600 font-medium"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {availableAddons.map((item) => {
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