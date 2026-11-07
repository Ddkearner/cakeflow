"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";
import { ArrowRight, ChefHat, Search } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [orderQuery, setOrderQuery] = useState("");

  const handleSearchOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = orderQuery.trim().toUpperCase().replace("#", "");
    if (clean) {
      router.push(`/o/${clean}`);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-white px-4 py-12 text-zinc-950">
      <div className="z-10 max-w-md w-full space-y-8 text-center">
        {/* Brand Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Ready for Real Bakers & Orders</span>
          </div>
          <h1 className="select-none text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-950">
            CakeFlow
          </h1>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Instant WhatsApp advance tokens & kitchen queue for home bakers and studios.
          </p>
        </div>

        {/* Primary Action: Open Kitchen POS */}
        <div className="space-y-3">
          <Link href="/baker" className="block w-full">
            <button
              type="button"
              className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
            >
              <ChefHat className="w-4 h-4 text-zinc-400" />
              <span>Open Kitchen POS Dashboard</span>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </button>
          </Link>

          {/* Customer Order Search Form */}
          <form
            onSubmit={handleSearchOrder}
            className="flex items-center gap-2 p-1.5 bg-[#f4f4f5] rounded-2xl border border-zinc-200/60"
          >
            <div className="flex-1 flex items-center gap-2 px-3">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Track Order # (e.g. CK-482)"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!orderQuery.trim()}
              className="px-4 py-2 rounded-xl bg-zinc-950 disabled:bg-zinc-300 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
            >
              Go
            </button>
          </form>
        </div>

        <div className="text-[11px] text-zinc-400">
          Zero middleman fees • Direct UPI • WhatsApp booking links
        </div>
      </div>

      <DotPattern
        width={20}
        height={20}
        cx={1}
        cy={1}
        cr={1}
        className={cn(
          "fill-neutral-300",
          "[mask-image:radial-gradient(350px_circle_at_center,white,transparent)]"
        )}
      />
    </div>
  );
}
