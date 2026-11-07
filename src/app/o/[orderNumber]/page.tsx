"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
import { CheckoutPageSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { RainbowButton } from "@/components/ui/rainbow-button";
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

  // Synchronous Cache Initialization (Zero Skeleton Flash!)
  const initialOrder = useMemo(() => {
    if (typeof window === "undefined" || !orderNumber) return null;
    return getOrderByNumber(orderNumber) || null;
  }, [orderNumber]);

  const initialBaker = useMemo(() => {
    if (typeof window === "undefined" || !initialOrder) return null;
    const bakers = getLocalBakers();
    return bakers.find((b) => b.id === initialOrder.baker_id) || null;
  }, [initialOrder]);

  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [baker, setBaker] = useState<Baker | null>(initialBaker);
  const [isLoading, setIsLoading] = useState(!initialOrder);

  const availableAddons =
    baker?.addon_items && baker.addon_items.length > 0
      ? baker.addon_items
      : DEFAULT_ADDONS;

  // Essential Form Fields (Pre-populated from cache if present)
  const [cakeMessage, setCakeMessage] = useState(initialOrder?.cake_message || "");
  const [showCakeMessageInput, setShowCakeMessageInput] = useState(
    Boolean(initialOrder?.cake_message)
  );
  const [referenceImages, setReferenceImages] = useState<string[]>(() => {
    if (!initialOrder) return [];
    if (initialOrder.reference_images && initialOrder.reference_images.length > 0) {
      return initialOrder.reference_images;
    }
    if (initialOrder.reference_image) {
      return [initialOrder.reference_image];
    }
    return [];
  });
  const [customerName, setCustomerName] = useState(initialOrder?.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(initialOrder?.customer_phone || "");
  const [fulfilmentType, setFulfilmentType] = useState<"pickup" | "delivery">(
    initialOrder?.fulfilment_type || "pickup"
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    initialOrder?.delivery_address || ""
  );
  const [selectedAddons, setSelectedAddons] = useState<
    Array<{ id: string; name: string; price: number }>
  >(initialOrder?.addons || []);
  const [showAddonsSection, setShowAddonsSection] = useState(
    Boolean(initialOrder?.addons && initialOrder.addons.length > 0)
  );

  // Payment & Modal States
  const [isPaid, setIsPaid] = useState(() => {
    if (!initialOrder) return false;
    return (
      initialOrder.status === "confirmed" ||
      initialOrder.status === "baked" ||
      initialOrder.status === "completed"
    );
  });
  const [isPaying, setIsPaying] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const { showToast } = useToast();
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
        if (found.cake_message) setShowCakeMessageInput(true);
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
    if (!order || !baker || isPaying) return;

    if (fulfilmentType === "delivery" && !deliveryAddress.trim()) {
      showToast("Please enter complete delivery address", "error");
      return;
    }

    setIsPaying(true);
    showToast("Locking your slot & opening UPI...", "info");

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

    const upiLink = buildUpiIntentLink({
      upiId: baker.upi_id,
      name: baker.name,
      amount: tokenAmount,
      orderNumber: order.order_number,
    });

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setTimeout(() => {
        setIsPaid(true);
        setIsPaying(false);
        window.location.href = upiLink;
      }, 350);
    } else {
      setTimeout(() => {
        setIsPaid(true);
        setIsPaying(false);
        setShowQrModal(true);
      }, 350);
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleSendSimpleWhatsApp = () => {
    if (!order || !baker) return;
    showToast("Opening WhatsApp...", "info");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const msg = `Hi ${baker.name}, I have confirmed Order #${order.order_number} (${customerName || "Customer"}) and paid ₹${tokenAmount} token advance.\n\nReceipt: ${origin}/o/${order.order_number}`;
    const waUrl = buildWhatsAppLink(baker.phone, msg);
    window.open(waUrl, "_blank");
  };

  const handleCopyUpi = () => {
    if (!baker) return;
    navigator.clipboard.writeText(baker.upi_id);
    setCopiedUpi(true);
    showToast("UPI ID Copied to clipboard!", "success");
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // =========================================================================
  // HIGH-CRAFT SHIMMER SKELETON
  // =========================================================================
  if (isLoading) {
    return <CheckoutPageSkeleton />;
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
              VIEW: PHONEPE-STYLE CLEAN PAYMENT SUCCESS & RECEIPT
              =================================================================== */
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 ease-out">
            {/* PhonePe Celebratory Hero */}
            <div className="flex flex-col items-center text-center pt-4 pb-2 space-y-2 print:hidden">
              {/* Animated Success Icon with Pulse Ring */}
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-in zoom-in-75 duration-300 ease-out">
                  <Check className="w-9 h-9 stroke-[3]" />
                </div>
                <div className="absolute w-20 h-20 rounded-full border-2 border-emerald-500/25 animate-ping opacity-30 pointer-events-none" />
              </div>

              {/* Amount & Status Headline */}
              <div className="space-y-1">
                <div className="text-3xl font-extrabold text-zinc-950 tracking-tight font-sans">
                  ₹{order.token_amount}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Booking Advance Confirmed
                </div>
                <p className="text-xs text-zinc-500 pt-0.5">
                  Slot locked with <span className="font-semibold text-zinc-800">{baker.name}</span>
                </p>
              </div>
            </div>

            {/* The PhonePe Summary Card (Kaam Ki Cheeje) */}
            <div
              id="receipt-voucher"
              className="rounded-3xl bg-[#f4f4f5] border border-zinc-200/80 p-4 space-y-4 shadow-xs print:bg-white print:border-none print:p-0"
            >
              {/* Cake Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Order #{order.order_number}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                    Token Paid ✓
                  </span>
                </div>
                <h3 className="text-xl font-bold text-zinc-950 leading-snug">
                  {order.weight} {order.flavour}
                </h3>
                <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-zinc-200/60 text-[11px] font-semibold text-zinc-800">
                    {order.is_eggless ? "100% Eggless" : "With Egg"}
                  </span>
                  <span>•</span>
                  <span>{order.delivery_date}</span>
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

                {/* Financial Ledger (PhonePe Style Clear Split) */}
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
                    <div className="space-y-0.5">
                      <div>Balance at Handover:</div>
                      <div className="text-[10px] text-zinc-400 font-normal">
                        Pay when you receive the cake
                      </div>
                    </div>
                    <span className="text-lg text-zinc-950 font-extrabold">₹{order.balance_amount}</span>
                  </div>
                </div>
              </div>

            {/* Action Buttons (WhatsApp + Save Receipt) */}
            <div className="space-y-2 pt-1 print:hidden">
              <button
                onClick={handleSendSimpleWhatsApp}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span>Notify {baker.name} on WhatsApp</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                className="w-full py-3 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200/80 text-zinc-800 font-semibold text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-2xs"
              >
                <Download className="w-4 h-4 text-zinc-600" />
                <span>Save PDF Receipt</span>
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

            {/* CARD 2: HANDOVER & DISPATCH DETAILS */}
            <div className="p-4 rounded-3xl bg-[#f4f4f5] space-y-3">
              {/* Handover Toggle: Pickup vs Delivery */}
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

              {/* Contextual Handover Content */}
              {fulfilmentType === "delivery" ? (
                /* DELIVERY BLOCK: Exactly what baker needs for dispatch! */
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Delivery Address & Contact
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">For delivery rider</span>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Complete Delivery Address (Flat/House, Landmark)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 font-medium"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Receiver's Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 font-medium"
                    />
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Contact No. for Delivery"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 font-mono font-medium"
                    />
                  </div>
                </div>
              ) : (
                /* PICKUP BLOCK: Zero address burden on customer! */
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 space-y-2">
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-zinc-900 text-xs">
                        Pickup from:
                      </div>
                      <div className="text-zinc-600 text-xs leading-relaxed mt-0.5">
                        {baker.pickup_address}
                      </div>
                      {baker.google_maps_url && (
                        <a
                          href={baker.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-1 hover:underline"
                        >
                          <span>Open in Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Clean Optional Booking Name (Single line) */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Your Name (for cake box tag)"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200/60 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none font-medium"
                    />
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="WhatsApp No."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                      className="w-32 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200/60 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none font-mono font-medium"
                    />
                  </div>
                </div>
              )}

              {/* CAKE CUSTOMIZATION BLOCK (SMART & NON-INTRUSIVE) */}
              <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/80 space-y-2.5">
                {/* Text on Cake (Either active input or 1-tap chip) */}
                {showCakeMessageInput || cakeMessage ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                      <span>Piped Message on Cake:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCakeMessage("");
                          setShowCakeMessageInput(false);
                        }}
                        className="text-zinc-400 hover:text-zinc-600 text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={40}
                      autoFocus={!cakeMessage}
                      placeholder="e.g. Happy Birthday Rohan"
                      value={cakeMessage}
                      onChange={(e) => setCakeMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 font-medium"
                    />
                  </div>
                ) : null}

                {/* Clean 1-Tap Feature Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {!showCakeMessageInput && !cakeMessage && (
                    <button
                      type="button"
                      onClick={() => setShowCakeMessageInput(true)}
                      className="px-2.5 py-1.5 rounded-xl border border-zinc-200/80 hover:bg-zinc-50 text-[11px] font-medium text-zinc-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-zinc-500" />
                      <span>Text on Cake</span>
                    </button>
                  )}

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
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                      referenceImages.length > 0
                        ? "bg-zinc-950 text-white border-zinc-950"
                        : "border-zinc-200/80 hover:bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    <Camera className="w-3 h-3 shrink-0" />
                    <span>
                      {referenceImages.length > 0
                        ? `${referenceImages.length} Photo Added`
                        : "Reference Photo"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddonsSection(!showAddonsSection)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                      selectedAddons.length > 0 || showAddonsSection
                        ? "bg-zinc-950 text-white border-zinc-950"
                        : "border-zinc-200/80 hover:bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    <Plus className="w-3 h-3 shrink-0" />
                    <span>
                      {selectedAddons.length > 0
                        ? `${selectedAddons.length} Party Items`
                        : "Party Items"}
                    </span>
                  </button>
                </div>

                {/* Uploaded Reference Photos Thumbnail Strip */}
                {referenceImages.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
                    {referenceImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200"
                      >
                        <img
                          src={imgUrl}
                          alt={`Design ${idx + 1}`}
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
                        className="w-14 h-14 rounded-xl bg-zinc-50 border border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-900 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-medium">Add</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

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
          <RainbowButton
            disabled={isPaying}
            onClick={handlePayAndConfirm}
            className="w-full h-12 rounded-2xl font-bold text-sm shadow-md"
          >
            {isPaying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Opening UPI App...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Pay ₹{tokenAmount} Token via UPI</span>
              </>
            )}
          </RainbowButton>
          <p className="text-[10px] text-zinc-400 text-center mt-1.5 font-medium">
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