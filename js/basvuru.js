/* ============================================================
   TEDxGültepe 2026 — Başvuru sayfası (React)
   React 18 + htm, esm.sh üzerinden ESM olarak — build adımı yok.
   Çok adımlı form: tür seçimi → bilgiler → özet → mailto gönderim.
   ============================================================ */

(async () => {
  let React, createRoot, htm;
  try {
    [{ default: React }, { createRoot }, { default: htm }] = await Promise.all([
      import("https://esm.sh/react@18.3.1"),
      import("https://esm.sh/react-dom@18.3.1/client"),
      import("https://esm.sh/htm@3.1.1"),
    ]);
  } catch (err) {
    document.getElementById("root").hidden = true;
    document.getElementById("fallback").hidden = false;
    return;
  }

  const html = htm.bind(React.createElement);
  const { useState } = React;

  /* ---------- Başvuru türleri ---------- */
  const TYPES = {
    gonullu: {
      key: "gonullu",
      idx: "a",
      label: "Gönüllü",
      desc: "Sahne arkasında dur. Kaydı, karşılamayı, prodüksiyonu birlikte taşıyalım.",
      email: "gonullu@tedxgultepe.com",
    },
    sponsor: {
      key: "sponsor",
      idx: "b",
      label: "Sponsor",
      desc: "Adını tepeye yaz. Mahallenin sahnesine güç kat, fikirlerin yanında dur.",
      email: "partner@tedxgultepe.com",
    },
    konusmaci: {
      key: "konusmaci",
      idx: "c",
      label: "Konuşmacı",
      desc: "Fikrini 12 dakikada sahneye taşı. Not yok, geri dönüş yok.",
      email: "sahne@tedxgultepe.com",
    },
  };

  /* ---------- Form alanları ---------- */
  const COMMON_FIELDS = [
    { id: "adSoyad", label: "Ad Soyad", type: "text", required: true, placeholder: "Adınız Soyadınız" },
    { id: "email", label: "E-posta", type: "email", required: true, placeholder: "ornek@eposta.com" },
    { id: "telefon", label: "Telefon (isteğe bağlı)", type: "tel", required: false, placeholder: "+90 5xx xxx xx xx" },
  ];

  const TYPE_FIELDS = {
    gonullu: [
      {
        id: "ekip", label: "Ekip tercihi", type: "select", required: true,
        options: ["Prodüksiyon", "Karşılama", "Sosyal Medya", "Teknik"],
      },
      {
        id: "motivasyon", label: "Neden TEDxGültepe'de gönüllü olmak istiyorsun?",
        type: "textarea", required: true, minLength: 30,
        placeholder: "Birkaç cümle yeter — seni tanıyalım.",
      },
      { id: "uygunluk", label: "17 Ekim 2026 Cumartesi günü tüm gün müsaitim.", type: "checkbox", required: true },
    ],
    sponsor: [
      { id: "kurum", label: "Kurum adı", type: "text", required: true, placeholder: "Şirket / marka adı" },
      { id: "website", label: "Web sitesi (isteğe bağlı)", type: "url", required: false, placeholder: "https://" },
      {
        id: "seviye", label: "Sponsorluk seviyesi", type: "select", required: true,
        options: ["Ana Partner", "Destekçi", "Ürün Sponsorluğu"],
      },
      {
        id: "mesaj", label: "Mesajınız (isteğe bağlı)", type: "textarea", required: false,
        placeholder: "Nasıl bir iş birliği hayal ediyorsunuz?",
      },
    ],
    konusmaci: [
      { id: "baslik", label: "Konuşma başlığı", type: "text", required: true, placeholder: "Fikrini tek cümleyle söyle" },
      {
        id: "ozet", label: "Fikrinin özeti", type: "textarea", required: true,
        minLength: 300, maxLength: 600, counter: true,
        hint: "300–600 karakter. Eşik temasıyla bağını anlat.",
        placeholder: "Bu fikir neden önemli? Eşikle bağı ne? Seyirci salondan ne götürecek?",
      },
      { id: "video", label: "Video bağlantısı (isteğe bağlı)", type: "url", required: false, placeholder: "YouTube / Vimeo" },
      { id: "onay", label: "Konuşmamın 12 dakikalık TEDx formatına uyacağını kabul ediyorum.", type: "checkbox", required: true },
    ],
  };

  const STEPS = ["Tür", "Bilgiler", "Özet"];

  /* ---------- Doğrulama ---------- */
  function validateField(f, value) {
    if (f.type === "checkbox") {
      return f.required && !value ? "Devam etmek için onaylamanız gerekiyor." : "";
    }
    const val = (value ?? "").toString().trim();
    if (f.required && !val) {
      return f.type === "select" ? "Bir seçenek belirleyin." : "Bu alan zorunlu.";
    }
    if (!val) return "";
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return "Geçerli bir e-posta adresi girin.";
    }
    if (f.type === "url" && !/^https?:\/\/\S+\.\S+/.test(val)) {
      return "Geçerli bir bağlantı girin (https:// ile başlamalı).";
    }
    if (f.minLength && val.length < f.minLength) {
      return `En az ${f.minLength} karakter yazın (şu an ${val.length}).`;
    }
    return "";
  }

  /* ---------- Bileşenler ---------- */
  function Steps({ step }) {
    return html`
      <ol className="bv-steps" aria-label="Başvuru adımları">
        ${STEPS.map(
          (name, i) => html`
            <li
              key=${name}
              className=${"bv-step" + (step === i + 1 ? " is-on" : "") + (step > i + 1 ? " is-done" : "")}
            >
              <b>${String(i + 1).padStart(2, "0")}</b>${name}${step > i + 1 ? " ✓" : ""}
            </li>
          `
        )}
      </ol>
    `;
  }

  function TypePicker({ onPick }) {
    return html`
      <div className="bv-panel" key="step1">
        <h1 className="bv-title">Eşikte <em>yerini al.</em></h1>
        <p className="bv-sub">
          Bu sahne mahallenin. Nasıl katılmak istediğini seç — formun gerisi sana göre şekillenir.
        </p>
        <div className="bv-types">
          ${Object.values(TYPES).map(
            (t) => html`
              <button key=${t.key} type="button" className="bv-type" data-tip=${t.key} onClick=${() => onPick(t.key)}>
                <span className="bv-type__idx">${t.idx}</span>
                <span className="bv-type__name">${t.label}</span>
                <span className="bv-type__desc">${t.desc}</span>
                <span className="bv-type__link">Seç →</span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  function Field({ f, value, error, showError, onChange, onBlur }) {
    const errId = `${f.id}-err`;

    if (f.type === "checkbox") {
      return html`
        <div className=${"bv-field" + (showError && error ? " has-err" : "")}>
          <label className="bv-check">
            <input
              type="checkbox"
              name=${f.id}
              checked=${!!value}
              onChange=${(e) => onChange(f.id, e.target.checked)}
              onBlur=${() => onBlur(f.id)}
              aria-describedby=${showError && error ? errId : undefined}
            />
            <span>${f.label}</span>
          </label>
          ${showError && error && html`<p className="bv-err" id=${errId} role="alert">${error}</p>`}
        </div>
      `;
    }

    let control;
    if (f.type === "select") {
      control = html`
        <select
          id=${f.id}
          name=${f.id}
          value=${value ?? ""}
          onChange=${(e) => onChange(f.id, e.target.value)}
          onBlur=${() => onBlur(f.id)}
        >
          <option value="" disabled>Seçin…</option>
          ${f.options.map((o) => html`<option key=${o} value=${o}>${o}</option>`)}
        </select>
      `;
    } else if (f.type === "textarea") {
      control = html`
        <textarea
          id=${f.id}
          name=${f.id}
          rows="5"
          maxLength=${f.maxLength}
          placeholder=${f.placeholder}
          value=${value ?? ""}
          onChange=${(e) => onChange(f.id, e.target.value)}
          onBlur=${() => onBlur(f.id)}
        ></textarea>
      `;
    } else {
      control = html`
        <input
          id=${f.id}
          name=${f.id}
          type=${f.type}
          placeholder=${f.placeholder}
          value=${value ?? ""}
          onChange=${(e) => onChange(f.id, e.target.value)}
          onBlur=${() => onBlur(f.id)}
        />
      `;
    }

    const len = (value ?? "").toString().length;
    return html`
      <div className=${"bv-field" + (showError && error ? " has-err" : "")}>
        <label htmlFor=${f.id}>${f.label}</label>
        ${control}
        ${(f.hint || f.counter) &&
        html`
          <p className="bv-hint">
            <span>${f.hint || ""}</span>
            ${f.counter && html`<span>${len}/${f.maxLength}</span>`}
          </p>
        `}
        ${showError && error && html`<p className="bv-err" id=${errId} role="alert">${error}</p>`}
      </div>
    `;
  }

  function App() {
    const params = new URLSearchParams(window.location.search);
    const urlTip = params.get("tip");
    const initialTip = TYPES[urlTip] ? urlTip : null;

    const [tip, setTip] = useState(initialTip);
    const [step, setStep] = useState(initialTip ? 2 : 1);
    const [values, setValues] = useState({});
    const [touched, setTouched] = useState({});
    const [tried, setTried] = useState(false);
    const [consent, setConsent] = useState(false);
    const [consentErr, setConsentErr] = useState(false);

    const fields = tip ? [...COMMON_FIELDS, ...TYPE_FIELDS[tip]] : [];
    const errors = Object.fromEntries(fields.map((f) => [f.id, validateField(f, values[f.id])]));
    const formValid = fields.every((f) => !errors[f.id]);

    const setValue = (id, v) => setValues((s) => ({ ...s, [id]: v }));
    const markTouched = (id) => setTouched((s) => ({ ...s, [id]: true }));

    const pickType = (key) => {
      setTip(key);
      setStep(2);
      setTried(false);
      setTouched({});
    };

    const goSummary = () => {
      setTried(true);
      if (formValid) {
        setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    const mailtoHref = () => {
      const t = TYPES[tip];
      const subject = `TEDxGültepe 2026 — ${t.label} Başvurusu — ${(values.adSoyad || "").trim()}`;
      const lines = [`Başvuru türü: ${t.label}`, ""];
      fields.forEach((f) => {
        let v = values[f.id];
        if (f.type === "checkbox") v = v ? "Evet" : "Hayır";
        lines.push(`${f.label}: ${(v ?? "—") || "—"}`);
      });
      return `mailto:${t.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    };

    const submit = (e) => {
      if (!consent) {
        e.preventDefault();
        setConsentErr(true);
        return;
      }
      // mailto bağlantısı e-posta uygulamasını açar; biz başarı ekranına geçeriz
      setStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const reset = () => {
      setTip(null);
      setStep(1);
      setValues({});
      setTouched({});
      setTried(false);
      setConsent(false);
      setConsentErr(false);
      window.history.replaceState(null, "", "basvuru.html");
    };

    if (step === 1) {
      return html`
        <${React.Fragment}>
          <${Steps} step=${1} />
          <${TypePicker} onPick=${pickType} />
        <//>
      `;
    }

    const t = TYPES[tip];

    if (step === 2) {
      return html`
        <${React.Fragment}>
          <${Steps} step=${2} />
          <div className="bv-panel" key="step2">
            <div className="bv-panel__head">
              <h1 className="bv-title">${t.label} <em>başvurusu</em></h1>
              <button type="button" className="bv-switch" onClick=${() => setStep(1)}>← Türü değiştir</button>
            </div>
            <form
              className="bv-form"
              noValidate
              onSubmit=${(e) => {
                e.preventDefault();
                goSummary();
              }}
            >
              ${fields.map(
                (f) => html`
                  <${Field}
                    key=${f.id}
                    f=${f}
                    value=${values[f.id]}
                    error=${errors[f.id]}
                    showError=${tried || touched[f.id]}
                    onChange=${setValue}
                    onBlur=${markTouched}
                  />
                `
              )}
              ${tried && !formValid &&
              html`<p className="bv-form-err" role="alert">Devam etmeden önce işaretli alanları düzeltin.</p>`}
              <div className="bv-actions">
                <button type="submit" className="btn btn--red"><span className="btn__label">Devam →</span></button>
              </div>
            </form>
          </div>
        <//>
      `;
    }

    if (step === 3) {
      return html`
        <${React.Fragment}>
          <${Steps} step=${3} />
          <div className="bv-panel" key="step3">
            <h1 className="bv-title">Son bir <em>bakış.</em></h1>
            <p className="bv-sub">Bilgilerini kontrol et — "Başvuruyu Gönder" e-posta uygulamanı hazır bir taslakla açar.</p>

            <ul className="bv-summary">
              <li><b>Başvuru türü</b><span>${t.label}</span></li>
              ${fields.map((f) => {
                let v = values[f.id];
                if (f.type === "checkbox") v = v ? "Evet" : "Hayır";
                return html`<li key=${f.id}><b>${f.label}</b><span>${(v ?? "—") || "—"}</span></li>`;
              })}
            </ul>

            <div className=${"bv-field bv-consent" + (consentErr && !consent ? " has-err" : "")}>
              <label className="bv-check">
                <input
                  type="checkbox"
                  checked=${consent}
                  onChange=${(e) => {
                    setConsent(e.target.checked);
                    if (e.target.checked) setConsentErr(false);
                  }}
                />
                <span>Başvuru bilgilerimin TEDxGültepe organizasyon ekibiyle paylaşılmasını kabul ediyorum.</span>
              </label>
              ${consentErr && !consent &&
              html`<p className="bv-err" role="alert">Göndermek için onay kutusunu işaretleyin.</p>`}
            </div>

            <div className="bv-actions">
              <button type="button" className="btn btn--ghost" onClick=${() => setStep(2)}>
                <span className="btn__label">← Düzenle</span>
              </button>
              <a className="btn btn--red" data-submit href=${mailtoHref()} onClick=${submit}>
                <span className="btn__label">Başvuruyu Gönder</span>
              </a>
            </div>
          </div>
        <//>
      `;
    }

    return html`
      <div className="bv-panel bv-success" key="step4">
        <span className="bv-success__x" aria-hidden="true">✕</span>
        <h1 className="bv-title">Başvurun <em>yola çıktı.</em></h1>
        <p className="bv-sub">
          E-posta uygulamanda hazır bir taslak açıldı — göndermeyi unutma.
          Açılmadıysa başvurunu doğrudan <a href=${"mailto:" + t.email}>${t.email}</a> adresine iletebilirsin.
        </p>
        <p className="bv-sub">Ekibimiz 5 iş günü içinde dönüş yapar. Eşikte görüşürüz.</p>
        <div className="bv-actions">
          <button type="button" className="btn btn--ghost" onClick=${reset}>
            <span className="btn__label">Yeni başvuru</span>
          </button>
          <a className="btn btn--red" href="index.html"><span className="btn__label">Ana sayfaya dön</span></a>
        </div>
      </div>
    `;
  }

  createRoot(document.getElementById("root")).render(html`<${App} />`);
})();
