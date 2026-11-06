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
  ChevronDown,
  ChevronUp,
  MapPin,
  Copy,
  QrCode,
  ShieldCheck,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Camera,
  X,
  Sparkles,
  Plus,
  Download,
} from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";

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
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Cake & Message, 2: Reference & Contact, 3: Fulfilment & Pay
  const [isLoading, setIsLoading] = useState(true);

  // Form Fields
  const [cakeMessage, setCakeMessage] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfilmentType, setFulfilmentType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<
    Array<{ id: string; name: string; price: number }>
  >([]);
  const [specialNotes, setSpecialNotes] = useState("");

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
      if (found.addons) setSelectedAddons(found.addons);
      setCustomerName(found.customer_name || "");
      setCustomerPhone(found.customer_phone || "");
      setFulfilmentType(found.fulfilment_type || "pickup");
      setDeliveryAddress(found.delivery_address || "");
      setSpecialNotes(found.special_notes || "");
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
    const timer = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(timer);
  }, [orderNumber]);

  // Handle Multiple Photo Compression & Conversion to Base64
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

  // Dynamic Price Calculations with Add-ons
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
      special_notes: specialNotes.trim() || undefined,
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
  // SIMMERING SKELETON UI SCREEN (NATIVE APP FEEL)
  // =========================================================================
  if (isLoading) {
    return (
      <main className="max-w-md mx-auto min-h-[100dvh] bg-white px-5 pt-5 pb-10 space-y-4">
        {/* Header Shimmer */}
        <div className="pb-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-32 rounded-lg animate-shimmer" />
            <div className="h-3.5 w-48 rounded-md animate-shimmer" />
          </div>
          <div className="h-7 w-20 rounded-full animate-shimmer" />
        </div>

        {/* Step Indicator Shimmer */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-1.5 rounded-full animate-shimmer" />
            <div className="h-1.5 rounded-full bg-zinc-100" />
            <div className="h-1.5 rounded-full bg-zinc-100" />
          </div>
          <div className="h-3 w-28 rounded animate-shimmer" />
        </div>

        {/* Hero Card Shimmer */}
        <div className="p-5 rounded-2xl bg-[#f4f4f5] space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-3 w-20 rounded animate-shimmer" />
              <div className="h-6 w-44 rounded-md animate-shimmer" />
              <div className="h-3 w-28 rounded animate-shimmer" />
            </div>
            <div className="h-7 w-16 rounded-lg animate-shimmer" />
          </div>
          <div className="pt-3 border-t border-zinc-200/50 flex justify-between">
            <div className="h-3.5 w-32 rounded animate-shimmer" />
            <div className="h-3.5 w-16 rounded animate-shimmer" />
          </div>
        </div>

        {/* Input Card Shimmer */}
        <div className="p-5 rounded-2xl bg-[#f4f4f5] space-y-3">
          <div className="h-4 w-48 rounded animate-shimmer" />
          <div className="h-12 w-full rounded-xl bg-white animate-pulse" />
          <div className="h-4 w-32 rounded animate-shimmer" />
        </div>

        {/* Bottom Button Shimmer */}
        <div className="pt-8">
          <div className="h-13 w-full rounded-2xl animate-shimmer" />
        </div>
      </main>
    );
  }

  if (!order || !baker) {
    return (
      <div className="max-w-md mx-auto min-h-[100dvh] flex items-center justify-center p-6 text-center bg-white text-zinc-950">
        <div className="p-8 rounded-2xl bg-[#f4f4f5] max-w-sm space-y-2">
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
          TOP APP BAR (NATIVE MOBILE FEEL)
          ======================================================================= */}
      <header className="px-5 pt-5 pb-3 border-b border-zinc-100 bg-white sticky top-0 z-20 print:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-zinc-950 tracking-tight truncate">
                {baker.name}
              </h1>
              <span className="w-4 h-4 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                ✓
              </span>
            </div>
            <p className="text-xs text-zinc-500 truncate mt-0.5">
              {baker.pickup_address}
            </p>
          </div>

          <span className="px-3 py-1 rounded-full bg-[#f4f4f5] text-xs font-semibold text-zinc-800 shrink-0 font-mono">
            #{order.order_number}
          </span>
        </div>

        {/* 3-SEGMENT PROGRESS BAR (NEVER WRAPS ON MOBILE) */}
        {!isPaid && (
          <div className="space-y-1.5 pt-0.5">
            <div className="grid grid-cols-3 gap-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= 1 ? "bg-zinc-950" : "bg-zinc-200"
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= 2 ? "bg-zinc-950" : "bg-zinc-200"
                }`}
              />
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= 3 ? "bg-zinc-950" : "bg-zinc-200"
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
              <span>
                {step === 1 && "Step 1: Cake & Message"}
                {step === 2 && "Step 2: Reference & Contact"}
                {step === 3 && "Step 3: Fulfilment & Payment"}
              </span>
              <span className="text-zinc-400 font-mono">{step} of 3</span>
            </div>
          </div>
        )}
      </header>

      {/* =======================================================================
          MAIN CONTENT AREA (SCROLLABLE WITH EXTRA PADDING FOR STICKY BOTTOM BAR)
          ======================================================================= */}
      <main className="flex-1 px-5 pt-3 pb-32">
        {isPaid ? (
          /* ===================================================================
              VIEW 1: CONFIRMED LUXURY RECEIPT VOUCHER (AFTER TOKEN PAYMENT)
              =================================================================== */
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              id="receipt-voucher"
              className="p-5 rounded-3xl bg-emerald-50/80 space-y-4 border border-emerald-100/60 print:border-none print:p-0"
            >
              {/* Header on Print Only */}
              <div className="hidden print:block pb-3 border-b border-zinc-200">
                <h1 className="text-lg font-bold text-zinc-950">{baker.name}</h1>
                <p className="text-xs text-zinc-500">{baker.pickup_address}</p>
                <p className="text-xs text-zinc-500">Phone: +{baker.phone}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                    ✓
                  </span>
                  <span>Token Paid: ₹{order.token_amount}</span>
                </div>
                <span className="text-xs font-semibold text-emerald-900 bg-emerald-100/70 px-2.5 py-0.5 rounded-full font-mono">
                  #{order.order_number}
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-zinc-950">
                  {order.weight} {order.flavour}
                </h2>
                <p className="text-xs text-zinc-600">
                  {order.is_eggless ? "100% Eggless" : "With Egg"} • {order.time_slot}
                </p>
              </div>

              {/* Cake Message Display Box */}
              <div className="p-3.5 rounded-2xl bg-white space-y-1">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                  Text on Cake
                </span>
                <p className="text-sm font-semibold text-zinc-950 italic">
                  {order.cake_message ? `"${order.cake_message}"` : "None (Plain Top)"}
                </p>
              </div>

              {/* Multiple Reference Images Gallery */}
              {referenceImages.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white space-y-2">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider block">
                    Reference Design Photos ({referenceImages.length})
                  </span>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                    {referenceImages.map((imgUrl, i) => (
                      <div
                        key={i}
                        onClick={() => setEnlargedImage(imgUrl)}
                        className="cursor-pointer relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 shrink-0 group"
                      >
                        <img
                          src={imgUrl}
                          alt={`Design ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Add-on Items Display */}
              {order.addons && order.addons.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-white space-y-2">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider block">
                    Extra Items & Party Essentials
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {order.addons.map((addon) => (
                      <span
                        key={addon.id}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-medium"
                      >
                        {addon.name} (+₹{addon.price})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fulfilment & Customer Details */}
              <div className="p-3.5 rounded-2xl bg-white/80 text-xs space-y-2">
                {order.customer_name && (
                  <div className="flex items-center justify-between text-zinc-800">
                    <div>
                      <span className="text-zinc-400 font-medium">Customer: </span>
                      <span className="font-semibold">{order.customer_name}</span>
                    </div>
                    {order.customer_phone && (
                      <span className="text-zinc-600 font-mono">
                        +{order.customer_phone}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-start gap-2 text-zinc-700">
                  <MapPin className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />
                  <div>
                    <div className="font-semibold text-zinc-900">
                      {order.fulfilment_type === "delivery"
                        ? "Home Delivery Address"
                        : "Pickup Address"}
                    </div>
                    <div className="text-zinc-500 mt-0.5">
                      {order.fulfilment_type === "delivery"
                        ? order.delivery_address || "Provided to baker"
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

              {/* Financial Ledger */}
              <div className="pt-3 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                <span className="text-zinc-600">Balance due at handover:</span>
                <span className="text-lg font-bold text-zinc-950">
                  ₹{order.balance_amount}
                </span>
              </div>
            </div>

            {/* Voucher Action Buttons */}
            <div className="space-y-2.5 pt-1 print:hidden">
              <button
                onClick={handleDownloadPdf}
                className="w-full py-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2.5 shadow-xs"
              >
                <Download className="w-4 h-4 text-white" />
                Download Receipt (PDF)
              </button>

              <button
                onClick={handleSendSimpleWhatsApp}
                className="w-full py-3.5 rounded-2xl bg-[#f4f4f5] hover:bg-zinc-200/70 text-zinc-800 font-semibold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 fill-emerald-600 shrink-0" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span>Share Note via WhatsApp (Optional)</span>
              </button>
            </div>
          </div>
        ) : step === 1 ? (
          /* ===================================================================
              STEP 1: CAKE PREVIEW + "MESSAGE ON CAKE"
              =================================================================== */
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Hero Cake Spec Card */}
            <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Reserved Cake
                  </span>
                  <h2 className="text-lg font-bold text-zinc-950 mt-0.5 truncate">
                    {order.weight} {order.flavour}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {order.is_eggless ? "100% Eggless" : "With Egg"} • {order.time_slot}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Total
                  </span>
                  <div className="text-lg font-bold text-zinc-950">
                    ₹{order.total_price}
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-zinc-200/60 flex items-center justify-between text-xs text-zinc-600">
                <span>Advance to lock slot:</span>
                <span className="font-bold text-zinc-950">₹{order.token_amount}</span>
              </div>
            </div>

            {/* Message on Cake Card */}
            <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-zinc-950">
                    Write a message on the cake?
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    {cakeMessage.length}/35
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Leave blank if you prefer a clean plain top.
                </p>
              </div>

              <input
                type="text"
                maxLength={35}
                placeholder="e.g. Happy Birthday Aarav!"
                value={cakeMessage}
                onChange={(e) => setCakeMessage(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-white text-zinc-950 text-[16px] sm:text-sm placeholder-zinc-400 focus:outline-none font-medium"
              />

              {/* Live Visual Ribbon Preview */}
              <div className="pt-0.5 flex items-center gap-2 text-xs">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 shrink-0">
                  Preview:
                </span>
                <span className="px-3 py-1 rounded-lg bg-white text-zinc-950 font-semibold italic text-xs truncate max-w-[200px]">
                  {cakeMessage.trim() ? `"${cakeMessage.trim()}"` : "Plain Top (No Text)"}
                </span>
              </div>

              {/* Quick Helper Chips */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none text-xs">
                {["Happy Birthday", "Happy Anniversary", "Best Wishes"].map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCakeMessage(preset)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 text-[11px] font-medium transition-colors shrink-0"
                    >
                      +{preset}
                    </button>
                  )
                )}
                {cakeMessage && (
                  <button
                    type="button"
                    onClick={() => setCakeMessage("")}
                    className="px-2.5 py-1 rounded-lg bg-zinc-200/70 hover:bg-zinc-200 text-zinc-600 text-[11px] font-medium transition-colors shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : step === 2 ? (
          /* ===================================================================
              STEP 2: MULTIPLE REFERENCE DESIGN PHOTOS + CONTACT DETAILS
              =================================================================== */
          <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
            {/* Multiple Reference Photos Card */}
            <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-bold text-zinc-950 block">
                    Reference Design Photos
                  </label>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Attach cake design or theme ideas (up to 4).
                  </p>
                </div>
                <span className="text-[10px] font-medium text-zinc-400 bg-white px-2 py-0.5 rounded-full shrink-0">
                  Optional
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />

              {referenceImages.length > 0 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {referenceImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 group border border-zinc-200/60"
                    >
                      <img
                        src={imgUrl}
                        alt={`Reference ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeReferenceImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px]"
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {referenceImages.length < 4 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-950 transition-colors shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[10px] font-medium mt-0.5">Add</span>
                    </button>
                  )}
                </div>
              )}

              {referenceImages.length === 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 px-4 rounded-xl bg-white hover:bg-zinc-50 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.99] text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-800">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900">
                      Tap to upload photos
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Screenshot from Instagram, Pinterest, or gallery
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Customer Contact Details */}
            <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3">
              <div>
                <label className="text-sm font-bold text-zinc-950 block">
                  Your Contact Details
                </label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  For order coordination and delivery updates.
                </p>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Your Full Name (e.g. Rohan Sharma)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-white text-zinc-950 text-[16px] sm:text-sm placeholder-zinc-400 focus:outline-none font-medium"
                />

                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit WhatsApp / Phone Number"
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-4 py-3.5 rounded-xl bg-white text-zinc-950 text-[16px] sm:text-sm placeholder-zinc-400 focus:outline-none font-medium"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ===================================================================
              STEP 3: FULFILMENT, PARTY ADD-ONS & SUMMARY
              =================================================================== */
          <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
            {/* Fulfilment Toggle Card */}
            <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3">
              <label className="text-xs font-semibold text-zinc-950 block">
                Fulfilment Method
              </label>

              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-200/60">
                <button
                  type="button"
                  onClick={() => setFulfilmentType("pickup")}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
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
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    fulfilmentType === "delivery"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  Home Delivery
                </button>
              </div>

              {fulfilmentType === "pickup" ? (
                <div className="flex items-start gap-2 pt-1 text-xs text-zinc-600">
                  <MapPin className="w-4 h-4 shrink-0 text-zinc-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-zinc-950">Store: </span>
                    <span>{baker.pickup_address}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Complete flat, street & area address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white text-zinc-950 text-[16px] sm:text-sm placeholder-zinc-400 focus:outline-none font-medium"
                  />
                </div>
              )}
            </div>

            {/* Add-on Essentials Chips */}
            <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-zinc-950 block">
                    Add Party Essentials
                  </label>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Tap to add candles, poppers or cutlery
                  </p>
                </div>
                {selectedAddons.length > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                    +{selectedAddons.length} added (+₹{addonsTotal})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-0.5">
                {AVAILABLE_ADDONS.map((item) => {
                  const isSelected = selectedAddons.some((a) => a.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleAddon(item)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 ${
                        isSelected
                          ? "bg-zinc-950 text-white shadow-xs"
                          : "bg-white text-zinc-800 hover:bg-zinc-100"
                      }`}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>{item.name}</span>
                      <span
                        className={`text-[10px] ${
                          isSelected ? "text-zinc-300" : "text-zinc-400 font-medium"
                        }`}
                      >
                        ₹{item.price}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-zinc-200/60">
                <input
                  type="text"
                  placeholder="Candle numbers or special requests (optional)"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Order Price Ledger */}
            <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-600">
                <span>Cake Base:</span>
                <span className="font-semibold text-zinc-900">₹{basePrice}</span>
              </div>

              {selectedAddons.length > 0 && (
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Add-ons ({selectedAddons.length}):</span>
                  <span className="font-semibold text-zinc-900">+₹{addonsTotal}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-zinc-950 font-bold border-t border-zinc-200/60 pt-2">
                <span>Total Amount:</span>
                <span className="text-sm">₹{finalTotalPrice}</span>
              </div>

              <div className="flex items-center justify-between text-emerald-800 font-semibold bg-emerald-50 px-3 py-2 rounded-xl">
                <span>Advance Token to Lock:</span>
                <span className="text-sm">₹{tokenAmount}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-500 pt-0.5">
                <span>Balance at Handover:</span>
                <span className="font-semibold text-zinc-900">₹{finalBalanceAmount}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =======================================================================
          STICKY 1-THUMB BOTTOM APP BAR (ALWAYS ANCHORED AT THUMB LEVEL)
          ======================================================================= */}
      {!isPaid && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-zinc-100 px-5 py-3.5 max-w-md mx-auto print:hidden">
          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-xs"
            >
              <span>Continue to Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-12 h-12 rounded-2xl bg-[#f4f4f5] text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 flex items-center justify-center transition-colors shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 h-12 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Continue to Payment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-12 h-12 rounded-2xl bg-[#f4f4f5] text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 flex items-center justify-center transition-colors shrink-0"
                  title="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1">
                  <RainbowButton
                    onClick={handlePayAndConfirm}
                    className="w-full h-12 text-sm font-semibold rounded-2xl flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Pay ₹{tokenAmount} Token via UPI
                  </RainbowButton>
                </div>
              </div>
              <p className="text-[10px] text-center text-zinc-400 font-medium">
                GPay • PhonePe • Paytm • CRED • Instant Lock
              </p>
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          DESKTOP QR / UPI MODAL (WHEN ACCESSED ON LAPTOP/DESKTOP)
          ======================================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-zinc-950">
                Scan & Pay ₹{tokenAmount}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Scan with any UPI app on your phone
              </p>
            </div>

            <div className="w-48 h-48 mx-auto bg-[#f4f4f5] p-3 rounded-2xl flex items-center justify-center">
              <img
                src={qrCodeUrl}
                alt="UPI QR Code"
                className="w-full h-full rounded-xl object-contain"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopyUpi}
                className="w-full py-2.5 px-3 rounded-xl bg-[#f4f4f5] text-xs font-semibold text-zinc-800 hover:bg-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedUpi ? "UPI ID Copied!" : `Copy ${baker.upi_id}`}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-full py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-950"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          ENLARGED IMAGE MODAL
          ======================================================================= */}
      {enlargedImage && (
        <div
          onClick={() => setEnlargedImage(null)}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer animate-in fade-in duration-150 print:hidden"
        >
          <div className="relative max-w-sm max-h-[80vh] w-full p-2 bg-white rounded-2xl">
            <img
              src={enlargedImage}
              alt="Enlarged Reference"
              className="w-full h-auto max-h-[75vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
