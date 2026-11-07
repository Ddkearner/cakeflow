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
  Eye,
  EyeOff,
  LogOut,
  X,
} from "lucide-react";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "124520";

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
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Add Baker Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("91");
  const [upiId, setUpiId] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [tokenAmount, setTokenAmount] = useState(100);

  // Check session on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("cakeflow_admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
      setIsAuthChecking(false);
    }
  }, []);

  const refreshData = () => {
    setBakers(getLocalBakers());
    setOrders(getLocalOrders());
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      passwordInput === ADMIN_PASSWORD ||
      passwordInput === "124520" ||
      passwordInput === "admin@cakeflow"
    ) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cakeflow_admin_auth", "true");
      }
      setIsAuthenticated(true);
      setAuthError("");
      setPasswordInput("");
    } else {
      setAuthError("Incorrect password. Please try again.");
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
    if (window.confirm(`Delete ${bakerName}? This cannot be undone.`)) {
      deleteLocalBaker(bakerId);
      refreshData();
    }
  };

  const copyMagicLink = (token: string, id: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const magicLink = `${origin}/baker?token=${token}`;
    navigator.clipboard.writeText(magicLink);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Metrics
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (acc, o) => acc + (Number(o.total_price) || 0),
      0
    );
    const advanceCollected = orders.reduce((acc, o) => {
      return o.status !== "pending_token" && o.status !== "cancelled"
        ? acc + (Number(o.token_amount) || 0)
        : acc;
    }, 0);

    return {
      totalOrders,
      totalRevenue,
      advanceCollected,
      totalBakers: bakers.length,
    };
  }, [orders, bakers]);

  // Last 7 Days Chart Data
  const chartData = useMemo(() => {
    const days: {
      dateStr: string;
      label: string;
      shortLabel: string;
      revenue: number;
      ordersCount: number;
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });
      const dayNum = d.getDate();

      const dayOrders = orders.filter((o) => {
        const orderDate = (o.created_at || o.delivery_date || "").slice(0, 10);
        return orderDate === dateStr;
      });

      const revenue = dayOrders.reduce(
        (acc, o) => acc + (Number(o.total_price) || 0),
        0
      );

      days.push({
        dateStr,
        label: `${dayName} ${dayNum}`,
        shortLabel: `${dayName}`,
        revenue,
        ordersCount: dayOrders.length,
      });
    }

    const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
    const weekTotal = days.reduce((sum, d) => sum + d.revenue, 0);
    const weekOrders = days.reduce((sum, d) => sum + d.ordersCount, 0);

    return { days, maxRevenue, weekTotal, weekOrders };
  }, [orders]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Login view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-zinc-900">Admin Login</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Enter your password to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError("");
                  }}
                  autoFocus
                  required
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
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
              <p className="text-xs text-red-600">{authError}</p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-3 text-xs font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors active:scale-[0.99]"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="max-w-5xl mx-auto px-3.5 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* Navigation / Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900">CakeFlow Admin</h1>
            <p className="text-xs text-zinc-500">
              Overview of bakeries, orders, and sales
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Baker</span>
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-xs font-medium hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4">
            <div className="text-[11px] sm:text-xs font-medium text-zinc-500">Total Revenue</div>
            <div className="text-lg sm:text-xl font-semibold text-zinc-900 mt-1">
              ₹{stats.totalRevenue.toLocaleString("en-IN")}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4">
            <div className="text-[11px] sm:text-xs font-medium text-zinc-500">Advance Collected</div>
            <div className="text-lg sm:text-xl font-semibold text-zinc-900 mt-1">
              ₹{stats.advanceCollected.toLocaleString("en-IN")}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4">
            <div className="text-[11px] sm:text-xs font-medium text-zinc-500">Total Orders</div>
            <div className="text-lg sm:text-xl font-semibold text-zinc-900 mt-1">
              {stats.totalOrders}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4">
            <div className="text-[11px] sm:text-xs font-medium text-zinc-500">Active Bakeries</div>
            <div className="text-lg sm:text-xl font-semibold text-zinc-900 mt-1">
              {stats.totalBakers}
            </div>
          </div>
        </div>

        {/* Past 7 Days Chart */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Past 7 Days</h2>
              <p className="text-xs text-zinc-500">
                Daily sales across all bakeries
              </p>
            </div>
            <div className="text-xs text-zinc-500 font-medium">
              ₹{chartData.weekTotal.toLocaleString("en-IN")} ({chartData.weekOrders} {chartData.weekOrders === 1 ? "order" : "orders"})
            </div>
          </div>

          {/* Selected day mobile banner */}
          {selectedDayIndex !== null && chartData.days[selectedDayIndex] && (
            <div className="p-2 sm:p-2.5 rounded-lg bg-zinc-100 text-xs flex items-center justify-between">
              <span className="font-medium text-zinc-800">
                {chartData.days[selectedDayIndex].label}:
              </span>
              <span className="text-zinc-900 font-semibold">
                ₹{chartData.days[selectedDayIndex].revenue.toLocaleString("en-IN")}{" "}
                <span className="font-normal text-zinc-500">
                  ({chartData.days[selectedDayIndex].ordersCount}{" "}
                  {chartData.days[selectedDayIndex].ordersCount === 1 ? "order" : "orders"})
                </span>
              </span>
            </div>
          )}

          <div className="pt-2 sm:pt-4">
            <div className="h-32 sm:h-36 flex items-end justify-between gap-1.5 sm:gap-3">
              {chartData.days.map((d, idx) => {
                const heightPercent =
                  chartData.maxRevenue > 0 && d.revenue > 0
                    ? Math.max((d.revenue / chartData.maxRevenue) * 100, 10)
                    : 4;

                const isSelected = selectedDayIndex === idx;

                return (
                  <div
                    key={d.dateStr}
                    onClick={() => setSelectedDayIndex(isSelected ? null : idx)}
                    className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group"
                  >
                    <div className="text-[10px] sm:text-[11px] font-medium text-zinc-600 mb-1 transition-opacity">
                      {d.ordersCount > 0 ? (
                        <span>₹{d.revenue}</span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 text-zinc-400">0</span>
                      )}
                    </div>

                    <div className="w-full max-w-[38px] sm:max-w-[42px] bg-zinc-100 rounded-md h-full flex flex-col justify-end overflow-hidden">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-md transition-all duration-200 ${
                          d.revenue > 0
                            ? isSelected
                              ? "bg-zinc-950"
                              : "bg-zinc-800 group-hover:bg-zinc-950"
                            : "bg-zinc-200"
                        }`}
                      />
                    </div>

                    <div className="text-[10px] sm:text-[11px] text-zinc-500 mt-2 font-medium">
                      <span className="sm:hidden">{d.shortLabel}</span>
                      <span className="hidden sm:inline">{d.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bakeries List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Bakeries ({bakers.length})
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              + Add new
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bakers.map((baker) => {
              const bakerOrders = orders.filter((o) => o.baker_id === baker.id);
              const bakerRevenue = bakerOrders.reduce(
                (sum, o) => sum + (Number(o.total_price) || 0),
                0
              );

              return (
                <div
                  key={baker.id}
                  className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4 flex flex-col justify-between gap-3.5"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900 truncate">
                          {baker.name}
                        </div>
                        <div className="text-xs text-zinc-400 font-mono truncate">
                          /{baker.slug}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500 text-right shrink-0">
                        <span className="font-medium text-zinc-900">{bakerOrders.length}</span> orders ·{" "}
                        <span className="font-medium text-zinc-900">₹{bakerRevenue}</span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500 space-y-0.5">
                      <div>WhatsApp: +{baker.phone}</div>
                      <div>UPI: {baker.upi_id}</div>
                      <div className="truncate">Address: {baker.pickup_address}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => copyMagicLink(baker.secret_token, baker.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      {copiedId === baker.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-zinc-900" />
                          <span>Link copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy magic link</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/baker?token=${baker.secret_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                        title="Open bakery view"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteBaker(baker.id, baker.name)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete bakery"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Orders Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Orders ({orders.length})
            </h2>
          </div>

          {/* Mobile Orders List (Card layout for phones - NO horizontal scrolling) */}
          <div className="space-y-2.5 md:hidden">
            {orders.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-xs text-zinc-400">
                No orders yet
              </div>
            ) : (
              orders.map((order) => {
                const bakerObj = bakers.find((b) => b.id === order.baker_id);
                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-semibold text-zinc-900">
                          {order.order_number}
                        </span>
                        <span className="text-xs text-zinc-300">·</span>
                        <span className="text-xs text-zinc-600 truncate">
                          {bakerObj ? bakerObj.name : "Studio"}
                        </span>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                          order.status === "completed"
                            ? "bg-zinc-100 text-zinc-800"
                            : order.status === "baked"
                            ? "bg-amber-50 text-amber-800"
                            : order.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-800"
                            : order.status === "cancelled"
                            ? "bg-red-50 text-red-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {order.status === "pending_token"
                          ? "Pending token"
                          : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-100">
                      <div>
                        <div className="font-medium text-zinc-900">
                          {order.customer_name || "Guest"}
                        </div>
                        {order.customer_phone && (
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {order.customer_phone}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-zinc-900">
                          ₹{order.total_price}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Token: ₹{order.token_amount}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-600 pt-2 border-t border-zinc-100">
                      <div className="truncate pr-2">
                        <span className="font-medium text-zinc-900">{order.flavour}</span>
                        <span className="text-zinc-400"> ({order.weight} · {order.is_eggless ? "Eggless" : "Egg"})</span>
                      </div>
                      <a
                        href={`/o/${order.order_number.replace("#", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-1 rounded hover:bg-zinc-200 transition-colors shrink-0"
                      >
                        <span>Receipt</span>
                        <ExternalLink className="w-3 h-3 text-zinc-500" />
                      </a>
                    </div>

                    <div className="text-[11px] text-zinc-400">
                      Delivery: {order.delivery_date} · {order.time_slot}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Orders Table (hidden on mobile, visible on tablet & desktop) */}
          <div className="hidden md:block rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200">
                  <tr>
                    <th className="py-2.5 px-4 font-normal">Order</th>
                    <th className="py-2.5 px-4 font-normal">Bakery</th>
                    <th className="py-2.5 px-4 font-normal">Customer</th>
                    <th className="py-2.5 px-4 font-normal">Cake</th>
                    <th className="py-2.5 px-4 font-normal">Date</th>
                    <th className="py-2.5 px-4 font-normal">Amount</th>
                    <th className="py-2.5 px-4 font-normal">Status</th>
                    <th className="py-2.5 px-4 font-normal text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        No orders yet
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const bakerObj = bakers.find((b) => b.id === order.baker_id);
                      return (
                        <tr key={order.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-medium text-zinc-900">
                            {order.order_number}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-600">
                            {bakerObj ? bakerObj.name : "—"}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="text-zinc-900">{order.customer_name || "Guest"}</div>
                            {order.customer_phone && (
                              <div className="text-zinc-400 font-mono">{order.customer_phone}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="text-zinc-900">{order.flavour}</div>
                            <div className="text-zinc-400">
                              {order.weight} · {order.is_eggless ? "Eggless" : "Egg"}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-zinc-600">
                            <div>{order.delivery_date}</div>
                            <div className="text-zinc-400">{order.time_slot}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-zinc-900">₹{order.total_price}</div>
                            <div className="text-zinc-400">Token: ₹{order.token_amount}</div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                order.status === "completed"
                                  ? "bg-zinc-100 text-zinc-800"
                                  : order.status === "baked"
                                  ? "bg-amber-50 text-amber-800"
                                  : order.status === "confirmed"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : order.status === "cancelled"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {order.status === "pending_token"
                                ? "Pending token"
                                : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <a
                              href={`/o/${order.order_number.replace("#", "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-400 hover:text-zinc-900 p-1 inline-block"
                              title="Open receipt"
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

        {/* Add Baker Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">Add Bakery</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBaker} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-700 mb-1 font-medium">Bakery Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Creme Studio"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug) {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 focus:outline-none focus:border-zinc-400 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-700 mb-1 font-medium">Slug</label>
                    <input
                      type="text"
                      required
                      placeholder="creme-studio"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 font-mono focus:outline-none focus:border-zinc-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 mb-1 font-medium">Token (₹)</label>
                    <input
                      type="number"
                      required
                      min={50}
                      step={50}
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 focus:outline-none focus:border-zinc-400 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-700 mb-1 font-medium">WhatsApp Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 font-mono focus:outline-none focus:border-zinc-400 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 mb-1 font-medium">UPI ID</label>
                  <input
                    type="text"
                    required
                    placeholder="baker@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 font-mono focus:outline-none focus:border-zinc-400 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 mb-1 font-medium">Address</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Pickup address"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-zinc-900 focus:outline-none focus:border-zinc-400 resize-none text-sm"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-2 text-zinc-600 hover:text-zinc-900 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Save Baker
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
