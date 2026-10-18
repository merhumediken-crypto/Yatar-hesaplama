// Kompozisyon: sonucun geometrik resmi.
//
// Görsel dil Sophie Taeuber-Arp'ın (1889-1943) Somut Sanat kompozisyonlarından gelir:
// yatay bir şerit üzerinde daireler, yarım daireler ve dikdörtgenler; sınırlı, düz renk
// alanları; boşluğun da kompozisyona katıldığı sıkı bir ızgara. Burada her biçim bir
// veridir:
//   ● daire        kapalı cezaevi   (kırmızı)   genişlik ~ gün
//   ◗ yarım daire  açık cezaevi     (yeşil)
//   ■ dikdörtgen   denetimli serbestlik (mavi)
//   ▥ taralı alan  koşullu salıverilmeden ceza bitişine (özgür, denetim altında)
// Çıkış tarihi şeridi kesen tek dikey çizgidir; ucundaki hardal daire "eve dönüş"tür.
// Serbest küçük biçimler dosyanın tarihlerinden türeyen tohumla yerleşir: aynı dosya
// her zaman aynı resmi, farklı dosya farklı resmi verir.
//
// Renkler CSS sınıflarıyla verilir (popup.css → .kz-*), karanlık temaya kendiliğinden uyar.
// DOM bilmez; yalnız SVG metni üretir ve Node'da test edilir.

import { takvim as T } from '../cekirdek/index.js';

const W = 600;
const H = 224;
const SERIT_Y = 122;
const SERIT_H = 34;
const ALT = SERIT_Y + SERIT_H;
const EN_DAR = 10;

const sinirla = (x, a, b) => Math.max(a, Math.min(b, x));
const n = (x) => Math.round(x * 10) / 10;

// Küçük, belirlenimci sözde rastgele üreteç (mulberry32); tohum metinden.
function uretec(tohum) {
  let h = 2166136261;
  for (const c of String(tohum)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gün sayılarından şerit genişlikleri: sıfır olmayan her bölüm en az EN_DAR genişliktedir;
// eksik kalan pay en geniş bölümden alınır. Toplam her zaman W'dir.
export function seritGenislikleri(gunler) {
  const toplam = gunler.reduce((t, g) => t + Math.max(0, g), 0);
  if (!toplam) return gunler.map(() => 0);
  const w = gunler.map((g) => (g > 0 ? (g / toplam) * W : 0));
  let eksik = 0;
  w.forEach((x, i) => {
    if (x > 0 && x < EN_DAR) {
      eksik += EN_DAR - x;
      w[i] = EN_DAR;
    }
  });
  if (eksik) {
    const en = w.indexOf(Math.max(...w));
    w[en] -= eksik;
  }
  return w;
}

const kutu = (x, y, w, h) => ({ x, y, w, h });
const cakisir = (a, b, pay = 8) => a.x < b.x + b.w + pay && b.x < a.x + a.w + pay && a.y < b.y + b.h + pay && b.y < a.y + a.h + pay;

// o: ozet.js → sonucOzeti çıktısı (durum 'tamam'): kapali, acik, ds, tarihler, olaylar.
export function sonucKompozisyonu(o) {
  const t = o.tarihler || {};
  const kalan = t.ks && t.bitis && t.bitis > t.ks ? T.gunFarki(t.ks, t.bitis) : 0;
  const bolumler = [
    { tur: 'kapali', gun: o.kapali || 0 },
    { tur: 'acik', gun: o.acik || 0 },
    { tur: 'ds', gun: o.ds || 0 },
    { tur: 'kalan', gun: kalan },
  ];
  const genislik = seritGenislikleri(bolumler.map((b) => b.gun));
  let x = 0;
  for (const [i, b] of bolumler.entries()) {
    b.x = x;
    b.w = genislik[i];
    x += b.w;
  }
  const parca = [];
  const dolu = []; // yerleşen biçimlerin kutuları (serbest biçimler bunlara çarpmaz)

  // Şerit
  for (const b of bolumler) {
    if (!b.w) continue;
    parca.push(`<rect class="kz-${b.tur}" x="${n(b.x)}" y="${SERIT_Y}" width="${n(b.w)}" height="${SERIT_H}"/>`);
  }
  dolu.push(kutu(0, SERIT_Y, W, SERIT_H));

  // Kitap destekleri: girişte (sol) ve ceza bitişinde (sağ) mürekkep çubuk.
  const destek = (x) => {
    parca.push(`<rect class="kz-murekkep" x="${x}" y="${SERIT_Y - 22}" width="6" height="${SERIT_H + 22}"/>`);
    dolu.push(kutu(x, SERIT_Y - 22, 6, SERIT_H + 22));
  };
  destek(0);
  if (kalan || !t.ks) destek(W - 6);

  // Çıkış: şeridi kesen dikey çizgi ve hardal daire ("eve dönüş"); KS: aşağı inen ince
  // çizgi ve mavi yarım daire.
  const cikisX = sinirla(bolumler[0].w + bolumler[1].w, 12, W - 12);
  const ksX = o.ds && t.ks ? sinirla(bolumler[0].w + bolumler[1].w + bolumler[2].w, 12, W - 12) : null;

  // Ana biçimler: her evre genişliğiyle orantılı bir biçim taşır. Dar bölümün biçimi şeridin
  // altına asılır; art arda iki dar bölümde ikincisi üste çıkar (biçimler üst üste binmez).
  let oncekiAltta = false;
  for (const b of bolumler.slice(0, 3)) {
    if (!b.w) continue;
    let cx = b.x + b.w / 2;
    const dar = b.w < 48;
    const alta = dar && !oncekiAltta;
    oncekiAltta = alta;
    if (b.tur === 'kapali') {
      const d = dar ? sinirla(b.w * 1.4, 16, 40) : sinirla(b.w * 0.82, 24, 104);
      if (dar) cx = Math.max(cx, 6 + d / 2 + 6);
      const cy = alta ? ALT + 8 + d / 2 : SERIT_Y - 6 - d / 2;
      parca.push(`<circle class="kz-kapali" cx="${n(cx)}" cy="${n(cy)}" r="${n(d / 2)}"/>`);
      dolu.push(kutu(cx - d / 2, cy - d / 2, d, d));
    } else if (b.tur === 'acik') {
      const r = dar ? sinirla(b.w * 0.7, 10, 26) : sinirla(b.w * 0.42, 14, 86);
      if (dar) cx = sinirla(cx, 6 + r + 6, cikisX - r - 6);
      // Yarım daire: üstte kemer (düz kenarı şeritte), altta asılı çanak.
      const yol = alta ? `M${n(cx - r)} ${ALT}A${n(r)} ${n(r)} 0 0 0 ${n(cx + r)} ${ALT}Z` : `M${n(cx - r)} ${SERIT_Y}A${n(r)} ${n(r)} 0 0 1 ${n(cx + r)} ${SERIT_Y}Z`;
      parca.push(`<path class="kz-acik" d="${yol}"/>`);
      dolu.push(alta ? kutu(cx - r, ALT, 2 * r, r) : kutu(cx - r, SERIT_Y - r, 2 * r, r));
    } else {
      const s = dar ? sinirla(b.w * 1.2, 14, 34) : sinirla(b.w * 0.7, 20, 88);
      // Asılı kare KS çizgisinin soluna yaslanır (çıkış çizgisi şeridin altına inmez).
      if (dar) cx = Math.min(cx, (ksX ?? W) - s / 2 - 6);
      const y = alta ? ALT + 8 : SERIT_Y - s;
      parca.push(`<rect class="kz-ds" x="${n(cx - s / 2)}" y="${n(y)}" width="${n(s)}" height="${n(s)}"/>`);
      dolu.push(kutu(cx - s / 2, y, s, s));
    }
  }

  parca.push(`<line class="kz-cizgi" x1="${n(cikisX)}" y1="22" x2="${n(cikisX)}" y2="${ALT + 4}"/>`, `<circle class="kz-hardal" cx="${n(cikisX)}" cy="14" r="9"/>`);
  dolu.push(kutu(cikisX - 10, 4, 20, ALT));
  if (ksX !== null) {
    parca.push(`<line class="kz-ince" x1="${n(ksX)}" y1="${SERIT_Y}" x2="${n(ksX)}" y2="${H - 16}"/>`, `<path class="kz-ds" d="M${n(ksX - 9)} ${H - 16}A9 9 0 0 0 ${n(ksX + 9)} ${H - 16}Z"/>`);
    dolu.push(kutu(ksX - 10, SERIT_Y, 20, H - SERIT_Y));
  }

  // Serbest biçimler: tohum dosyanın tarihleri ve günleri; çakışmayan yere yerleşir.
  const rastgele = uretec(`${t.cikis}|${t.ks}|${o.kapali}|${o.acik}|${o.ds}`);
  // Süs biçimleri anlam taşıyan renkleri (kırmızı, yeşil, mavi) kullanmaz: hardal ve mürekkep.
  const serbest = [
    (x, y) => [`<rect class="kz-hardal" x="${x}" y="${y}" width="16" height="16"/>`, kutu(x, y, 16, 16)],
    (x, y) => [`<circle class="kz-halka" cx="${x + 10}" cy="${y + 10}" r="8"/>`, kutu(x, y, 20, 20)],
    (x, y) => [`<rect class="kz-murekkep" x="${x}" y="${y + 7}" width="44" height="5"/>`, kutu(x, y + 7, 44, 5)],
    (x, y) => [`<circle class="kz-hardal" cx="${x + 6}" cy="${y + 6}" r="6"/>`, kutu(x, y, 12, 12)],
  ];
  for (const ciz of serbest) {
    for (let deneme = 0; deneme < 40; deneme++) {
      const ux = Math.round(rastgele() * 22) * 25 + 8;
      const uy = Math.round(rastgele() * 3) * 22 + 8;
      const [svg, k] = ciz(ux, uy);
      if (k.x + k.w > W || dolu.some((d) => cakisir(d, k))) continue;
      parca.push(svg);
      dolu.push(k);
      break;
    }
  }

  const etiket = `Kompozisyon: ${o.kapali || 0} gün kapalı, ${o.acik || 0} gün açık, ${o.ds || 0} gün denetimli serbestlik${kalan ? `, koşullu salıverilmeden ceza bitişine ${kalan} gün` : ''}`;
  return `<svg class="kompozisyon" viewBox="0 0 ${W} ${H}" role="img" aria-label="${etiket}"><defs><pattern id="kz-tarama" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="kz-tarama-zemin" width="8" height="8"/><line class="kz-tarama" x1="0" y1="0" x2="0" y2="8"/></pattern></defs>${parca.join('')}</svg>`;
}

// Boş dosya ekranının resmi: aynı biçim dağarcığıyla durağan bir kompozisyon.
export function bosKompozisyon() {
  return `<svg class="kompozisyon bos" viewBox="0 0 600 300" role="img" aria-label="Kapalı, açık ve denetimli serbestlik evrelerini simgeleyen geometrik kompozisyon">
    <rect class="kz-murekkep" x="40" y="236" width="520" height="8"/>
    <circle class="kz-kapali" cx="150" cy="150" r="78"/>
    <path class="kz-acik" d="M262 236A92 92 0 0 1 446 236Z"/>
    <rect class="kz-ds" x="440" y="44" width="104" height="192"/>
    <rect class="kz-hardal" x="276" y="60" width="38" height="38"/>
    <circle class="kz-halka" cx="372" cy="78" r="17"/>
    <rect class="kz-murekkep" x="40" y="262" width="96" height="6"/>
    <line class="kz-cizgi" x1="236" y1="16" x2="236" y2="236"/>
    <circle class="kz-hardal" cx="236" cy="16" r="10"/>
    <rect class="kz-murekkep" x="510" y="262" width="16" height="16"/>
  </svg>`;
}

// Üç evrenin simgeleri (lejant ve süs): daire, yarım daire, kare.
export function fazSimgeleri() {
  return `<svg class="faz-simgeleri" viewBox="0 0 76 20" aria-hidden="true"><circle class="kz-kapali" cx="10" cy="10" r="9"/><path class="kz-acik" d="M27 19A11 11 0 0 1 49 19Z"/><rect class="kz-ds" x="57" y="1" width="18" height="18"/></svg>`;
}
