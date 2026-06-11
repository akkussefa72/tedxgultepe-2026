# TEDx Hero Bölümleri — Taşıma Paketi

Bu paket, TedxGultepe projesindeki iki tam-ekran hero bölümünü başka bir
Next.js (App Router) projesine taşımak için hazırlandı. Her bölüm
`h-[100svh]` tam-ekran bir `<main>` olarak tasarlandı; ana sayfada bir
bölüm (section) olarak kullanacaksan `<main>`'i `<section>`'a çevirip
yüksekliği ihtiyaca göre ayarlaman yeterli.

## 1. Kırılma (cam kırma hero) — `kirilma/`

Tıklayınca low-poly cam yüzeyi kırılıp dökülen, altından içeriğin çıktığı
interaktif bölüm.

| Dosya | Ne yapar |
|---|---|
| `KirilmaHero.tsx` | Bölümün düzeni: başlık, alt metin, CTA, ilerleme çubuğu |
| `KirilmaCanvas.tsx` | Motorun tamamı — saf 2D canvas, **hiçbir npm bağımlılığı yok** (sadece React) |

- Üçüncü parti paket gerektirmez. Three.js, GSAP vb. **gerekmez**.
- `KirilmaHero` içindeki metinler (MSA, tarih, slogan) projeye göre değiştirilebilir;
  `KirilmaCanvas` dokunulmadan çalışır. `onProgress` callback'i 0–1 arası kırılma
  oranı verir, istersen kullanma.
- `HeroNav` import'u bu projeye özel — diğer projede satırı silebilir veya
  `shared/HeroNav.tsx`'i de taşıyabilirsin.
- Özel imleç için `globals.css`'teki `.hide-native-cursor` bloğu gerekli (aşağıda).

## 2. Particle Text (parçacık yazı hero) — `particle/`

Kelimelerin parçacıklardan toplanıp dağılarak birbirine dönüştüğü,
imleçten kaçan WebGL bölümü.

| Dosya | Ne yapar |
|---|---|
| `ParticleTextHero.tsx` | Düzen: kelime döngüsü, ilerleme noktaları, caption, scroll ipucu |
| `ParticleTextScene.tsx` | R3F sahnesi + fizik; `PARTICLE_WORDS` listesi burada — kelimeleri buradan değiştir |
| `particleShaders.ts` | Vertex/fragment shader'lar |
| `textToPoints.ts` | Yazıyı offscreen canvas'ta örnekleyip parçacık noktalarına çevirir |

- npm bağımlılıkları: `three`, `@react-three/fiber`, `gsap`
  ```bash
  npm i three @react-three/fiber gsap
  npm i -D @types/three
  ```
- `shared/` içinden şunlar da gerekli: `SceneBoundary.tsx` (WebGL hata sınırı),
  `useReducedMotion.ts`, `fonts.ts` (parçacıkların harf şekli için display
  fontun **aynı instance'ı** gerekir — `ParticleTextScene` `display`'i
  `lib/fonts`'tan import eder).
- `HeroNav` yine opsiyonel.

## 3. Diğer projede yapılacak kurulum

### Dosya yerleşimi (önerilen)

```
components/kirilma/KirilmaHero.tsx, KirilmaCanvas.tsx
components/particle/ParticleTextHero.tsx, ParticleTextScene.tsx, particleShaders.ts, textToPoints.ts
components/ui/SceneBoundary.tsx        (particle için zorunlu)
components/ui/HeroNav.tsx              (opsiyonel)
lib/useReducedMotion.ts                (particle için zorunlu)
lib/fonts.ts                           (particle için zorunlu)
```

Import yolları `@/components/...` ve `@/lib/...` şeklinde; tsconfig'de
`"paths": { "@/*": ["./*"] }` alias'ı yoksa ekle veya yolları düzelt.

### tailwind.config — `theme.extend` içine

```ts
colors: {
  tedx: { red: "#EB0028", ember: "#FF5630", ink: "#050507", coal: "#0b0b0f" },
},
fontFamily: {
  display: ["var(--font-display)", "system-ui", "sans-serif"],
  sans: ["var(--font-body)", "system-ui", "sans-serif"],
},
keyframes: {
  "pulse-soft": { "0%, 100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
},
animation: {
  "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
},
```

### globals.css — eklenecek blok (kirilma'nın özel imleci için)

```css
@media (pointer: fine) {
  .hide-native-cursor,
  .hide-native-cursor * {
    cursor: none;
  }
}
```

### Root layout — font değişkenleri (particle için)

```tsx
import { display, body } from "@/lib/fonts";

<html className={`${display.variable} ${body.variable}`}>
```

### Ana sayfada kullanım

```tsx
import { KirilmaHero } from "@/components/kirilma/KirilmaHero";
import { ParticleTextHero } from "@/components/particle/ParticleTextHero";

export default function Home() {
  return (
    <>
      <KirilmaHero />
      <ParticleTextHero />
      {/* diğer bölümler */}
    </>
  );
}
```

> Not: İkisi de kendi `<main>` etiketini render eder. Aynı sayfada ikisini
> birden kullanacaksan bileşenlerin kök etiketini `<section>` yap (tek
> satırlık değişiklik), sayfada tek bir `<main>` kalsın.
