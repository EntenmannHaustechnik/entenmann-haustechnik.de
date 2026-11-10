/* Entenmann Haustechnik — main.js (Fassung 3 „Der Wärmekreis“, 18.10.2026)
   Grundsatz: ohne JS ist alles lesbar; hier kommt nur Bewegung dazu.
   Eine Leitung läuft die Seite entlang, die Wärme reist mit dem Leser, jede Station rastet ein. */
(function () {
  'use strict';
  document.documentElement.classList.remove('ohne-js');
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const istMobil = () => innerWidth < 861;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SKALA_START = 52, SKALA_ENDE = 308;
  const zeigerWinkel = (p) => 90 + SKALA_START + (SKALA_ENDE - SKALA_START) * p;
  const beob = (el, cb, schwelle = 0.35) => new IntersectionObserver(es => es.forEach(x => cb(x.isIntersecting, x)), { threshold: schwelle }).observe(el);

  /* ---------- Intro: nur einmal je Sitzung, der Kreis öffnet die Seite ---------- */
  const intro = document.querySelector('.intro');
  let introZeit = 0;
  try {
    if (intro && !reduziert && !istMobil() && !sessionStorage.getItem('intro')) {
      intro.classList.add('zu'); sessionStorage.setItem('intro', '1'); introZeit = 2000;
      intro.addEventListener('animationend', (e) => { if (e.animationName === 'i-weg') intro.remove(); });
    } else { document.documentElement.classList.add('ohne-intro'); if (intro) intro.remove(); }
  } catch { document.documentElement.classList.add('ohne-intro'); if (intro) intro.remove(); }

  const heroEl = document.querySelector('.hero');
  if (heroEl) setTimeout(() => heroEl.classList.add('fertig'), introZeit + 2600);

  /* ---------- Kopf ---------- */
  const kopf = document.getElementById('kopf'), nav = document.getElementById('nav'), burger = document.getElementById('burger');
  const leistungenKnopf = document.querySelector('.nav-leistungen'), hatMenu = document.querySelector('.hat-menu');
  const kopfStand = () => kopf.classList.toggle('fest', scrollY > 40);
  addEventListener('scroll', kopfStand, { passive: true }); kopfStand();
  if (burger) burger.addEventListener('click', () => {
    const offen = nav.classList.toggle('offen');
    burger.setAttribute('aria-expanded', String(offen));
    burger.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen');
    document.body.style.overflow = offen ? 'hidden' : '';
    if (offen) kopf.classList.add('fest');
  });
  if (leistungenKnopf) {
    leistungenKnopf.addEventListener('click', (e) => {
      e.preventDefault();
      const offen = hatMenu.classList.toggle('offen');
      leistungenKnopf.setAttribute('aria-expanded', String(offen));
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.hat-menu')) { hatMenu.classList.remove('offen'); leistungenKnopf.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hatMenu.classList.remove('offen'); leistungenKnopf.setAttribute('aria-expanded', 'false'); } });
  }
  document.querySelectorAll('[data-leistungen]').forEach(a => { if (document.body.dataset.seite !== 'index') a.href = './#leistungen'; });

  /* ---------- Videos: Hero und Statement, erst nach dem Laden ---------- */
  document.querySelectorAll('video[data-slot]').forEach(v => {
    if (reduziert || (istMobil() && v.classList.contains('hero-video'))) return;
    const slot = v.dataset.slot;
    const datei = `assets/video/${slot}${istMobil() ? '-m' : ''}.mp4`;
    v.addEventListener('playing', () => v.classList.add('laeuft'), { once: true });
    const start = () => { v.src = datei; v.load(); v.play().catch(() => {}); };
    const spaeter = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 1200));
    if (v.classList.contains('hero-video')) { if (document.readyState === 'complete') spaeter(); else addEventListener('load', spaeter, { once: true }); }
    else beob(v, (an) => { if (an && !v.src) start(); else if (!an && v.src) v.pause(); else if (an && v.src) v.play().catch(() => {}); }, 0.1);
  });

  /* ---------- Wörter aufteilen (nur Textknoten, &nbsp; bleibt) ---------- */
  function worteTeilen(knoten, cls, innen) {
    const worte = [];
    const lauf = (n) => {
      [...n.childNodes].forEach(k => {
        if (k.nodeType === 3) {
          const teile = k.textContent.split(/([ \t\n]+)/);
          const frag = document.createDocumentFragment();
          teile.forEach(t => {
            if (!t) return;
            if (/^[ \t\n]+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span'); s.className = cls; s.style.setProperty('--i', worte.length);
            if (innen) { const i = document.createElement('span'); i.textContent = t; s.appendChild(i); } else s.textContent = t;
            frag.appendChild(s); worte.push(s);
          });
          k.replaceWith(frag);
        } else if (k.nodeType === 1 && !k.classList.contains('h1-ort')) lauf(k);
      });
    };
    lauf(knoten);
    return worte;
  }
  document.querySelectorAll('.hero h1').forEach(h => worteTeilen(h, 'w', true));
  const fuellTexte = [...document.querySelectorAll('[data-fuell]')].map(el => ({ el, worte: worteTeilen(el, 'w') }));
  function fuellen() {
    const h = innerHeight;
    fuellTexte.forEach(({ el, worte }) => {
      const r = el.getBoundingClientRect();
      const p = clamp((h * 0.78 - r.top) / (h * 0.46), 0, 1);
      worte.forEach((w, i) => w.classList.toggle('an', (i + 1) / worte.length <= p + 0.02));
    });
  }

  /* ---------- Auslegen: zu knapp → zu groß → passt (Hero + „Erst gerechnet“) ---------- */
  // Logo-Anzeige (10.11.2026): Halbmond füllt sich (--ziel), der Entenschnabel ist der Zeiger: zu knapp → zu groß → passt
  const zustand = (dial, z) => { dial.classList.remove('zu', 'gross', 'passt'); if (z) dial.classList.add(z); };
  function auslegen(dial, start, nachPasst) {
    const wert = dial.querySelector('.a-wert'), t = [];
    const zeige = (txt) => { wert.textContent = txt; wert.classList.remove('neu'); void wert.offsetWidth; wert.classList.add('neu'); };
    const schritt = (ms, fn) => t.push(setTimeout(fn, start + ms));
    if (reduziert) { schritt(0, () => { dial.style.setProperty('--ziel', '1'); dial.classList.add('an'); zustand(dial, 'passt'); wert.textContent = 'passt'; if (nachPasst) nachPasst(); }); return t; }
    schritt(0, () => { dial.style.setProperty('--ziel', '.55'); dial.classList.add('an'); zustand(dial, 'zu'); zeige('zu knapp'); });
    schritt(1050, () => { dial.style.setProperty('--ziel', '1'); zustand(dial, 'gross'); zeige('zu groß'); });
    schritt(2150, () => { zustand(dial, 'passt'); zeige('passt'); if (nachPasst) nachPasst(); });
    return t;
  }

  /* ---------- Anzeigen: Halbmond füllt sich, Schnabel rastet ein ---------- */
  document.querySelectorAll('.anzeige[data-ziel]').forEach(a => {
    a.style.setProperty('--ziel', a.dataset.ziel);
    if (a.closest('.hero-marke')) { auslegen(a, introZeit ? introZeit + 700 : 900); return; }
    if (a.closest('[data-rechnen]') || a.closest('.kurzcheck')) return;
    beob(a, (an) => a.classList.toggle('an', an));
  });

  /* ---------- Der Wärmeweg: klebende Bühne, Stationen ziehen durch die Wärme ---------- */
  const weg = document.querySelector('.weg');
  let wegLauf = null;
  if (weg) {
    const bahn = weg.querySelector('.weg-bahn'), strecke = weg.querySelector('.weg-strecke');
    const stationen = [...weg.querySelectorAll('.station-weg')], zaehler = weg.querySelector('.weg-zaehler b');
    const seg0 = 1;
    const punkte = [...weg.querySelectorAll('.weg-punkte i')], rohr = weg.querySelector('.weg-rohr i'), funke = weg.querySelector('.weg-funke');
    let aktiv = -1;
    const setze = (k) => { if (k === aktiv) return; aktiv = k; stationen.forEach((s, i) => s.classList.toggle('an', i === k)); punkte.forEach((p, i) => p.classList.toggle('an', i <= k)); if (zaehler) zaehler.textContent = '0' + (k + 1); };
    wegLauf = () => {
      if (istMobil()) { stationen.forEach(s => s.classList.add('an')); return; }
      const mitte = innerWidth / 2;
      const r = bahn.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
      const weite = stationen[stationen.length - 1].offsetLeft - stationen[0].offsetLeft;
      const n = stationen.length, seg = 1 / (n - 1);
      // gleichmäßig mit dem Scrollen, kein Halten (Noah, 18.10.: „das stockt irgendwie“)
      const q = p;
      if (rohr) rohr.style.width = (q * 100).toFixed(1) + '%';
      if (funke) funke.style.left = `calc(var(--rand) + ${(q * 100).toFixed(1)}% - ${(q * 2 * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rand')) || 0).toFixed(0)}px)`;
      setze(Math.round(q * (n - 1)));
    };
  }

  /* ---------- Erst gerechnet: das Haus läuft einmal durch, sobald es im Bild ist ---------- */
  const rechnen = document.querySelector('[data-rechnen]');
  if (rechnen) {
    const szene = rechnen.querySelector('.re-szene'), dial = rechnen.querySelector('.anzeige'), wert = dial.querySelector('.a-wert');
    const proto = [...rechnen.querySelectorAll('.protokoll li')];
    let timer = [];
    const spiele = () => {
      timer.forEach(clearTimeout); timer = [];
      szene.classList.add('an'); dial.classList.remove('an', 'zu', 'gross', 'passt'); wert.textContent = '';
      timer.push(setTimeout(() => proto[0].classList.add('an'), 500));
      timer.push(...auslegen(dial, 900, () => {
        proto[1].classList.add('an');
        timer.push(setTimeout(() => { szene.classList.add('warm'); proto[2].classList.add('an'); }, 700));
      }));
    };
    beob(rechnen, (an) => {
      if (an) spiele();
      else { timer.forEach(clearTimeout); szene.classList.remove('an', 'warm'); proto.forEach(l => l.classList.remove('an')); dial.classList.remove('an', 'zu', 'gross', 'passt'); wert.textContent = ''; }
    }, 0.45);
  }

  /* ---------- Kennzahlen zählen hoch ---------- */
  document.querySelectorAll('.zahl').forEach(z => {
    const b = z.querySelector('b'), bis = parseFloat(z.dataset.bis), von = parseFloat(z.dataset.von || 0), fmt = z.dataset.fmt || '';
    const schreibe = (v) => { b.innerHTML = (fmt === 'l' ? Math.round(v).toLocaleString('de-DE') + '<em>l</em>' : fmt === 'uhr' ? '8–' + Math.round(v) + '<em>Uhr</em>' : Math.round(v)) ; };
    if (isNaN(bis)) { beob(z, (an) => z.classList.toggle('an', an)); return; }
    let raf = 0;
    beob(z, (an) => {
      z.classList.toggle('an', an); cancelAnimationFrame(raf);
      if (!an) { schreibe(von); return; }
      const t0 = performance.now(), dauer = 1400;
      const tick = (t) => { const p = clamp((t - t0) / dauer, 0, 1), e = 1 - Math.pow(1 - p, 3); schreibe(von + (bis - von) * e); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, 0.5);
  });

  /* ---------- Zeitstrahl, Pegel, Wortfeld, Uhr ---------- */
  function reihe(selektor, kinder, schwelle = 0.78) {
    const wurzel = document.querySelector(selektor);
    if (!wurzel) return null;
    const items = [...wurzel.querySelectorAll(kinder)];
    return () => {
      const h = innerHeight, r = wurzel.getBoundingClientRect();
      const p = clamp((h * schwelle - r.top) / Math.max(1, Math.min(r.height, h * 0.6)), 0, 1);
      wurzel.style.setProperty('--p', p.toFixed(3));
      items.forEach((it, i) => it.classList.toggle('an', (i + 0.5) / items.length <= p + 0.02));
    };
  }
  const zeitstrahl = reihe('[data-zeit]', 'li'), pegel = reihe('[data-pegel]', '.pegel-schritte li', 0.82);
  const ortsfeld = document.querySelector('.ortsfeld');
  if (ortsfeld) beob(ortsfeld, (an) => ortsfeld.classList.toggle('an', an), 0.4);
  document.querySelectorAll('.n-uhr').forEach(u => beob(u, (an) => u.classList.toggle('an', an), 0.4));

  /* ---------- Einsatzgebiet ---------- */
  const gebiet = document.querySelector('.gebiet');
  if (gebiet) {
    beob(gebiet, (an) => gebiet.classList.toggle('an', an), 0.25);
    const lesungOrt = gebiet.querySelector('.gb-ort'), lesungKm = gebiet.querySelector('.gb-km');
    const orte = [...gebiet.querySelectorAll('.ort')];
    let eigen = false, i = 0;
    const zeige = (o) => {
      orte.forEach(x => x.classList.toggle('an', x === o));
      if (lesungOrt) { lesungOrt.textContent = o.dataset.name; lesungKm.textContent = o.classList.contains('sitz') ? 'unser Sitz' : `rund ${o.dataset.km} km von Weilheim`; }
    };
    orte.forEach(o => { o.addEventListener('mouseenter', () => { eigen = true; zeige(o); }); o.addEventListener('click', () => { eigen = true; zeige(o); }); });
    gebiet.addEventListener('mouseleave', () => { eigen = false; });
    setInterval(() => { if (!eigen && gebiet.classList.contains('an') && !document.hidden) { i = (i + 1) % orte.length; zeige(orte[i]); } }, 3200);
  }

  /* ---------- Erscheinen ---------- */
  const rvZiele = '.kachel,.karte,.stelle,.eb-bild,.g-bild,.duo-bild,.duo-text,.faq-item,.s-kopf,.gs-bild,.gs-text,.info-karte,.formular,.n-text,.n-uhr,.ab-text,.ab-anzeige,.li-text,.fi-text,.fi-form,.gb-text,.gb-karte,.re-text,.re-szene,.bt-bild,.bt-text,.zahl,.faq-kopf,.g-kopf';
  const rv = [...document.querySelectorAll(rvZiele)];
  rv.forEach((el, i) => { el.classList.add('rv'); const el2 = el.parentElement; const idx = [...el2.children].indexOf(el); el.style.setProperty('--d', Math.min(idx, 6)); });
  const rvBeob = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('an'); rvBeob.unobserve(x.target); } }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  rv.forEach(el => rvBeob.observe(el));

  /* ---------- Die Leitung: die Wärme reist mit dem Leser, jede Sektion leuchtet auf ---------- */
  const leitung = document.querySelector('.leitung'), funkeL = document.querySelector('.leitung-funke');
  let knoten = [], leitungLauf = null;
  if (leitung && !istMobil()) {
    const sektionen = [...document.querySelectorAll('main > section, body > section')].filter(s => !s.classList.contains('hero'));
    knoten = sektionen.map(s => { const k = document.createElement('i'); k.className = 'l-knoten'; leitung.appendChild(k); return { s, k }; });
    const fuell = document.createElement('i'); fuell.className = 'l-fuell'; leitung.appendChild(fuell);
    const marke = document.querySelector('.marke-fuss');
    const lege = () => {
      const top = leitung.getBoundingClientRect().top + scrollY;
      leitung.dataset.top = top;
      // Die Leitung endet am Logo im Fuß: dort schließt sich der Kreis
      if (marke) { const m = marke.getBoundingClientRect(); leitung.style.setProperty('--l', Math.max(0, m.top + scrollY + m.height / 2 - top - 14) + 'px'); }
      knoten.forEach(({ s, k }) => { const y = s.getBoundingClientRect().top + scrollY - top; k.style.top = Math.max(0, y) + 'px'; k.dataset.y = y; });
    };
    lege(); addEventListener('resize', lege); addEventListener('load', lege);
    leitungLauf = () => {
      const top = parseFloat(leitung.dataset.top), mitte = scrollY + innerHeight * 0.5;
      const fussEl = document.querySelector('.fuss');
      const unten = fussEl ? scrollY + innerHeight >= fussEl.getBoundingClientRect().bottom + scrollY - 4 : false;
      const h = unten ? leitung.offsetHeight : clamp(mitte - top, 0, leitung.offsetHeight);
      leitung.style.setProperty('--h', h.toFixed(0) + 'px');
      if (funkeL) funkeL.classList.toggle('an', mitte > top && mitte < top + leitung.offsetHeight - 60);
      leitung.classList.toggle('zu', h >= leitung.offsetHeight - 2);
      knoten.forEach(({ k }) => k.classList.toggle('an', parseFloat(k.dataset.y) <= h));
    };
  }

  /* ---------- Ein Takt für alles, was am Scroll hängt ---------- */
  let takt = false;
  const lauf = () => {
    takt = false;
    fuellen();
    if (wegLauf) wegLauf();
    if (zeitstrahl) zeitstrahl();
    if (pegel) pegel();
    if (leitungLauf) leitungLauf();
  };
  const plane = () => { if (!takt) { takt = true; requestAnimationFrame(lauf); } };
  addEventListener('scroll', plane, { passive: true }); addEventListener('resize', plane); lauf(); setTimeout(lauf, 300); addEventListener('load', lauf);

  /* ---------- Galerie: Filter + Lichtkasten ---------- */
  document.querySelectorAll('.g-filter').forEach(f => {
    const bilder = [...f.closest('.galerie').querySelectorAll('.g-bild')];
    f.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      f.querySelectorAll('.chip').forEach(c => c.classList.toggle('an', c === b));
      bilder.forEach(x => x.classList.toggle('weg', b.dataset.f !== 'alle' && x.dataset.leistung !== b.dataset.f));
    });
  });
  document.querySelectorAll('.g-link').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const fig = a.closest('figure');
    const lk = document.createElement('div');
    lk.className = 'lichtkasten'; lk.setAttribute('role', 'dialog'); lk.setAttribute('aria-label', 'Bild vergrößert');
    lk.innerHTML = `<button type="button" class="lk-zu" aria-label="Schließen">✕</button><img src="${a.href}" alt="${a.querySelector('img').alt}"><p class="lk-text">${fig.querySelector('figcaption b').textContent} · ${fig.querySelector('figcaption span').textContent}</p>`;
    const zu = () => { lk.remove(); document.removeEventListener('keydown', esc); };
    const esc = (ev) => { if (ev.key === 'Escape') zu(); };
    lk.addEventListener('click', ev => { if (ev.target === lk || ev.target.closest('.lk-zu')) zu(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(lk); lk.querySelector('.lk-zu').focus();
  }));

  /* ---------- Kurz-Check: drei Klicks, dann Kontakt (Antworten gehen mit dem Formular raus) ---------- */
  document.querySelectorAll('[data-kurzcheck]').forEach(form => {
    const box = form.closest('.kurzcheck'), dial = box.querySelector('.anzeige'), wert = dial.querySelector('.a-wert');
    const titel = box.querySelector('[data-kc-titel]'), text = box.querySelector('[data-kc-text]'), stoer = form.querySelector('[data-kc-stoerung]');
    const n = form.querySelectorAll('fieldset').length, bewertet = form.hasAttribute('data-bewertet');
    form.addEventListener('change', (e) => {
      if (e.target.type !== 'radio') return;
      const w = [...form.querySelectorAll('input[type=radio]:checked')];
      dial.style.setProperty('--ziel', (w.length / n).toFixed(2)); dial.classList.add('an');
      if (stoer) stoer.hidden = !w.some(x => x.value === 'Störung');
      if (w.length < n) { zustand(dial, null); wert.textContent = w.length + ' / ' + n; return; }
      form.classList.add('bereit');
      const s = w.reduce((a, x) => a + parseInt(x.dataset.p, 10), 0);
      if (!bewertet || s >= 5) { zustand(dial, 'passt'); wert.textContent = bewertet ? 'gut' : 'passt'; }
      else { zustand(dial, 'zu'); dial.style.setProperty('--ziel', s >= 3 ? '.75' : '.45'); wert.textContent = s >= 3 ? 'prüfen' : 'offen'; }
      if (!bewertet) { titel.textContent = 'Danke, das reicht für den Anfang.'; text.textContent = 'Jetzt noch Name und Nummer, dann melden wir uns mit einem Terminvorschlag.'; }
      else if (s >= 5) { titel.textContent = 'Gute Voraussetzungen.'; text.textContent = 'Dämmung, Heizflächen und Aufstellort sprechen für eine Wärmepumpe. Die Heizlast rechnen wir vor Ort nach.'; }
      else if (s >= 3) { titel.textContent = 'Möglich, mit Prüfung.'; text.textContent = 'Eine Wärmepumpe kann passen, eventuell mit größeren Heizkörpern oder als Hybrid. Das klärt die Berechnung.'; }
      else { titel.textContent = 'Erst rechnen, dann entscheiden.'; text.textContent = 'Oft ist dann eine Gas- oder Hybridlösung sinnvoller. Wir sagen Ihnen vor Ort ehrlich, was passt.'; }
      const erstes = form.querySelector('.kc-kontakt input[name=name]');
      if (erstes && !form.dataset.gesprungen) { form.dataset.gesprungen = '1'; erstes.focus({ preventScroll: true }); erstes.scrollIntoView({ behavior: reduziert ? 'auto' : 'smooth', block: 'center' }); }
    });
  });

  /* ---------- Formulare ---------- */
  const anlass = new URLSearchParams(location.search).get('anlass');
  const anlassFeld = document.querySelector('[data-anlass]');
  if (anlass && anlassFeld && [...anlassFeld.options].some(o => o.value === anlass)) anlassFeld.value = anlass;
  document.querySelectorAll('[data-stelle]').forEach(a => a.addEventListener('click', () => { const sel = document.querySelector('[data-stellen-wahl]'); if (sel) sel.value = a.dataset.stelle; }));
  document.querySelectorAll('[data-formular]').forEach(f => f.addEventListener('submit', async (e) => {
    const hinweis = f.querySelector('[data-f-hinweis]');
    const daten = new FormData(f);
    e.preventDefault();
    if (f.action.includes('FORMSPREE-ID')) {
      const zeilen = [...daten.entries()].filter(([k]) => k !== 'datenschutz').map(([k, v]) => `${k}: ${v}`).join('\n');
      location.href = `mailto:${f.dataset.mailto}?subject=${encodeURIComponent(f.dataset.betreff)}&body=${encodeURIComponent(zeilen)}`;
      hinweis.hidden = false; hinweis.textContent = 'Ihr E-Mail-Programm öffnet sich mit der Nachricht. Falls nicht: info@entenmann-haustechnik.de';
      return;
    }
    try {
      const r = await fetch(f.action, { method: 'POST', body: daten, headers: { Accept: 'application/json' } });
      hinweis.hidden = false;
      if (r.ok) { hinweis.textContent = 'Danke, Ihre Nachricht ist angekommen. Wir melden uns in der Regel am nächsten Werktag.'; f.reset(); }
      else throw new Error();
    } catch { hinweis.hidden = false; hinweis.textContent = 'Das hat nicht geklappt. Rufen Sie uns an: 0881 – 600 935 0'; }
  }));
})();
