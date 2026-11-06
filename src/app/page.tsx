"use client";

import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-white">
      <h1 className="z-10 select-none text-center text-5xl md:text-6xl font-medium tracking-tighter text-black">
        Cakeflow
      </h1>

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
