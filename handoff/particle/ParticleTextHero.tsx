"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { HeroNav } from "@/components/ui/HeroNav";
import { SceneBoundary } from "@/components/ui/SceneBoundary";
import { PARTICLE_WORDS } from "./ParticleTextScene";

const ParticleTextScene = dynamic(() => import("./ParticleTextScene"), {
  ssr: false,
});

const CYCLE_MS = 3600;

export function ParticleTextHero() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const captionRef = useRef<HTMLSpanElement>(null);

  // Auto-advance the words (paused for reduced-motion users).
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PARTICLE_WORDS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  // GSAP crossfade of the small caption whenever the active word changes.
  useEffect(() => {
    if (reduced || !captionRef.current) return;
    gsap.fromTo(
      captionRef.current,
      { opacity: 0, y: 8, filter: "blur(6px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power2.out" }
    );
  }, [index, reduced]);

  const word = PARTICLE_WORDS[index];

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-tedx-ink">
      {/* ambient red glow behind the particles */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-tedx-red/10 blur-[150px]" />
      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(5,5,7,0.85)_100%)]" />

      <SceneBoundary>
        <ParticleTextScene wordIndex={index} reduced={reduced} />
      </SceneBoundary>

      <HeroNav switchTo={{ href: "/kirilma", label: "KIRILMA" }} />

      {/* top brand lockup */}
      <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 text-center sm:top-24">
        <p className="text-[11px] font-medium uppercase tracking-[0.45em] text-white/45">
          Ideas worth spreading
        </p>
      </div>

      {/* bottom overlay: progress + live caption + scroll cue */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-6 pb-12 sm:pb-14">
        <div className="flex items-center gap-3" aria-hidden="true">
          {PARTICLE_WORDS.map((_, i) => (
            <span
              key={i}
              className={`h-[3px] rounded-full transition-all duration-500 ${
                i === index
                  ? "w-10 bg-tedx-red"
                  : "w-5 bg-white/20"
              }`}
            />
          ))}
        </div>

        <span
          ref={captionRef}
          className="font-display text-sm uppercase tracking-[0.4em] text-white/70"
        >
          {word === "TEDxGÜLTEPE" ? (
            <>
              <span className="text-tedx-red">TEDx</span>GÜLTEPE
            </>
          ) : (
            word
          )}
        </span>

        <div className="flex flex-col items-center gap-2 text-white/30">
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <span className="block h-8 w-px bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </div>

      {/* Accessible live region announcing the current word. */}
      <p className="sr-only" aria-live="polite">
        Current word: {word}
      </p>
    </main>
  );
}
