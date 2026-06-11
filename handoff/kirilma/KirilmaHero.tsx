"use client";

import { useState } from "react";
import { HeroNav } from "@/components/ui/HeroNav";
import { KirilmaCanvas } from "./KirilmaCanvas";

export function KirilmaHero() {
  // 0 → no glass broken, 1 → all broken. Drives the progress bar.
  const [progress, setProgress] = useState(0);
  const pct = Math.round(progress * 100);

  return (
    <main className="hide-native-cursor relative h-[100svh] w-full overflow-hidden bg-[#08080b]">
      {/* ---- content BEHIND the glass (z-0); the glass above fades it ---- */}
      <div className="absolute inset-0 z-0">
        {/* neutral cinematic vignette (no red blob) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.6)_100%)]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.5em] text-white/55">
            TEDxGÜLTEPE · 1 HAZİRAN 2026
          </p>

          <h1
            aria-label="MSA"
            className="select-none font-sans font-black leading-none text-white"
            style={{
              fontSize: "clamp(4rem, 17vw, 15rem)",
              letterSpacing: "0.1em",
              textShadow: `0 0 ${18 + progress * 26}px rgba(235,0,40,${0.1 + progress * 0.16})`,
            }}
          >
            <span>M</span>
            <span className="text-tedx-red">S</span>
            <span>A</span>
          </h1>

          <p className="mt-7 text-sm font-medium tracking-[0.04em] text-white/80 sm:text-lg">
            Her <span className="text-tedx-red">kırılma</span>, yeni bir başlangıçtır.
          </p>

          <p className="mt-4 max-w-xl text-xs leading-relaxed text-white/55 sm:text-sm">
            Kalıpların kırıldığı yerde yeni fikirler doğar. Bu yıl, kırılma
            anlarının ardındaki cesareti ve dönüşümü sahneye taşıyoruz.
          </p>

          <div className="mt-9 flex flex-col items-center gap-6">
            <span className="h-px w-16 bg-white/20" />
            <a
              href="#basvuru"
              data-no-shatter
              className="pointer-events-auto group inline-flex items-center gap-2 rounded-full border border-tedx-red/70 px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-tedx-red transition-colors duration-300 hover:bg-tedx-red hover:text-white"
            >
              Sahne Senin
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* ---- glass (z-10) + falling pieces / cursor (z-20) ---- */}
      <KirilmaCanvas onProgress={setProgress} />

      {/* ---- crisp overlay (z-30) ---- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] bg-gradient-to-r from-tedx-red via-tedx-red/60 to-transparent" />

      <HeroNav switchTo={{ href: "/particle", label: "TEDxGÜLTEPE" }} />

      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex flex-col items-center gap-3">
        <div className="w-64 max-w-[70vw]">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.3em] text-white/60">
            <span>{pct >= 100 ? "Gerçek ortaya çıktı" : "İlerleme"}</span>
            <span>%{pct}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-tedx-red transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="animate-pulse-soft text-[10px] uppercase tracking-[0.35em] text-white/60">
          Tıkla ve camı kır
        </span>
      </div>
    </main>
  );
}
