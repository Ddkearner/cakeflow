"use client";

import { useState, useEffect } from "react";
import { Baker } from "@/lib/types";
import { getLocalBakers, saveLocalBaker, getLocalOrders } from "@/lib/store";
import { generateSecretToken } from "@/lib/utils";
import {
  Plus,
  ExternalLink,
} from "lucide-react";

export default function AdminPage() {
  const [bakers, setBakers] = useState<Baker[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("91");
  const [upiId, setUpiId] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [tokenAmount, setTokenAmount] = useState(100);

  useEffect(() => {
    const list = getLocalBakers();
    setBakers(list);
    const orders = getLocalOrders();
    setTotalOrdersCount(orders.length);
  }, []);

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
    setBakers(getLocalBakers());
    setShowAddModal(false);

    setName("");
    setSlug("");
    setPhone("91");
    setUpiId("");
    setPickupAddress("");
    setTokenAmount(100);
  };

  const copyMagicLink = (token: string, id: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const magicLink = `${origin}/baker?token=${token}`;
    navigator.clipboard.writeText(magicLink);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-950 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              Admin
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Manage baker studios and magic link access.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Baker
          </button>
        </header>

        {/* Directory */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bakers.map((baker) => (
            <div
              key={baker.id}
              className="p-5 rounded-2xl bg-[#f4f4f5] border border-zinc-200/80 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-950">{baker.name}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">/{baker.slug}</p>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-zinc-600">
                  Active
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-500">
                <div>Phone: +{baker.phone}</div>
                <div>UPI: {baker.upi_id}</div>
                <div className="truncate">Address: {baker.pickup_address}</div>
              </div>

              <div className="pt-3 border-t border-zinc-200/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => copyMagicLink(baker.secret_token, baker.id)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  {copiedId === baker.id ? "Link Copied" : "Copy Magic Link"}
                </button>
                <a
                  href={`/baker?token=${baker.secret_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-950"
                  title="Open POS"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-950">Add Bakery</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-zinc-400 hover:text-zinc-950 text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateBaker} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-600 mb-1 font-medium">Bakery Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Creme Studio"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 focus:outline-none focus:bg-white focus:border-zinc-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-600 mb-1 font-medium">Slug</label>
                    <input
                      type="text"
                      required
                      placeholder="creme-studio"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 font-mono focus:outline-none focus:bg-white focus:border-zinc-300"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1 font-medium">Default Token (₹)</label>
                    <input
                      type="number"
                      required
                      min={50}
                      step={50}
                      value={tokenAmount}
                      onChange={(e) => setTokenAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 focus:outline-none focus:bg-white focus:border-zinc-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-600 mb-1 font-medium">WhatsApp Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 font-mono focus:outline-none focus:bg-white focus:border-zinc-300"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 mb-1 font-medium">UPI ID</label>
                  <input
                    type="text"
                    required
                    placeholder="baker@okhdfcbank"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 font-mono focus:outline-none focus:bg-white focus:border-zinc-300"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 mb-1 font-medium">Address</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Store address"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#f4f4f5] border border-transparent text-zinc-950 focus:outline-none focus:bg-white focus:border-zinc-300 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-2 text-zinc-500 hover:text-zinc-950"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-black text-white font-medium hover:bg-zinc-800"
                  >
                    Save & Generate Link
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
