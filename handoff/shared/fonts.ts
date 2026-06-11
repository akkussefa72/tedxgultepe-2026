import { Anton, Inter } from "next/font/google";

/**
 * Shared font instances. Exported so both the root layout and the canvas
 * text-sampler can reference the *same* generated family name
 * (`display.style.fontFamily`) — otherwise the particles would form letters
 * shaped by a fallback font.
 */
export const display = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"], // latin-ext → Turkish Ü/ü for "TEDxGÜLTEPE"
  variable: "--font-display",
  display: "swap",
});

export const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
