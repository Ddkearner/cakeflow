"use client";

import { useState, useEffect, useMemo } from "react";
import { Baker, Order } from "@/lib/types";
import {
  getLocalBakers,
  saveLocalBaker,
  deleteLocalBaker,
  getLocalOrders,
} from "@/lib/store";
import { generateSecretToken } from "@/lib/utils";
import {
  Plus,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Lock,
  Unlock,
  TrendingUp,
  IndianRupee,
  Store,
  ShoppingBag,
  Eye,
  EyeOff,
  LogOut,
  BarChart3,
  Calendar,
  Sparkles,
} from "lucide-react";

const ADMIN_DEFAULT_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "cakeflow2026";

export default function AdminPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  // Data state
  const [bakers, setBakers] = useState<Baker[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("91");
  const [upiId, setUpiId] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [tokenAmount, setTokenAmount] = useState(100);

  // Check existing session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("cakeflow_admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
      setIsAuthChecking(false);
    }
  }, []);

  // Load data once authenticated
  const refreshData = () => {
    const bakerList = getLocalBakers();
    setBakers(bakerList);
    const orderList = getLocalOrders();
    setOrders(orderList);
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated]);

  // Auth Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      passwordInput === ADMIN_DEFAULT_PASSWORD ||
      passwordInput === "admin@cakeflow"
    ) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cakeflow_admin_auth", "true");
      }
      setIsAuthenticated(true);
      setAuthError("");
      setPasswordInput("");
    } else {
      setAuthError("Incorrect Admin Password. Check credentials and retry.");
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("cakeflow_admin_auth");
    }
    setIsAuthenticated(false);
    setPasswordInput("");
  };

  const handleCreateBaker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !phone || !upiId || !pickupAddress) return;

    const newBaker: Baker = {
      id: `baker-${Date.now()}`,
      slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
      name: name.trim(),
      tagline: "Custom Artisan Bakery",
      phone: phone.replace(/\D/g, ""),
      upi_id: upiId.trim(),
      pickup_address: pickupAddress.trim(),
      secret_token: generateSecretToken(slug),
      default_token_amount: Number(tokenAmount) || 100,
      created_at: new Date().toISOString(),
    };

    saveLocalBaker(newBaker);
    refreshData();
    setShowAddModal(false);

    setName("");
    setSlug("");
    setPhone("91");
    setUpiId("");
    setPickupAddress("");
    setTokenAmount(100);
  };

  const handleDeleteBaker = (bakerId: string, bakerName: string) => {
    if (
      window.confirm(
        `Are you sure you want to remove "${bakerName}"? This cannot be undone.`
      )
    ) {
      deleteLocalBaker(bakerId);
      refreshData();
    }
  };

  const copyMagicLink = (token: string, id: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const magicLink = `${origin}/baker?token=${token}`;
    navigator.clipboard.writeText(magicLink);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Analytics Computations
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const grossRevenue = orders.reduce(
      (acc, o) => acc + (Number(o.total_price) || 0),
      0
    );
    const totalTokensCollected = orders.reduce((acc, o) => {
      // If token paid or order advanced past pending_token
      return o.status !== "pending_token" && o.status !== "cancelled"
        ? acc + (Number(o.token_amount) || 0)
        : acc;
    }, 0);
    const aov = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0;

    // Status distribution
    const statusCounts: Record<string, number> = {
      pending_token: 0,
      confirmed: 0,
      baked: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      } else {
        statusCounts[o.status] = 1;
      }
    });

    // Flavour popularity
    const flavourMap: Record<string, number> = {};
    orders.forEach((o) => {
      const f = o.flavour || "Custom";
      flavourMap[f] = (flavourMap[f] || 0) + 1;
    });
    const topFlavours = Object.entries(flavourMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      totalOrders,
      grossRevenue,
      totalTokensCollected,
      aov,
      statusCounts,
      topFlavours,
    };
  }, [orders]);

  // 7-Day Chart Data Calculation
  const last7DaysData = useMemo(() => {
    const days: {
      dateStr: string;
      label: string;
      revenue: number;
      ordersCount: number;
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
      const dayLabel = d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
      });

      const dayOrders = orders.filter((o) => {
        const orderDate = (o.created_at || o.delivery_date || "").split("T")[0];
        return orderDate === dateStr;
      });

      const revenue = dayOrders.reduce(
        (acc, o) => acc + (Number(o.total_price) || 0),
        0
      );

      days.push({
        dateStr,
        label: dayLabel,
        revenue,
        ordersCount: dayOrders.length,
      });
    }

    const maxRevenue = Math.max(...days.map((d) => d.revenue), 1000);

    return { days, maxRevenue };
  }, [orders]);

  // If checking session initially
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 1. LOCKED SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-zinc-200/90 rounded-3xl p-7 shadow-xl shadow-zinc-200/50 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-zinc-950 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-zinc-900/10">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">
              CakeFlow Master Admin
            </h1>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Enter master passphrase to unlock network analytics and bakery studios.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wider uppercase text-zinc-600">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoFocus
                  required
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError("");
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-[#f4f4f5] border border-transparent text-sm text-zinc-950 tracking-wider focus:outline-none focus:bg-white focus:border-zinc-400 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock Portal
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-600">
            <span>Passphrase protected</span>
            <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded text-zinc-700">
              Default: cakeflow2026
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED DASHBOARD
  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-950 p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Navbar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Control
              </span>
              <span className="text-xs text-zinc-600">Master Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 mt-1">
              CakeFlow Network
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Baker Studio
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-100 hover:text-zinc-950 transition-colors"
              title="Lock Admin Screen"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Top 5 KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Gross Revenue */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-medium">
              <span>Gross Volume</span>
              <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
                <IndianRupee className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                ₹{stats.grossRevenue.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-zinc-600 mt-0.5">
                Total pipeline bookings
              </div>
            </div>
          </div>

          {/* 2. Token Advances */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-medium">
              <span>Advance Tokens</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
                ₹{stats.totalTokensCollected.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-zinc-600 mt-0.5">
                Locked upfront cash
              </div>
            </div>
          </div>

          {/* 3. Total Orders */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-medium">
              <span>Total Orders</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                {stats.totalOrders}
              </div>
              <div className="text-[11px] text-zinc-600 mt-0.5">
                {stats.statusCounts.baked + stats.statusCounts.confirmed} in active kitchen
              </div>
            </div>
          </div>

          {/* 4. Active Studios */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-medium">
              <span>Active Studios</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Store className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                {bakers.length}
              </div>
              <div className="text-[11px] text-zinc-600 mt-0.5">
                Onboarded home bakers
              </div>
            </div>
          </div>

          {/* 5. Average Order Value */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-medium">
              <span>Avg Order Value</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                ₹{stats.aov.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-zinc-600 mt-0.5">
                Ticket size per cake
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section: 7-Day Chart & Performance Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Revenue & Orders SVG Interactive Chart (2 cols) */}
          <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white border border-zinc-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-zinc-700" />
                  7-Day Booking Velocity
                </h3>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Daily gross order volume across registered home bakeries
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-zinc-900 inline-block" />
                  Gross Revenue (₹)
                </span>
              </div>
            </div>

            {/* SVG Bar Chart */}
            <div className="relative pt-6 pb-2">
              <div className="h-44 sm:h-52 w-full flex items-end justify-between gap-2 sm:gap-4 px-2">
                {last7DaysData.days.map((d, idx) => {
                  const heightPercent =
                    last7DaysData.maxRevenue > 0
                      ? Math.max(
                          (d.revenue / last7DaysData.maxRevenue) * 100,
                          d.ordersCount > 0 ? 12 : 4
                        )
                      : 4;

                  const isHovered = hoveredBarIndex === idx;

                  return (
                    <div
                      key={d.dateStr}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    >
                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <div className="absolute -top-12 z-20 bg-zinc-950 text-white text-[11px] py-1 px-2.5 rounded-xl shadow-lg whitespace-nowrap pointer-events-none transition-all">
                          <div className="font-semibold">₹{d.revenue.toLocaleString("en-IN")}</div>
                          <div className="text-[10px] text-zinc-400">
                            {d.ordersCount} {d.ordersCount === 1 ? "order" : "orders"}
                          </div>
                        </div>
                      )}

                      {/* Top label if orders present */}
                      {d.ordersCount > 0 && !isHovered && (
                        <span className="text-[10px] font-semibold text-zinc-700 mb-1">
                          {d.ordersCount}
                        </span>
                      )}

                      {/* Bar Pillar */}
                      <div className="w-full max-w-[48px] bg-zinc-100 rounded-xl relative flex flex-col justify-end overflow-hidden h-full">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-xl transition-all duration-300 ${
                            isHovered
                              ? "bg-zinc-700"
                              : d.revenue > 0
                              ? "bg-zinc-900"
                              : "bg-zinc-200"
                          }`}
                        />
                      </div>

                      {/* X-axis Day Label */}
                      <span className="text-[11px] text-zinc-600 mt-2 font-medium tracking-tight">
                        {d.label.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom summary note */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                Past 7 calendar days snapshot
              </span>
              <span className="font-semibold text-zinc-800">
                Peak: ₹{last7DaysData.maxRevenue.toLocaleString("en-IN")} / day
              </span>
            </div>
          </div>

          {/* Right Column: Status & Flavour Breakdown (1 col) */}
          <div className="space-y-6">
            {/* Pipeline Stage Distribution */}
            <div className="p-5 rounded-3xl bg-white border border-zinc-200/90 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-zinc-950">
                Order Pipeline Stages
              </h3>
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-zinc-700 font-medium mb-1">
                    <span>Delivered & Closed</span>
                    <span>{stats.statusCounts.completed}</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalOrders > 0
                            ? (stats.statusCounts.completed / stats.totalOrders) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-700 font-medium mb-1">
                    <span>Active in Kitchen (Baked / Ready)</span>
                    <span>{stats.statusCounts.baked}</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalOrders > 0
                            ? (stats.statusCounts.baked / stats.totalOrders) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-700 font-medium mb-1">
                    <span>Confirmed (In Pipeline)</span>
                    <span>{stats.statusCounts.confirmed}</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalOrders > 0
                            ? (stats.statusCounts.confirmed / stats.totalOrders) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-zinc-700 font-medium mb-1">
                    <span>Awaiting Token Payment</span>
                    <span>{stats.statusCounts.pending_token}</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div
                      className="bg-zinc-400 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalOrders > 0
                            ? (stats.statusCounts.pending_token / stats.totalOrders) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Flavours Leaderboard */}
            <div className="p-5 rounded-3xl bg-white border border-zinc-200/90 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-zinc-950">
                Top Requested Flavours
              </h3>
              <div className="space-y-2">
                {stats.topFlavours.length === 0 ? (
                  <p className="text-xs text-zinc-600">No orders recorded yet.</p>
                ) : (
                  stats.topFlavours.map(([flavour, count], i) => (
                    <div
                      key={flavour}
                      className="flex items-center justify-between text-xs py-1 border-b border-zinc-50 last:border-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600 flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="font-medium text-zinc-800">{flavour}</span>
                      </div>
                      <span className="font-semibold text-zinc-950">
                        {count} {count === 1 ? "order" : "orders"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bakery Studios Directory */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">
                Partner Bakery Studios ({bakers.length})
              </h2>
              <p className="text-xs text-zinc-500">
                Manage individual studios, copy secret POS magic links, and inspect orders.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-900 text-xs font-semibold hover:bg-zinc-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Studio
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bakers.map((baker) => {
              const bakerOrders = orders.filter((o) => o.baker_id === baker.id);
              const bakerRevenue = bakerOrders.reduce(
                (acc, o) => acc + (Number(o.total_price) || 0),
                0
              );

              return (
                <div
                  key={baker.id}
                  className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-xs flex flex-col justify-between space-y-4 group hover:border-zinc-300 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-zinc-950">
                          {baker.name}
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          /{baker.slug}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </div>

                    {/* Quick Studio Stats */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#f4f4f5] text-[11px]">
                      <div>
                        <div className="text-zinc-600">Orders</div>
                        <div className="font-bold text-zinc-900">
                          {bakerOrders.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-600">Volume</div>
                        <div className="font-bold text-zinc-900">
                          ₹{bakerRevenue.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-zinc-500">
                      <div>
                        <span className="text-zinc-600 font-medium">WhatsApp:</span> +
                        {baker.phone}
                      </div>
                      <div>
                        <span className="text-zinc-600 font-medium">UPI:</span>{" "}
                        <span className="font-mono text-zinc-800">{baker.upi_id}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-zinc-600 font-medium">Location:</span>{" "}
                        {baker.pickup_address}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                    <button
                      onClick={() => copyMagicLink(baker.secret_token, baker.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      {copiedId === baker.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Magic Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`/baker?token=${baker.secret_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200 transition-colors"
                      title="Open POS Terminal"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleDeleteBaker(baker.id, baker.name)}
                      className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors"
                      title="Delete Bakery"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cross-Studio Recent Orders Live Feed */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">
                Cross-Studio Live Feed ({orders.length})
              </h2>
              <p className="text-xs text-zinc-500">
                Real-time orders flowing across all registered studios.
              </p>
            </div>
          </div>

          <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f4f4f5] text-zinc-600 font-semibold border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Bakery</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Flavour & Weight</th>
                    <th className="py-3 px-4">Delivery Slot</th>
                    <th className="py-3 px-4">Total / Token</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        No orders recorded in the system yet.
                      </td>
                    </tr>
                  ) : (
                    orders.slice(0, 10).map((order) => {
                      const bakerObj = bakers.find((b) => b.id === order.baker_id);
                      return (
                        <tr key={order.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                            {order.order_number}
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-700">
                            {bakerObj ? bakerObj.name : "Studio"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-zinc-900">
                              {order.customer_name || "Guest"}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              {order.customer_phone}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-zinc-800">
                              {order.flavour}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {order.weight} • {order.is_eggless ? "Eggless" : "Egg"}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-zinc-600">
                            <div>{order.delivery_date}</div>
                            <div className="text-[10px] text-zinc-400">
                              {order.time_slot}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-zinc-950">
                              ₹{order.total_price}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-medium">
                              Paid: ₹{order.token_amount}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                order.status === "completed"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : order.status === "baked"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : order.status === "confirmed"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : order.status === "cancelled"
                                  ? "bg-red-50 text-red-600 border border-red-200"
                                  : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                              }`}
                            >
                              {order.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={`/o/${order.order_number.replace("#", "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-400 hover:text-zinc-950 transition-colors inline-block p-1"
                              title="Open Customer Receipt"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Modal: Add Bakery */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Add Partner Bakery</h3>
                  <p className="text-xs text-zinc-500">Provision unique POS magic link</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-950 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateBaker} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-600 mb-1 font-semibold">Bakery Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Creme Studio"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug)
                        setSlug(
                          e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-")
                        );
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 focus:outline-none focus:bg-white focus:border-zinc-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-600 mb-1 font-semibold">Slug</label>
                    <input
                      type="text"
                      required
                      placeholder="creme-studio"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 font-mono focus:outline-none focus:bg-white focus:border-zinc-300"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1 font-semibold">Default Token (₹)</label>
                    <input
                      type="number"
                      required
                      min={50}
                      step={50}
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 focus:outline-none focus:bg-white focus:border-zinc-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-600 mb-1 font-semibold">WhatsApp Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 font-mono focus:outline-none focus:bg-white focus:border-zinc-300"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 mb-1 font-semibold">UPI ID</label>
                  <input
                    type="text"
                    required
                    placeholder="baker@okhdfcbank"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 font-mono focus:outline-none focus:bg-white focus:border-zinc-300"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 mb-1 font-semibold">Studio Address</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Complete kitchen or pickup location"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 focus:outline-none focus:bg-white focus:border-zinc-300 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 text-zinc-500 hover:text-zinc-950 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-zinc-950 text-white font-semibold hover:bg-zinc-800 transition-all shadow-sm"
                  >
                    Provision Studio & Magic Link
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
