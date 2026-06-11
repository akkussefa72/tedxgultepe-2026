# TEDxGültepe 2026 — *Eşik*

Gültepe (Batman) için kurgusal, Awwwards tarzı bir TEDx etkinlik sitesi.
Editoryal kırmızı/siyah/kağıt tasarım, sinematik hareket, tamamen responsive — içerik Türkçe.

## Çalıştırma

Herhangi bir statik sunucu yeterli:

```bash
python3 -m http.server 8000
# → http://localhost:8000          (ana sayfa)
# → http://localhost:8000/basvuru.html   (başvuru formu)
```

(`index.html` doğrudan da açılır; ancak Three.js ve React ES-module importlarının
tutarlı çalışması için sunucu önerilir.)

## Sayfalar & bölümler

**index.html** — Hero (uçan kartlar: otomatik kayan Öne Çıkan Konuşmacılar, canlı geri
sayım, bilet doluluk çubuğu; Destekleyenler logo satırı) · 01 Tema · **Kırılma**
(interaktif cam interlüdü) · 02 Konuşmacılar · 03 Program · 04 Deneyim
(Mekan & Ulaşım dahil) · 05 Sahneden (geçmiş konuşmalar, yatay galeri) · 06 Hikayemiz &
Misyonumuz · **Kelimeler** (parçacık yazı interlüdü) · 07 Organizasyon Ekibi ·
08 Başvurular · 09 Partnerler · Biletler · 10 İletişim (mailto'lu form) · Footer

**İnterlüdler** (`handoff/` paketinden vanilla'ya port edildi):
- *Kırılma* (`js/kirilma.js`) — buzlu low-poly cam; tıklayınca kırılıp dökülür, altından
  Eşik manifestosu çıkar. Saf 2D canvas, **bağımlılık yok**. Ekran dışında durur;
  "Hepsini kır" butonu klavye/dokunmatik için kestirme; reduced-motion'da cam hiç kurulmaz.
- *Kelimeler* (`js/parcacik.js`) — CESARET → FİKİR → TOPLULUK → EŞİK → TEDxGÜLTEPE
  kelimeleri parçacıklardan toplanıp birbirine dönüşür, imleçten kaçar. three.js (CDN),
  lazy-init + görünürlükte duraklatma; WebGL yoksa statik başlık.

**basvuru.html** — React tabanlı çok adımlı başvuru formu (Gönüllü / Sponsor /
Konuşmacı). `?tip=gonullu|sponsor|konusmaci` parametresiyle tür ön seçilir. Tür seçimi →
türe özel alanlar + canlı doğrulama → özet → `mailto:` ile gönderim.

## Teknoloji

- **HTML/CSS/JS** — build adımı yok, semantik markup
- **GSAP 3.13** (ScrollTrigger + SplitText) — preloader, maskeli satır reveal'ları, scrub'lı kelime boyama, pinli yatay galeri, sayaçlar, hero kart rotasyonu/süzülmesi
- **Lenis** — pürüzsüz kaydırma, GSAP ticker'ına senkron
- **Three.js (r160, ES module)** — hero parçacık alanı: nefes alan, imleçle eğilen, kaydırınca dağılan 14 bin noktalı "X"
- **React 18 + htm (esm.sh, ES module)** — yalnızca başvuru sayfasında; adım yönetimi, koşullu alanlar, canlı Türkçe doğrulama. Babel/build gerekmez.
- **Fontlar** — Anton (display) · Instrument Serif (editoryal vurgu) · Archivo (gövde)

## Performans & erişilebilirlik notları

- `prefers-reduced-motion`: preloader kaldırılır, animasyonlar atlanır, hero tek statik kare çizer, kart rotasyonu durur
- Hero canvas `IntersectionObserver` + `visibilitychange` ile duraklar; DPR sınırlı (mobil 1.5 / masaüstü 2); mobilde parçacık sayısı yarıya iner
- Zarif bozulma: JS yok → statik sayfa; CDN çökerse → içerik okunur kalır (başvuru sayfasında mailto listesi); WebGL yoksa → CSS glow
- Skip link, focus-visible stilleri, semantik landmark'lar, `aria-expanded` menü durumu, ESC menüyü kapatır
- Görseller lazy-load + sabit boyut (CLS yok); yatay galeri 900px altında doğal scroll-snap'e döner; hero uçan kartları 1100px altında gizlenir

## Yasal not

Bu kurgusal bir gösterim projesidir. Tüm konuşmacılar, ekip üyeleri ve partnerler
hayalidir. "Bu bağımsız TEDx etkinliği TED lisansı ile düzenlenmektedir" cümlesi,
gerçeğe uygunluk için eklenen standart TEDx ibaresidir.
