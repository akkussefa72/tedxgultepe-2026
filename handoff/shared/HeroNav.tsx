import Link from "next/link";

type HeroNavProps = {
  /** Label of the *other* hero to switch to. */
  switchTo: { href: string; label: string };
};

/**
 * Slim top bar shown on each hero page: back to index + jump to the other hero.
 * Kept visually quiet so it never competes with the hero itself.
 */
export function HeroNav({ switchTo }: HeroNavProps) {
  return (
    <nav className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 sm:px-10">
      <Link
        href="/"
        className="pointer-events-auto group flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/60 transition-colors hover:text-white"
      >
        <span className="inline-block transition-transform group-hover:-translate-x-0.5">
          ←
        </span>
        Index
      </Link>

      <Link
        href={switchTo.href}
        className="pointer-events-auto group flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/60 transition-colors hover:text-white"
      >
        {switchTo.label}
        <span className="inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </nav>
  );
}
