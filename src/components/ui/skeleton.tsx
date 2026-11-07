"use client";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-zinc-200/60 animate-pulse",
        className
      )}
      {...props}
    />
  );
}

// 1. Kitchen POS Order Card Skeleton
export function KitchenCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-[#f4f4f5] border border-zinc-200/60 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-3 w-56 rounded-md" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="pt-2 border-t border-zinc-200/60 space-y-1.5">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-3 w-48 rounded-md" />
      </div>

      <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-16 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
    </div>
  );
}

// 2. Customer Checkout Page Skeleton
export function CheckoutPageSkeleton() {
  return (
    <div className="max-w-md mx-auto min-h-[100dvh] bg-white p-4 space-y-3.5 animate-pulse">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Card 1 Cake & Token Spotlight Skeleton */}
      <div className="p-4 rounded-3xl bg-[#f4f4f5] space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-3.5 w-36 rounded-md" />
        </div>
        <div className="pt-3 border-t border-zinc-200/60 flex justify-between items-end">
          <div className="space-y-1">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      </div>

      {/* Card 2 Handover & Details Skeleton */}
      <div className="p-4 rounded-3xl bg-[#f4f4f5] space-y-3.5">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-3.5 w-44 rounded-md" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// 3. Admin Dashboard Skeleton
export function AdminDashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <Skeleton className="h-3.5 w-52 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-6 w-24 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-24 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-3 w-48 rounded" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
