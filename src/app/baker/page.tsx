"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Baker, Order, FlavourItem, AddonItem } from "@/lib/types";
import {
  getLocalBakers,
  getBakerByToken,
  getLocalOrders,
  saveLocalOrder,
  saveLocalBaker,
  deleteLocalOrder,
  fetchRemoteOrdersByBaker,
  getActiveBakerSlug,
  setActiveBakerSlug,
  DEFAULT_FLAVOURS,
  DEFAULT_ADDONS,
  STORAGE_KEYS,
  CAKEFLOW_EVENTS,
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
  Settings,
  Edit2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { KitchenCardSkeleton } from "@/components/ui/skeleton";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { MovingBorderButton } from "@/components/ui/moving-border";
import { useToast } from "@/components/ui/toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  playTapSound,
  playPopSound,
  playSuccessSound,
  playBakeSound,
} from "@/lib/sounds";

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

const calculateDeliverySlot = (hourVal: number | string, ampm: "AM" | "PM") => {
  let h = typeof hourVal === "string" ? parseInt(hourVal, 10) : hourVal;
  if (isNaN(h) || h < 1) h = 1;
  if (h > 12) h = 12;

  let nextH = h + 1;
  let nextAmPm = ampm;

  if (h === 11) {
    nextH = 12;
    nextAmPm = ampm === "AM" ? "PM" : "AM";
  } else if (h === 12) {
    nextH = 1;
    nextAmPm = ampm;
  }

  return `${h}:00 ${ampm} - ${nextH}:00 ${nextAmPm}`;
};

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
  const { showToast } = useToast();
  const params = useParams();
  const searchParams = useSearchParams();

  // 1. Resolve Baker Slug: [slug] route param -> ?slug= query -> active stored slug -> default 'sugarbloom'
  const resolvedSlug = (
    (params?.slug as string) ||
    searchParams?.get("slug") ||
    getActiveBakerSlug()
  ).toLowerCase().trim();

  // Synchronous Cache Initialization (Zero Skeleton Flash!)
  const [baker, setBaker] = useState<Baker | null>(() => {
    if (typeof window === "undefined") return null;
    const all = getLocalBakers();
    const activeSlug = getActiveBakerSlug();
    const found = all.find((b) => b.slug.toLowerCase() === activeSlug || b.id === activeSlug);
    if (found) return found;
    return all.length > 0 ? all[0] : null;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === "undefined") return [];
    const all = getLocalOrders();
    const allBakers = getLocalBakers();
    const activeSlug = getActiveBakerSlug();
    const current = allBakers.find((b) => b.slug.toLowerCase() === activeSlug) || allBakers[0];
    return current ? all.filter((o) => o.baker_id === current.id) : all;
  });

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bakingOrderId, setBakingOrderId] = useState<string | null>(null);
  
  // Clean 3-Mode Filter: "kitchen" (Active to-bake & ready) vs "waiting" vs "delivered"
  const [statusFilter, setStatusFilter] = useState<"kitchen" | "waiting" | "delivered">("kitchen");

  // Order Builder Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [proofOrder, setProofOrder] = useState<Order | null>(null);
  const [enlargedKitchenImage, setEnlargedKitchenImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [expandedWaitingOrderId, setExpandedWaitingOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  // Edit Order Modal State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editWeight, setEditWeight] = useState("1 Kg");
  const [editFlavour, setEditFlavour] = useState("");
  const [editIsEggless, setEditIsEggless] = useState(true);
  const [editTotalPrice, setEditTotalPrice] = useState<number>(0);
  const [editTokenAmount, setEditTokenAmount] = useState<number>(0);
  const [editDeliveryDate, setEditDeliveryDate] = useState("");
  const [editTimeSlot, setEditTimeSlot] = useState("");
  const [editCakeMessage, setEditCakeMessage] = useState("");
  const [editSpecialNotes, setEditSpecialNotes] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editFulfilmentType, setEditFulfilmentType] = useState<"pickup" | "delivery">("pickup");
  const [editDeliveryAddress, setEditDeliveryAddress] = useState("");

  // Quick Order Preset Fields
  const [weight, setWeight] = useState("1 Kg");
  const [flavour, setFlavour] = useState("Chocolate Truffle");
  const [customFlavour, setCustomFlavour] = useState("");
  const [isEggless, setIsEggless] = useState(true);
  const [totalPrice, setTotalPrice] = useState<number>(700);
  const [customPrice, setCustomPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedHour, setSelectedHour] = useState("6");
  const [selectedAmPm, setSelectedAmPm] = useState<"AM" | "PM">("PM");
  const [timeSlot, setTimeSlot] = useState("6:00 PM - 7:00 PM");
  const [customTime, setCustomTime] = useState("");

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"menu" | "addons" | "store">("menu");
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Menu Items State
  const [menuItems, setMenuItems] = useState<FlavourItem[]>(DEFAULT_FLAVOURS);
  const [isEditingFlavour, setIsEditingFlavour] = useState(false);
  const [editingFlavourId, setEditingFlavourId] = useState<string | null>(null);
  const [flavourNameInput, setFlavourNameInput] = useState("");
  const [flavourPricesInput, setFlavourPricesInput] = useState<{ [w: string]: number }>({
    "0.5 Kg": 450,
    "1 Kg": 750,
    "1.5 Kg": 1100,
    "2 Kg": 1400,
  });

  // Addon Items State
  const [addonItems, setAddonItems] = useState<AddonItem[]>(DEFAULT_ADDONS);
  const [isEditingAddon, setIsEditingAddon] = useState(false);
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [addonNameInput, setAddonNameInput] = useState("");
  const [addonPriceInput, setAddonPriceInput] = useState(50);

  // Store Profile State
  const [storeNameInput, setStoreNameInput] = useState("");
  const [storePhoneInput, setStorePhoneInput] = useState("");
  const [storeUpiInput, setStoreUpiInput] = useState("");
  const [storeAddressInput, setStoreAddressInput] = useState("");
  const [storeTokenInput, setStoreTokenInput] = useState(100);
  const [storeMaxDailyInput, setStoreMaxDailyInput] = useState(4);

  // Sync menu, addons & profile from baker when baker changes
  useEffect(() => {
    if (baker) {
      const items =
        baker.menu_items && baker.menu_items.length > 0
          ? baker.menu_items
          : DEFAULT_FLAVOURS;
      setMenuItems(items);

      const extras =
        baker.addon_items && baker.addon_items.length > 0
          ? baker.addon_items
          : DEFAULT_ADDONS;
      setAddonItems(extras);

      setStoreNameInput(baker.name || "");
      setStorePhoneInput(baker.phone || "");
      setStoreUpiInput(baker.upi_id || "");
      setStoreAddressInput(baker.pickup_address || "");
      setStoreTokenInput(baker.default_token_amount || 100);
      setStoreMaxDailyInput(baker.max_daily_cakes || 4);
    }
  }, [baker]);

  useEffect(() => {
    setMounted(true);
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
      setIsLoading(false);
      fetchRemoteOrdersByBaker(currentBaker.id).then((remote) => {
        if (remote && remote.length > 0) setOrders(remote);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshOrders = async (bakerId: string) => {
    const all = getLocalOrders();
    const bakerOrders = all.filter((o) => o.baker_id === bakerId);
    setOrders(bakerOrders);
    const remote = await fetchRemoteOrdersByBaker(bakerId);
    if (remote && remote.length > 0) setOrders(remote);
  };

  // 0. Initial Hydration & Multi-Baker Isolation (Binds to specific slug)
  useEffect(() => {
    const all = getLocalOrders();
    const allBakers = getLocalBakers();

    let current = allBakers.find(
      (b) =>
        b.slug.toLowerCase() === resolvedSlug ||
        b.id.toLowerCase() === resolvedSlug
    );

    // If new baker slug visited (e.g. /baker/pooja-cakes or ?slug=pooja-cakes), dynamically initialize & isolate
    if (!current && resolvedSlug && resolvedSlug !== "sugarbloom") {
      const cleanName = resolvedSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      current = {
        id: `baker_${resolvedSlug}`,
        slug: resolvedSlug,
        name: `${cleanName} Studio`,
        tagline: "Freshly Baked Custom Artisan Cakes",
        phone: "919876543210",
        upi_id: `${resolvedSlug}@okhdfcbank`,
        pickup_address: "Shop 1, Main Road, City",
        google_maps_url: "",
        secret_token: `${resolvedSlug}_pos_key`,
        default_token_amount: 100,
        pin: "1234",
        max_daily_cakes: 4,
        menu_items: DEFAULT_FLAVOURS,
        addon_items: DEFAULT_ADDONS,
        created_at: new Date().toISOString(),
      };
      saveLocalBaker(current);
    }

    if (!current) {
      current = allBakers[0];
    }

    if (current) {
      setBaker(current);
      setActiveBakerSlug(current.slug);
      setOrders(all.filter((o) => o.baker_id === current.id));
    }
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [resolvedSlug]);

  const handleMarkAsBaked = (orderId: string) => {
    playBakeSound();
    setBakingOrderId(orderId);
    setTimeout(() => {
      updateOrderStatus(orderId, "baked");
      setBakingOrderId(null);
    }, 450);
  };

  // 1. INSTANT REACTIVE SYNC: In-memory Event Bus (0ms) + Storage match + Non-destructive background sync
  useEffect(() => {
    if (!baker) return;

    // A. Local State Loader
    const loadCurrentOrders = () => {
      const all = getLocalOrders();
      setOrders(all.filter((o) => o.baker_id === baker.id));
    };

    // B. In-Memory Reactive Event Bus (0ms instant intra-app update)
    const handleOrdersUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ orders?: Order[] }>;
      if (customEvent.detail?.orders) {
        setOrders(customEvent.detail.orders.filter((o) => o.baker_id === baker.id));
      } else {
        loadCurrentOrders();
      }
    };
    window.addEventListener(CAKEFLOW_EVENTS.ORDERS_UPDATED, handleOrdersUpdated);

    // C. Cross-tab Storage Listener (Fires when another tab writes to cakeflow_orders_v1)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.ORDERS || !e.key) {
        loadCurrentOrders();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // D. Non-destructive background sync on focus and gentle 10s interval
    const syncCloud = async () => {
      const remote = await fetchRemoteOrdersByBaker(baker.id);
      if (remote && remote.length > 0) {
        setOrders(remote);
      }
    };

    window.addEventListener("focus", syncCloud);
    const backgroundInterval = setInterval(syncCloud, 10000);

    return () => {
      window.removeEventListener(CAKEFLOW_EVENTS.ORDERS_UPDATED, handleOrdersUpdated);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", syncCloud);
      clearInterval(backgroundInterval);
    };
  }, [baker]);

  const handleStartNewOrder = () => {
    const defaultFlavour = menuItems[0]?.name || "Chocolate Truffle";
    const defaultWeight = "1 Kg";
    const price = menuItems[0]?.prices[defaultWeight] || 700;

    setFlavour(defaultFlavour);
    setWeight(defaultWeight);
    setTotalPrice(price);
    setCustomPrice(price.toString());
    setCustomFlavour("");
    setIsEggless(true);
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setSelectedHour("6");
    setSelectedAmPm("PM");
    setTimeSlot("6:00 PM - 7:00 PM");
    setCustomTime("");
    setCreatedOrder(null);
    setIsCreating(true);
  };

  const handleFlavourChange = (newFlavour: string) => {
    setFlavour(newFlavour);
    if (newFlavour !== "Custom / Other") {
      setCustomFlavour("");
      const item = menuItems.find((m) => m.name === newFlavour);
      if (item && item.prices[weight]) {
        const autoPrice = item.prices[weight];
        setTotalPrice(autoPrice);
        setCustomPrice(autoPrice.toString());
      }
    }
  };

  const handleWeightChange = (newWeight: string) => {
    setWeight(newWeight);
    const item = menuItems.find((m) => m.name === flavour);
    if (item && item.prices[newWeight]) {
      const autoPrice = item.prices[newWeight];
      setTotalPrice(autoPrice);
      setCustomPrice(autoPrice.toString());
    }
  };

  const handleOpenAddFlavour = () => {
    setEditingFlavourId(null);
    setFlavourNameInput("");
    setFlavourPricesInput({
      "0.5 Kg": 450,
      "1 Kg": 750,
      "1.5 Kg": 1100,
      "2 Kg": 1400,
    });
    setIsEditingFlavour(true);
  };

  const handleOpenEditFlavour = (item: FlavourItem) => {
    setEditingFlavourId(item.id);
    setFlavourNameInput(item.name);
    setFlavourPricesInput({
      "0.5 Kg": item.prices["0.5 Kg"] || 400,
      "1 Kg": item.prices["1 Kg"] || 700,
      "1.5 Kg": item.prices["1.5 Kg"] || 1000,
      "2 Kg": item.prices["2 Kg"] || 1300,
    });
    setIsEditingFlavour(true);
  };

  const handleSaveFlavourItem = () => {
    const trimmed = flavourNameInput.trim();
    if (!trimmed) return;

    let updated: FlavourItem[];
    if (editingFlavourId) {
      updated = menuItems.map((m) =>
        m.id === editingFlavourId
          ? { ...m, name: trimmed, prices: { ...flavourPricesInput } }
          : m
      );
      showToast("Flavour Updated ✓", "success");
    } else {
      const newItem: FlavourItem = {
        id: `f-${Date.now()}`,
        name: trimmed,
        prices: { ...flavourPricesInput },
      };
      updated = [...menuItems, newItem];
      showToast("New Flavour Added ✓", "success");
    }
    setMenuItems(updated);
    setIsEditingFlavour(false);

    if (baker) {
      const updatedBaker: Baker = { ...baker, menu_items: updated };
      setBaker(updatedBaker);
      saveLocalBaker(updatedBaker);
    }
  };

  const handleDeleteFlavour = (id: string) => {
    if (menuItems.length <= 1) {
      showToast("You must keep at least 1 flavour in your menu!", "error");
      return;
    }
    const updated = menuItems.filter((m) => m.id !== id);
    setMenuItems(updated);
    if (baker) {
      const updatedBaker: Baker = { ...baker, menu_items: updated };
      setBaker(updatedBaker);
      saveLocalBaker(updatedBaker);
    }
    showToast("Flavour Deleted ✓", "info");
  };

  const handleOpenAddAddon = () => {
    setEditingAddonId(null);
    setAddonNameInput("");
    setAddonPriceInput(50);
    setIsEditingAddon(true);
  };

  const handleOpenEditAddon = (item: AddonItem) => {
    setEditingAddonId(item.id);
    setAddonNameInput(item.name);
    setAddonPriceInput(item.price);
    setIsEditingAddon(true);
  };

  const handleSaveAddonItem = () => {
    const trimmed = addonNameInput.trim();
    if (!trimmed) return;

    let updated: AddonItem[];
    if (editingAddonId) {
      updated = addonItems.map((a) =>
        a.id === editingAddonId
          ? { ...a, name: trimmed, price: Number(addonPriceInput) || 0 }
          : a
      );
      showToast("Party Item Updated ✓", "success");
    } else {
      const newItem: AddonItem = {
        id: `a-${Date.now()}`,
        name: trimmed,
        price: Number(addonPriceInput) || 0,
      };
      updated = [...addonItems, newItem];
      showToast("New Party Item Added ✓", "success");
    }
    setAddonItems(updated);
    setIsEditingAddon(false);

    if (baker) {
      const updatedBaker: Baker = {
        ...baker,
        menu_items: menuItems,
        addon_items: updated,
      };
      setBaker(updatedBaker);
      saveLocalBaker(updatedBaker);
    }
  };

  const handleDeleteAddon = (id: string) => {
    const updated = addonItems.filter((a) => a.id !== id);
    setAddonItems(updated);
    if (baker) {
      const updatedBaker: Baker = {
        ...baker,
        menu_items: menuItems,
        addon_items: updated,
      };
      setBaker(updatedBaker);
      saveLocalBaker(updatedBaker);
    }
    showToast("Party Item Deleted ✓", "info");
  };

  const handleSaveStoreProfile = () => {
    if (!baker) return;
    const updatedBaker: Baker = {
      ...baker,
      name: storeNameInput.trim() || baker.name,
      phone: storePhoneInput.trim().replace(/\D/g, "") || baker.phone,
      upi_id: storeUpiInput.trim() || baker.upi_id,
      pickup_address: storeAddressInput.trim() || baker.pickup_address,
      default_token_amount: Number(storeTokenInput) || 100,
      max_daily_cakes: Number(storeMaxDailyInput) || 4,
      menu_items: menuItems,
      addon_items: addonItems,
    };
    setBaker(updatedBaker);
    saveLocalBaker(updatedBaker);
    showToast("Profile & Settings Saved ✓", "success");
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 2000);
  };

  const handleOpenEditOrder = (ord: Order) => {
    playTapSound();
    setEditingOrder(ord);
    setEditWeight(ord.weight);
    setEditFlavour(ord.flavour);
    setEditIsEggless(ord.is_eggless);
    setEditTotalPrice(ord.total_price);
    setEditTokenAmount(ord.token_amount);
    setEditDeliveryDate(ord.delivery_date);
    setEditTimeSlot(ord.time_slot);
    setEditCakeMessage(ord.cake_message || "");
    setEditSpecialNotes(ord.special_notes || "");
    setEditCustomerName(ord.customer_name || "");
    setEditCustomerPhone(ord.customer_phone || "");
    setEditFulfilmentType(ord.fulfilment_type || "pickup");
    setEditDeliveryAddress(ord.delivery_address || "");
  };

  const handleSaveEditedOrder = () => {
    if (!editingOrder) return;
    playSuccessSound();
    const balance = Math.max(0, editTotalPrice - editTokenAmount);
    const updated: Order = {
      ...editingOrder,
      weight: editWeight,
      flavour: editFlavour.trim() || editingOrder.flavour,
      is_eggless: editIsEggless,
      total_price: editTotalPrice,
      token_amount: editTokenAmount,
      balance_amount: balance,
      delivery_date: editDeliveryDate,
      time_slot: editTimeSlot.trim() || editingOrder.time_slot,
      cake_message: editCakeMessage.trim() || undefined,
      special_notes: editSpecialNotes.trim() || undefined,
      customer_name: editCustomerName.trim() || undefined,
      customer_phone: editCustomerPhone.trim() || undefined,
      fulfilment_type: editFulfilmentType,
      delivery_address:
        editFulfilmentType === "delivery" ? editDeliveryAddress.trim() : undefined,
    };

    // 1. Optimistic React State
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    // 2. Local Storage + Cloud sync
    saveLocalOrder(updated);
    setEditingOrder(null);
    showToast(`Order #${updated.order_number} Updated ✓`, "success");
  };

  const handleCloseWizard = () => {
    playTapSound();
    setIsCreating(false);
    setCreatedOrder(null);
  };

  const finalizeOrder = () => {
    if (!baker) return;
    playSuccessSound();
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

    // 1. Instant 0ms Optimistic React State Update
    setOrders((prev) => [newOrder, ...prev]);
    setCreatedOrder(newOrder);

    // 2. Persist to storage & cloud
    saveLocalOrder(newOrder);
  };

  const updateOrderStatus = (orderId: string, newStatus: Order["status"]) => {
    // 1. Instant 0ms Optimistic State Update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    if (newStatus === "baked") {
      showToast("Order Marked as Baked & Ready! ✓", "success");
    } else if (newStatus === "completed") {
      showToast("Order Delivered & Handover Closed! ✓", "success");
    }

    // 2. Persist locally & background sync to cloud
    const all = getLocalOrders();
    const target = all.find((o) => o.id === orderId);
    if (target) {
      target.status = newStatus;
      saveLocalOrder(target);
    }
  };

  const getCustomerLink = (orderNum: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/o/${orderNum}`;
  };

  const handleSendViaWhatsApp = (order: Order) => {
    playSuccessSound();
    showToast("Opening WhatsApp...", "info");
    const link = getCustomerLink(order.order_number);
    const message = `Please confirm your cake order details and advance token (₹${order.token_amount}) here:\n\n${link}\n\n${order.weight} ${order.flavour} (${order.is_eggless ? "100% Eggless" : "With Egg"})\nTime: ${order.time_slot}\nBalance Due at Pickup: ₹${order.balance_amount}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleCopyLink = (orderNum: string) => {
    playSuccessSound();
    const link = getCustomerLink(orderNum);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    showToast("Booking Link Copied! ✓", "success");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDeleteOrder = (order: Order) => {
    playTapSound();
    setOrderToDelete(order);
  };

  const confirmDeleteOrder = () => {
    if (!orderToDelete) return;
    playTapSound();
    const targetId = orderToDelete.id;
    setOrders((prev) => prev.filter((o) => o.id !== targetId));
    deleteLocalOrder(targetId);
    showToast("Order Deleted ✓", "info");
    setOrderToDelete(null);
    setExpandedWaitingOrderId(null);
    if (proofOrder?.id === targetId) {
      setProofOrder(null);
    }
  };

  if (!mounted || !baker) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col p-4 max-w-xl mx-auto space-y-4 pt-16">
        <KitchenCardSkeleton />
        <KitchenCardSkeleton />
        <KitchenCardSkeleton />
      </div>
    );
  }

  // Filter calculations (Always Newest First for Waiting & Completed)
  const kitchenOrders = orders
    .filter((o) => o.status === "confirmed" || o.status === "baked")
    .sort((a, b) => {
      if (a.delivery_date !== b.delivery_date) {
        return a.delivery_date.localeCompare(b.delivery_date);
      }
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

  const waitingOrders = orders
    .filter((o) => o.status === "pending_token")
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );

  const deliveredOrders = orders
    .filter((o) => o.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );

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
    <div className="h-[100dvh] bg-white text-zinc-950 selection:bg-zinc-200 flex flex-col overflow-hidden">
      {/* =======================================================================
          PINNED TOP BAR + SWITCHER (100% FIXED - ZERO SCROLL ON CHROME/SAFARI)
          ======================================================================= */}
      <div className="shrink-0 bg-white border-b border-zinc-100 z-20 w-full max-w-xl mx-auto">
        {/* App Bar */}
        <header className="px-4 py-2.5 flex items-center justify-between border-b border-zinc-100/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold tracking-tight text-zinc-950 flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[200px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate">{baker?.name || "CakeFlow"}</span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-mono shrink-0">
              ₹{todayEarned.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setIsEditingFlavour(false);
                setIsEditingAddon(false);
                setShowSettingsModal(true);
              }}
              className="w-8 h-8 rounded-xl bg-[#f4f4f5] hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors active:scale-95"
              title="Menu & Store Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <RainbowButton
              onClick={() => {
                playTapSound();
                handleStartNewOrder();
              }}
              size="sm"
              className="h-8 rounded-xl px-3 text-xs font-semibold active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Order</span>
            </RainbowButton>
          </div>
        </header>

        {/* 3-Segment Switcher with Sliding Motion Pill */}
        <div className="px-4 py-2 bg-white">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-zinc-100 text-xs font-semibold relative">
            {(
              [
                { id: "kitchen", label: "Kitchen", count: kitchenOrders.length },
                { id: "waiting", label: "Waiting", count: waitingOrders.length },
                { id: "delivered", label: "Delivered", count: deliveredOrders.length },
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    playTapSound();
                    setStatusFilter(tab.id);
                  }}
                  className={`relative py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 active:scale-95 z-10 ${
                    isActive ? "text-zinc-950 font-bold" : "text-zinc-500 hover:text-zinc-950"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs -z-10"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                      isActive ? "bg-zinc-950 text-white" : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =======================================================================
          SCROLLABLE KITCHEN CARDS LIST (ONLY CARDS SCROLL)
          ======================================================================= */}
      <main className="flex-1 overflow-y-auto overscroll-contain w-full max-w-xl mx-auto px-4 pt-3 pb-24 space-y-3">
          {isLoading ? (
            <motion.div
              key="skeleton-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 pt-2"
            >
              {[1, 2, 3].map((n) => (
                <KitchenCardSkeleton key={n} />
              ))}
            </motion.div>
          ) : displayedOrders.length === 0 ? (
            <motion.div
              key="empty-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="py-20 text-center space-y-2"
            >
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
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {displayedOrders.map((ord) => {
                // 1. COLLAPSED VIEW FOR DELIVERED ORDERS (CLICK FOR FULL PROOF)
                if (ord.status === "completed") {
                  return (
                    <motion.div
                      key={ord.id}
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      onClick={() => {
                        playTapSound();
                        setProofOrder(ord);
                      }}
                      className="p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-100/50 flex items-center justify-between gap-3 transition-all active:scale-[0.99] cursor-pointer"
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Delivered ✓
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700">Proof →</span>
                      </div>
                    </motion.div>
                  );
                }

                // 2. WAITING ORDERS (PENDING TOKEN - TAP TO EXPAND & DELETE)
                if (ord.status === "pending_token") {
                  const isExpanded = expandedWaitingOrderId === ord.id;
                  return (
                    <motion.div
                      key={ord.id}
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      onClick={() => {
                        playTapSound();
                        setExpandedWaitingOrderId(isExpanded ? null : ord.id);
                      }}
                      className="p-3.5 rounded-2xl bg-[#f4f4f5] transition-all cursor-pointer border border-transparent hover:border-zinc-200/80 active:scale-[0.99] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          playSuccessSound();
                          handleSendViaWhatsApp(ord);
                        }}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-600 transition-colors active:scale-95 flex items-center gap-1.5 shrink-0 text-xs font-semibold shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5 fill-emerald-600" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        <span>Share</span>
                      </button>
                    </div>

                    {/* Expanded Drawer: Revealed only on click */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="pt-2.5 border-t border-zinc-200/60 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-zinc-200/60">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-400">Advance Pending</div>
                            <div className="text-sm font-bold text-zinc-950">₹{ord.token_amount}</div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(ord.order_number);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Link</span>
                          </button>
                        </div>

                        {/* Edit Waiting Order */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditOrder(ord);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 border border-zinc-200/60"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Edit Order Specs / Pricing</span>
                        </button>

                        {/* Baker Manual Payment Confirmation Bypass */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSuccessSound();
                            const updatedOrder: Order = {
                              ...ord,
                              status: "confirmed",
                              paid_at: new Date().toISOString(),
                              payment_method: "cash_offline",
                              utr: `CASH-${Date.now().toString().slice(-6)}`,
                            };
                            saveLocalOrder(updatedOrder);
                            setOrders((prev) =>
                              prev.map((o) => (o.id === ord.id ? updatedOrder : o))
                            );
                            showToast("Order Confirmed! Moved to Kitchen ✓", "success");
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 border border-emerald-200/60"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Token Received (Cash / Offline)</span>
                        </button>

                        {/* Delete Unpaid Order Action Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(ord);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 border border-red-200/60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Order (Deal Cancelled)</span>
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                );
              }

                // 3. FLAT CHEF TICKET FOR ACTIVE ORDERS (CONFIRMED / BAKING OR BAKED / READY)
                return (
                  <motion.div
                    key={ord.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3 transition-all active:scale-[0.99]"
                  >
                    {/* Top Line: Cake & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-zinc-950 truncate">
                          #{ord.order_number} • {ord.weight} {ord.flavour}
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

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditOrder(ord);
                          }}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors border border-zinc-200/60"
                          title="Edit order specs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(ord);
                          }}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors border border-zinc-200/60"
                          title="Cancel / Delete order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            ord.status === "confirmed"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-emerald-100 text-emerald-900"
                          }`}
                        >
                          {ord.status === "confirmed" ? "In Oven / Baking" : "Ready for Handover"}
                        </span>
                      </div>
                    </div>

                    {/* Customer Information (Flat, Plain & Never Truncated) */}
                    {(ord.customer_name || ord.customer_phone || ord.delivery_address) && (
                      <div className="text-xs space-y-1 pt-1.5 border-t border-zinc-200/60">
                        <div className="font-bold text-zinc-950 text-sm">
                          {ord.customer_name || "Customer"}
                        </div>
                        {ord.customer_phone && (
                          <div>
                            <a
                              href={`tel:${ord.customer_phone}`}
                              className="text-zinc-600 font-mono text-xs hover:text-zinc-950 underline inline-flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-zinc-400" />
                              <span>+{ord.customer_phone}</span>
                            </a>
                          </div>
                        )}
                        <div className="text-zinc-600 text-xs">
                          {ord.fulfilment_type === "delivery"
                            ? `Address: ${ord.delivery_address || "Address provided"}`
                            : "Self Pickup (Store)"}
                        </div>
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
                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                          <span>Design Reference Photos</span>
                          <span className="text-zinc-400">tap to zoom</span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {(ord.reference_images || [ord.reference_image]).map((img, i) => (
                            <div
                              key={i}
                              onClick={() => {
                                playTapSound();
                                setEnlargedKitchenImage(img!);
                                setZoomLevel(1);
                              }}
                              className="cursor-zoom-in relative w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0 border border-zinc-200/60 hover:ring-2 hover:ring-zinc-950 transition-all group"
                            >
                              <img
                                src={img!}
                                alt="Design Reference"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special Note (ONLY IF EXISTS AND NOT NONE) */}
                    {ord.special_notes && isValidCakeMessage(ord.special_notes) && (
                      <p className="text-xs text-zinc-500 italic bg-white/70 p-2 rounded-lg">
                        Note: "{ord.special_notes}"
                      </p>
                    )}

                    {/* Financial Ledger & 1 Clear Action Button */}
                    <div className="pt-2.5 border-t border-zinc-200/70 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-zinc-500 font-medium">Handover Balance</div>
                        <div className="text-base font-bold text-zinc-950 font-mono tracking-tight">₹{ord.balance_amount}</div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            ₹{ord.token_amount} Token Paid (UPI)
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {ord.status === "confirmed" && (
                          <MovingBorderButton
                            onClick={() => handleMarkAsBaked(ord.id)}
                            containerClassName="w-full sm:w-auto h-10"
                            className="bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-50 border border-zinc-200/80 shadow-2xs transition-transform active:scale-95"
                          >
                            <span className="flex items-center gap-1.5 px-3">
                              <span>{bakingOrderId === ord.id ? "🎉 Baked & Ready!" : "Mark as Baked ✓"}</span>
                            </span>
                          </MovingBorderButton>
                        )}

                        {ord.status === "baked" && (
                          <button
                            type="button"
                            onClick={() => {
                              playSuccessSound();
                              updateOrderStatus(ord.id, "completed");
                            }}
                            className="h-9 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors active:scale-98 shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <span>Collected & Paid</span>
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </main>

        {/* =======================================================================
            APPLE / STRIPE MINIMALIST ORDER MODAL (ZERO COGNITIVE LOAD)
            ======================================================================= */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            >
              <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />
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
                    <div className="p-3.5 rounded-2xl bg-[#f4f4f5] space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                          Dietary Preference
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-200/70">
                          <button
                            type="button"
                            onClick={() => {
                              playPopSound();
                              setIsEggless(true);
                            }}
                            className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              isEggless
                                ? "bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-600/30"
                                : "text-zinc-600 hover:text-zinc-950"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                            <span>100% Eggless</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              playPopSound();
                              setIsEggless(false);
                            }}
                            className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              !isEggless
                                ? "bg-white text-amber-900 shadow-xs ring-1 ring-amber-600/30"
                                : "text-zinc-600 hover:text-zinc-950"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0"></span>
                            <span>Contains Egg</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="text-[10px] text-zinc-400 font-medium block mb-1">
                            Weight
                          </label>
                          <select
                            value={weight}
                            onChange={(e) => {
                              playPopSound();
                              handleWeightChange(e.target.value);
                            }}
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
                              playPopSound();
                              handleFlavourChange(e.target.value);
                            }}
                            className="w-full px-3 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs focus:outline-none border border-zinc-200/60"
                          >
                            {menuItems.map((f) => (
                              <option key={f.id} value={f.name}>
                                {f.name}
                              </option>
                            ))}
                            <option value="Custom / Other">Custom / Other</option>
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

                    {/* CARD 3: HANDOVER DATE & TIME (LARGE, EFFORTLESS TOUCH TARGETS) */}
                    <div className="p-4 rounded-2xl bg-[#f4f4f5] space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          When Needed
                        </span>
                        <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                          {timeSlot}
                        </span>
                      </div>

                      {/* 1. DATE SELECTION (LARGE CHUNKY TOUCH TARGETS) */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-zinc-500 font-semibold block">
                          Delivery / Ready Date
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {["Today", "Tomorrow"].map((label) => {
                            const dStr =
                              label === "Today"
                                ? new Date().toISOString().split("T")[0]
                                : new Date(Date.now() + 86400000)
                                    .toISOString()
                                    .split("T")[0];
                            const isSel = deliveryDate === dStr;
                            const dObj = new Date(dStr);
                            const dayName = dObj.toLocaleDateString("en-IN", { weekday: "short" });
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => {
                                  playPopSound();
                                  setDeliveryDate(dStr);
                                }}
                                className={`h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                                  isSel
                                    ? "bg-zinc-950 text-white shadow-xs"
                                    : "bg-white text-zinc-700 hover:text-zinc-950 border border-zinc-200/80"
                                }`}
                              >
                                <span>{label}</span>
                                <span className={`text-[10px] font-normal ${isSel ? "text-zinc-300" : "text-zinc-400"}`}>
                                  ({dayName})
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Date Input (Full width, big touch target) */}
                        <div className="relative">
                          <input
                            type="date"
                            value={deliveryDate}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => {
                              playPopSound();
                              setDeliveryDate(e.target.value);
                            }}
                            className="w-full h-10 px-3.5 rounded-xl bg-white text-xs font-bold text-zinc-950 focus:outline-none border border-zinc-200/80 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* 2. TIME SELECTION (CHUNKY STEPPER + AM/PM PILLS - NO KEYBOARD NEEDED) */}
                      <div className="space-y-1.5 pt-1 border-t border-zinc-200/60">
                        <label className="text-[11px] text-zinc-500 font-semibold block">
                          Delivery Time (1-Hour Window)
                        </label>

                        <div className="grid grid-cols-12 gap-2">
                          {/* Hour Stepper (Minus - Value - Plus) */}
                          <div className="col-span-8 flex items-center justify-between bg-white h-12 px-1.5 rounded-xl border border-zinc-200/80 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                playPopSound();
                                const current = parseInt(selectedHour, 10) || 6;
                                const prev = current === 1 ? 12 : current - 1;
                                setSelectedHour(String(prev));
                                setTimeSlot(calculateDeliverySlot(prev, selectedAmPm));
                              }}
                              className="w-9 h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-base flex items-center justify-center transition-all active:scale-90 cursor-pointer select-none"
                              title="Decrease hour"
                            >
                              −
                            </button>

                            <div className="flex-1 flex flex-col items-center justify-center">
                              <select
                                value={selectedHour}
                                onChange={(e) => {
                                  playPopSound();
                                  const h = e.target.value;
                                  setSelectedHour(h);
                                  setTimeSlot(calculateDeliverySlot(h, selectedAmPm));
                                }}
                                className="bg-transparent text-base font-black text-zinc-950 font-mono tracking-tight focus:outline-none cursor-pointer text-center"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                                  <option key={num} value={String(num)}>
                                    {num}:00
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                playPopSound();
                                const current = parseInt(selectedHour, 10) || 6;
                                const next = current === 12 ? 1 : current + 1;
                                setSelectedHour(String(next));
                                setTimeSlot(calculateDeliverySlot(next, selectedAmPm));
                              }}
                              className="w-9 h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-base flex items-center justify-center transition-all active:scale-90 cursor-pointer select-none"
                              title="Increase hour"
                            >
                              +
                            </button>
                          </div>

                          {/* AM / PM Toggle (Large fat-finger friendly buttons) */}
                          <div className="col-span-4 grid grid-cols-2 gap-1 p-1 bg-zinc-200/70 h-12 rounded-xl">
                            <button
                              type="button"
                              onClick={() => {
                                playPopSound();
                                setSelectedAmPm("AM");
                                setTimeSlot(calculateDeliverySlot(selectedHour, "AM"));
                              }}
                              className={`h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center active:scale-95 cursor-pointer ${
                                selectedAmPm === "AM"
                                  ? "bg-white text-zinc-950 shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-950"
                              }`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playPopSound();
                                setSelectedAmPm("PM");
                                setTimeSlot(calculateDeliverySlot(selectedHour, "PM"));
                              }}
                              className={`h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center active:scale-95 cursor-pointer ${
                                selectedAmPm === "PM"
                                  ? "bg-white text-zinc-950 shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-950"
                              }`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sticky 1-Tap Action Bar */}
                  <div className="p-4 border-t border-zinc-100 bg-white space-y-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        playSuccessSound();
                        finalizeOrder();
                      }}
                      className="w-full py-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm transition-all active:scale-[0.99] shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>⚡ Create & Share on WhatsApp</span>
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
        {/* =======================================================================
            OFFICIAL ORDER PROOF / AUDIT RECORD MODAL (FOR DELIVERED ORDERS)
            ======================================================================= */}
        {proofOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom duration-300 ease-out sm:slide-in-from-bottom-0 sm:zoom-in-95">
              <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />
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
                        <div
                          key={i}
                          onClick={() => {
                            setEnlargedKitchenImage(img!);
                            setZoomLevel(1);
                          }}
                          className="cursor-zoom-in relative w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 border border-zinc-200 hover:ring-2 hover:ring-zinc-950 transition-all group"
                        >
                          <img
                            src={img!}
                            alt="Customer Design"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
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
                  className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-98 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download / Print Proof PDF</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (proofOrder) {
                        handleDeleteOrder(proofOrder);
                      }
                    }}
                    className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-98 border border-red-200/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Record</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProofOrder(null)}
                    className="flex-1 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-950 cursor-pointer"
                  >
                    Close Proof
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            SETTINGS & MENU PRICING MODAL
            ======================================================================= */}
        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom duration-300 ease-out sm:slide-in-from-bottom-0 sm:zoom-in-95">
              <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />
              {/* Settings Header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-zinc-700" />
                    <span>Settings & Menu Pricing</span>
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Customize flavours, weight prices & store details
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="w-8 h-8 rounded-full bg-[#f4f4f5] hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segment Tabs */}
              <div className="px-5 pt-3 pb-2 bg-white border-b border-zinc-100 shrink-0">
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab("menu");
                      setIsEditingFlavour(false);
                      setIsEditingAddon(false);
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      settingsTab === "menu"
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-950"
                    }`}
                  >
                    Flavours
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab("addons");
                      setIsEditingFlavour(false);
                      setIsEditingAddon(false);
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      settingsTab === "addons"
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-950"
                    }`}
                  >
                    Party Add-ons
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab("store");
                      setIsEditingFlavour(false);
                      setIsEditingAddon(false);
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      settingsTab === "store"
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-950"
                    }`}
                  >
                    Store Profile
                  </button>
                </div>
              </div>

              {/* Settings Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
                {settingsTab === "menu" ? (
                  <div className="space-y-4">
                    {/* Add / Edit Flavour Form */}
                    {isEditingFlavour ? (
                      <div className="p-4 rounded-2xl bg-[#f4f4f5] border border-zinc-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-zinc-950">
                            {editingFlavourId ? "Edit Flavour" : "Add New Flavour"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsEditingFlavour(false)}
                            className="text-zinc-400 hover:text-zinc-700"
                          >
                            ✕
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                            Flavour Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Lotus Biscoff, Blueberry Cheesecake"
                            value={flavourNameInput}
                            onChange={(e) => setFlavourNameInput(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                            Prices by Weight (₹)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {WEIGHT_OPTIONS.map((w) => (
                              <div
                                key={w}
                                className="bg-white p-2.5 rounded-xl border border-zinc-200 flex items-center justify-between"
                              >
                                <span className="font-semibold text-zinc-600">{w}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-zinc-400 font-bold">₹</span>
                                  <input
                                    type="number"
                                    value={flavourPricesInput[w] ?? 500}
                                    onChange={(e) =>
                                      setFlavourPricesInput((prev) => ({
                                        ...prev,
                                        [w]: Number(e.target.value) || 0,
                                      }))
                                    }
                                    className="w-16 text-right font-bold text-zinc-950 focus:outline-none"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveFlavourItem}
                            className="flex-1 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs transition-all active:scale-98"
                          >
                            Save Flavour
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingFlavour(false)}
                            className="py-2.5 px-4 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-semibold text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-zinc-950 text-sm">
                            Your Cake Menu
                          </span>
                          <span className="text-zinc-400 text-xs ml-2">
                            ({menuItems.length} items)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddFlavour}
                          className="py-1.5 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Flavour</span>
                        </button>
                      </div>
                    )}

                    {/* Flavours List */}
                    <div className="space-y-2.5">
                      {menuItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-[#f4f4f5] border border-zinc-200/60 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-zinc-950">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditFlavour(item)}
                                className="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors"
                                title="Edit prices"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFlavour(item.id)}
                                className="w-7 h-7 rounded-lg bg-white hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors"
                                title="Delete flavour"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Price Chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {WEIGHT_OPTIONS.map((w) => (
                              <span
                                key={w}
                                className="px-2 py-1 rounded-lg bg-white text-zinc-700 text-[11px] font-semibold border border-zinc-200/60"
                              >
                                {w}: <span className="font-bold text-zinc-950">₹{item.prices[w] ?? "—"}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : settingsTab === "addons" ? (
                  /* TAB 2: PARTY ADD-ONS & EXTRAS */
                  <div className="space-y-4">
                    {/* Add / Edit Addon Form */}
                    {isEditingAddon ? (
                      <div className="p-4 rounded-2xl bg-[#f4f4f5] border border-zinc-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-zinc-950">
                            {editingAddonId ? "Edit Party Item" : "Add New Party Item"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsEditingAddon(false)}
                            className="text-zinc-400 hover:text-zinc-700"
                          >
                            ✕
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                            Item Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Magic Sparkler Candle, Acrylic Cake Topper, Chocolate Bomb"
                            value={addonNameInput}
                            onChange={(e) => setAddonNameInput(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                            Price (₹)
                          </label>
                          <input
                            type="number"
                            value={addonPriceInput}
                            onChange={(e) => setAddonPriceInput(Number(e.target.value) || 0)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                          />
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveAddonItem}
                            className="flex-1 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs transition-all active:scale-98"
                          >
                            Save Item
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingAddon(false)}
                            className="py-2.5 px-4 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-semibold text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-zinc-950 text-sm">
                            Party Extras & Add-ons
                          </span>
                          <span className="text-zinc-400 text-xs ml-2">
                            ({addonItems.length} items)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddAddon}
                          className="py-1.5 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Item</span>
                        </button>
                      </div>
                    )}

                    {/* Addons List */}
                    <div className="space-y-2">
                      {addonItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl bg-[#f4f4f5] border border-zinc-200/60 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-sm text-zinc-950 block">
                              {item.name}
                            </span>
                            <span className="text-xs font-bold text-emerald-700 mt-0.5 inline-block">
                              +₹{item.price}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAddon(item)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors"
                              title="Edit item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddon(item.id)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* TAB 3: STORE PROFILE */
                  <div className="space-y-3.5">
                    {/* Permanent POS Link Badge */}
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        Your Dedicated Kitchen POS Link
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-800 truncate">
                          /baker/{baker.slug}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const origin = typeof window !== "undefined" ? window.location.origin : "";
                            navigator.clipboard.writeText(`${origin}/baker/${baker.slug}`);
                            playSuccessSound();
                            showToast("Copied your Kitchen Link! Bookmark it 📌", "success");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-[10px] font-bold shrink-0 flex items-center gap-1 active:scale-95 transition-transform"
                        >
                          <Copy className="w-3 h-3 text-zinc-400" />
                          <span>Copy POS Link</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Bookmark this link on your phone to open your kitchen dashboard anytime.
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                        Bakery / Studio Name
                      </label>
                      <input
                        type="text"
                        value={storeNameInput}
                        onChange={(e) => setStoreNameInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          WhatsApp Phone
                        </label>
                        <input
                          type="tel"
                          value={storePhoneInput}
                          onChange={(e) => setStorePhoneInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          UPI ID (Payments)
                        </label>
                        <input
                          type="text"
                          value={storeUpiInput}
                          onChange={(e) => setStoreUpiInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                        Pickup Address
                      </label>
                      <input
                        type="text"
                        value={storeAddressInput}
                        onChange={(e) => setStoreAddressInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Default Token Advance (₹)
                        </label>
                        <input
                          type="number"
                          value={storeTokenInput}
                          onChange={(e) => setStoreTokenInput(Number(e.target.value) || 100)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Max Daily Cake Slots
                        </label>
                        <input
                          type="number"
                          value={storeMaxDailyInput}
                          onChange={(e) => setStoreMaxDailyInput(Number(e.target.value) || 4)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleSaveStoreProfile}
                        className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs transition-all active:scale-98 shadow-xs"
                      >
                        Save Profile Changes
                      </button>
                    </div>

                    {settingsSavedToast && (
                      <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-center font-bold text-xs animate-in fade-in">
                        ✓ Profile updated & synced successfully!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* =======================================================================
            FULLSCREEN INTERACTIVE IMAGE ZOOM LIGHTBOX (PIPING & DETAIL INSPECTOR)
            ======================================================================= */}
        {enlargedKitchenImage && (
          <div
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60] flex flex-col justify-between p-4 animate-in fade-in duration-200 select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEnlargedKitchenImage(null);
                setZoomLevel(1);
              }
            }}
          >
            {/* Top Controls Bar */}
            <div className="flex items-center justify-between text-white shrink-0 z-10">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setZoomLevel((prev) => Math.max(1, prev - 0.5))}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center font-bold"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="font-mono font-bold text-[11px] min-w-[36px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((prev) => Math.min(3.5, prev + 0.5))}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center font-bold"
                  title="Zoom In"
                >
                  +
                </button>
                {zoomLevel !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="ml-1 text-[10px] text-zinc-300 hover:text-white underline font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setEnlargedKitchenImage(null);
                  setZoomLevel(1);
                }}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition-colors"
                title="Close Viewer"
              >
                ✕
              </button>
            </div>

            {/* Centered Zoomable Image Canvas */}
            <div
              className="flex-1 flex items-center justify-center overflow-auto p-2 my-2 cursor-zoom-in"
              onClick={() => {
                setZoomLevel((prev) => (prev >= 2 ? 1 : prev + 0.75));
              }}
            >
              <img
                src={enlargedKitchenImage}
                alt="Enlarged Cake Design Reference"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
                }}
                className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl origin-center pointer-events-auto"
              />
            </div>

            {/* Bottom Tip Bar */}
            <div className="text-center text-[11px] text-zinc-400 font-medium shrink-0">
              Tap image to toggle zoom • Use + / - to inspect piping & details
            </div>
          </div>
        )}

        {/* =======================================================================
            CUSTOM IN-APP CONFIRM DELETE MODAL (ZERO NATIVE POPUP ALERT)
            ======================================================================= */}
        {orderToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white rounded-3xl p-5 max-w-xs w-full text-center space-y-4 shadow-2xl relative border border-zinc-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-950">
                  Delete Order?
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  #{orderToDelete.order_number} ({orderToDelete.weight} {orderToDelete.flavour}) will be permanently deleted from records.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={confirmDeleteOrder}
                  className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all active:scale-98 shadow-xs cursor-pointer"
                >
                  Yes, Delete Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setOrderToDelete(null);
                  }}
                  className="w-full py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs transition-all active:scale-98 cursor-pointer"
                >
                  Keep Order
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* =======================================================================
            FULL REAL-WORLD ORDER EDIT MODAL (MUTATES STATE + LOCALSTORAGE + CLOUD)
            ======================================================================= */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            >
              <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mt-2.5 mb-0.5 sm:hidden shrink-0" />
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <h2 className="text-base font-bold text-zinc-950">
                    Edit Order #{editingOrder.order_number}
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Modify cake details, price, time slot or customer info
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="w-8 h-8 rounded-full bg-[#f4f4f5] hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Weight & Flavour */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Weight
                    </label>
                    <select
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 font-bold text-xs focus:outline-none border border-zinc-200/60"
                    >
                      {WEIGHT_OPTIONS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Flavour
                    </label>
                    <input
                      type="text"
                      value={editFlavour}
                      onChange={(e) => setEditFlavour(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 font-bold text-xs focus:outline-none border border-zinc-200/60"
                    />
                  </div>
                </div>

                {/* Eggless Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#f4f4f5] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditIsEggless(true)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      editIsEggless
                        ? "bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500/30"
                        : "text-zinc-500"
                    }`}
                  >
                    100% Eggless
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIsEggless(false)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      !editIsEggless
                        ? "bg-white text-amber-900 shadow-xs ring-1 ring-amber-500/30"
                        : "text-zinc-500"
                    }`}
                  >
                    Contains Egg
                  </button>
                </div>

                {/* Total Price & Token Advance */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Total Price (₹)
                    </label>
                    <input
                      type="number"
                      value={editTotalPrice}
                      onChange={(e) => setEditTotalPrice(Number(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-bold focus:outline-none border border-zinc-200/60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Token Advance (₹)
                    </label>
                    <input
                      type="number"
                      value={editTokenAmount}
                      onChange={(e) => setEditTokenAmount(Number(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-bold focus:outline-none border border-zinc-200/60"
                    />
                  </div>
                </div>

                {/* Date & Time Slot */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Handover Date
                    </label>
                    <input
                      type="date"
                      value={editDeliveryDate}
                      onChange={(e) => setEditDeliveryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Time Slot
                    </label>
                    <input
                      type="text"
                      value={editTimeSlot}
                      onChange={(e) => setEditTimeSlot(e.target.value)}
                      placeholder="e.g. 6:00 PM - 7:00 PM"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                    />
                  </div>
                </div>

                {/* Piping Message */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Text on Cake (Piped)
                  </label>
                  <input
                    type="text"
                    value={editCakeMessage}
                    onChange={(e) => setEditCakeMessage(e.target.value)}
                    placeholder="e.g. Happy Birthday Aarav!"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                  />
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      placeholder="Customer Name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Customer Phone
                    </label>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                    />
                  </div>
                </div>

                {/* Fulfilment & Delivery Address */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#f4f4f5] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditFulfilmentType("pickup")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        editFulfilmentType === "pickup"
                          ? "bg-white text-zinc-950 shadow-xs"
                          : "text-zinc-500"
                      }`}
                    >
                      Store Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditFulfilmentType("delivery")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        editFulfilmentType === "delivery"
                          ? "bg-white text-zinc-950 shadow-xs"
                          : "text-zinc-500"
                      }`}
                    >
                      Home Delivery
                    </button>
                  </div>
                  {editFulfilmentType === "delivery" && (
                    <input
                      type="text"
                      value={editDeliveryAddress}
                      onChange={(e) => setEditDeliveryAddress(e.target.value)}
                      placeholder="Delivery address..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                    />
                  )}
                </div>

                {/* Special Notes */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Special Kitchen Notes
                  </label>
                  <input
                    type="text"
                    value={editSpecialNotes}
                    onChange={(e) => setEditSpecialNotes(e.target.value)}
                    placeholder="e.g. Less sweetness, gold leaf border"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] text-zinc-950 text-xs font-semibold focus:outline-none border border-zinc-200/60"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-zinc-100 bg-white space-y-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveEditedOrder}
                  className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs transition-all active:scale-98 shadow-xs cursor-pointer"
                >
                  Save Changes ✓
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
}
