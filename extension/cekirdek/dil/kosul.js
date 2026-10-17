// infaz-kosul 1.0 yorumlayıcısı.
//
// Kural tabanındaki "kural_dili" sözleşmesinin uygulamasıdır:
//  - Güçlü Kleene üç değerli mantık: true / false / null (belirsiz).
//  - Alan yoksa veya null ise karşılaştırma null döner; false döndürmez.
//  - Tip uyuşmazlığı belirsizdir ve veri hatası olarak kaydedilir; "30" otomatik sayıya çevrilmez.
//  - İfadeler eval/Function ile çalıştırılmaz; yalnız tanımlı operatörler yorumlanır.
//
// Dış API:
//   degerlendir(ifade, baglam, secim)          → true | false | null
//   izliDegerlendir(ifade, baglam, secim)      → { deger, iz, belirsizAlanlar, veriHatalari }
//   ifadeyiDogrula(ifade, { alanlar, seciciler }) → hata listesi (boşsa geçerli)

const ISO_TARIH = /^(\d{4})-(\d{2})-(\d{2})$/;

export const KARSILASTIRMA = new Set(['eq', 'in', 'gte', 'gt', 'lte', 'lt', 'date_lte', 'date_gte', 'date_lt', 'date_gt']);
export const MANTIK = new Set(['and', 'or']);
export const IKILI_ALAN = new Set(['alan_esit', 'once_kesinlesme']);
export const OPERATORLER = new Set([...KARSILASTIRMA, ...MANTIK, 'not', ...IKILI_ALAN, 'secici']);

// ---------------------------------------------------------------------------
// Üç değerli mantık
// ---------------------------------------------------------------------------

export function ve(degerler) {
  let belirsiz = false;
  for (const d of degerler) {
    if (d === false) return false;
    if (d !== true) belirsiz = true;
  }
  return belirsiz ? null : true;
}

export function veya(degerler) {
  let belirsiz = false;
  for (const d of degerler) {
    if (d === true) return true;
    if (d !== false) belirsiz = true;
  }
  return belirsiz ? null : false;
}

export function degil(d) {
  return d === true ? false : d === false ? true : null;
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

export function gecerliIsoTarih(s) {
  if (typeof s !== 'string') return false;
  const m = ISO_TARIH.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// Noktalı alan yolu. "kisi.0_6_yas_grubunda_cocugu_var" gibi rakamla başlayan
// anahtarlar da düz anahtar olarak okunur.
export function alanOku(baglam, yol) {
  let o = baglam;
  for (const parca of yol.split('.')) {
    if (o === null || typeof o !== 'object' || !(parca in o)) return undefined;
    o = o[parca];
  }
  return o;
}

function tipi(v) {
  if (v === null || v === undefined) return 'yok';
  if (typeof v === 'number') return Number.isFinite(v) ? 'sayi' : 'gecersiz';
  if (typeof v === 'string') return 'metin';
  if (typeof v === 'boolean') return 'mantiksal';
  return 'gecersiz';
}

// ---------------------------------------------------------------------------
// Değerlendirme
// ---------------------------------------------------------------------------

class Degerlendirici {
  constructor(baglam, { seciciler = new Map(), iz = false } = {}) {
    this.baglam = baglam;
    this.seciciler = seciciler instanceof Map ? seciciler : new Map(Object.entries(seciciler));
    this.izTut = iz;
    this.veriHatalari = [];
    this.seciciYigini = [];
  }

  hata(ifade, mesaj) {
    this.veriHatalari.push({ alan: ifade.alan || ifade.sol || null, op: ifade.op, mesaj });
  }

  dugum(ifade, deger, ek = {}) {
    return this.izTut ? { op: ifade.op, deger, ...ek } : { deger };
  }

  calistir(ifade) {
    if (!ifade || typeof ifade !== 'object') throw new Error('Geçersiz ifade: ' + JSON.stringify(ifade));
    const { op } = ifade;
    if (op === 'and' || op === 'or') {
      const alt = ifade.kosullar.map((k) => this.calistir(k));
      const deger = op === 'and' ? ve(alt.map((a) => a.deger)) : veya(alt.map((a) => a.deger));
      return this.dugum(ifade, deger, { alt });
    }
    if (op === 'not') {
      const alt = this.calistir(ifade.kosul);
      return this.dugum(ifade, degil(alt.deger), { alt: [alt] });
    }
    if (op === 'secici') {
      const s = this.seciciler.get(ifade.secici_id);
      if (!s) throw new Error('Tanımsız seçici: ' + ifade.secici_id);
      if (this.seciciYigini.includes(ifade.secici_id)) throw new Error('Döngüsel seçici: ' + ifade.secici_id);
      this.seciciYigini.push(ifade.secici_id);
      const alt = this.calistir(s.kosul);
      this.seciciYigini.pop();
      return this.dugum(ifade, alt.deger, { secici_id: ifade.secici_id, ad: s.ad, alt: [alt] });
    }
    if (op === 'alan_esit' || op === 'once_kesinlesme') return this.ikili(ifade);
    if (KARSILASTIRMA.has(op)) return this.karsilastir(ifade);
    throw new Error('Tanımsız operatör: ' + op);
  }

  ikili(ifade) {
    const sol = alanOku(this.baglam, ifade.sol);
    const sag = alanOku(this.baglam, ifade.sag);
    const ek = { sol: ifade.sol, sag: ifade.sag, solDeger: sol ?? null, sagDeger: sag ?? null };
    if (sol == null || sag == null) return this.dugum(ifade, null, { ...ek, eksik: [sol == null && ifade.sol, sag == null && ifade.sag].filter(Boolean) });
    if (ifade.op === 'alan_esit') {
      if (tipi(sol) !== tipi(sag)) {
        this.hata(ifade, 'Tip uyuşmazlığı');
        return this.dugum(ifade, null, ek);
      }
      return this.dugum(ifade, sol === sag, ek);
    }
    // once_kesinlesme: önceki kesinleşme yeni suçtan önce olmalı; aynı gün sıra belirsiz.
    if (!gecerliIsoTarih(sol) || !gecerliIsoTarih(sag)) {
      this.hata(ifade, 'Geçersiz tarih');
      return this.dugum(ifade, null, ek);
    }
    const deger = sol < sag ? true : sol > sag ? false : null;
    return this.dugum(ifade, deger, { ...ek, ayniGun: sol === sag });
  }

  karsilastir(ifade) {
    const { op, alan, deger: beklenen } = ifade;
    const gercek = alanOku(this.baglam, alan);
    const ek = { alan, beklenen, gercek: gercek === undefined ? null : gercek };
    if (gercek === null || gercek === undefined) return this.dugum(ifade, null, { ...ek, eksik: [alan] });

    if (op === 'eq') {
      if (tipi(gercek) !== tipi(beklenen)) {
        this.hata(ifade, `Tip uyuşmazlığı (${tipi(gercek)} ≠ ${tipi(beklenen)})`);
        return this.dugum(ifade, null, ek);
      }
      return this.dugum(ifade, gercek === beklenen, ek);
    }
    if (op === 'in') {
      if (!Array.isArray(beklenen)) throw new Error(`"in" için liste gerekir (${alan})`);
      if (beklenen.length && !beklenen.some((b) => tipi(b) === tipi(gercek))) {
        this.hata(ifade, 'Tip uyuşmazlığı');
        return this.dugum(ifade, null, ek);
      }
      return this.dugum(ifade, beklenen.includes(gercek), ek);
    }
    if (op.startsWith('date_')) {
      if (!gecerliIsoTarih(gercek) || !gecerliIsoTarih(beklenen)) {
        this.hata(ifade, 'Geçersiz tarih');
        return this.dugum(ifade, null, ek);
      }
      const c = gercek < beklenen ? -1 : gercek > beklenen ? 1 : 0;
      const sonuc = { date_lt: c < 0, date_lte: c <= 0, date_gt: c > 0, date_gte: c >= 0 }[op];
      return this.dugum(ifade, sonuc, ek);
    }
    // Sayısal karşılaştırmalar
    if (tipi(gercek) !== 'sayi' || tipi(beklenen) !== 'sayi') {
      this.hata(ifade, 'Sayısal karşılaştırmada tip uyuşmazlığı');
      return this.dugum(ifade, null, ek);
    }
    const sonuc = { gte: gercek >= beklenen, gt: gercek > beklenen, lte: gercek <= beklenen, lt: gercek < beklenen }[op];
    return this.dugum(ifade, sonuc, ek);
  }
}

export function degerlendir(ifade, baglam, secim = {}) {
  return new Degerlendirici(baglam, secim).calistir(ifade).deger;
}

// Sonucu belirsiz kılan alanlar: yalnız sonucu gerçekten etkileyen dallardan toplanır.
// (or içinde true bir dal varsa diğer dallardaki eksik alanlar sonucu etkilemez.)
function belirsizAlanlariTopla(dugum, kume) {
  if (dugum.deger !== null) return;
  if (dugum.eksik) dugum.eksik.forEach((a) => kume.add(a));
  if (dugum.alt) for (const a of dugum.alt) belirsizAlanlariTopla(a, kume);
}

export function izliDegerlendir(ifade, baglam, secim = {}) {
  const d = new Degerlendirici(baglam, { ...secim, iz: true });
  const iz = d.calistir(ifade);
  const kume = new Set();
  belirsizAlanlariTopla(iz, kume);
  return { deger: iz.deger, iz, belirsizAlanlar: [...kume], veriHatalari: d.veriHatalari };
}

// ---------------------------------------------------------------------------
// Yapısal ve anlamsal doğrulama (veri derleme ve testlerde kullanılır)
// ---------------------------------------------------------------------------

export function ifadeyiDogrula(ifade, { alanlar = null, seciciler = null } = {}, yol = '$') {
  const hatalar = [];
  const h = (m) => hatalar.push(`${yol}: ${m}`);
  if (!ifade || typeof ifade !== 'object' || Array.isArray(ifade)) {
    h('ifade nesne olmalı');
    return hatalar;
  }
  const { op } = ifade;
  const anahtarlar = Object.keys(ifade);
  const izinli = (liste) => {
    const fazla = anahtarlar.filter((a) => !liste.includes(a));
    if (fazla.length) h(`beklenmeyen alan(lar): ${fazla.join(', ')}`);
  };
  if (!OPERATORLER.has(op)) {
    h(`tanımsız operatör "${op}"`);
    return hatalar;
  }
  if (MANTIK.has(op)) {
    izinli(['op', 'kosullar']);
    if (!Array.isArray(ifade.kosullar) || !ifade.kosullar.length) h('kosullar boş olmayan liste olmalı');
    else ifade.kosullar.forEach((k, i) => hatalar.push(...ifadeyiDogrula(k, { alanlar, seciciler }, `${yol}.kosullar[${i}]`)));
  } else if (op === 'not') {
    izinli(['op', 'kosul']);
    hatalar.push(...ifadeyiDogrula(ifade.kosul, { alanlar, seciciler }, `${yol}.kosul`));
  } else if (op === 'secici') {
    izinli(['op', 'secici_id']);
    if (!/^SC[0-9]{2}$/.test(ifade.secici_id || '')) h('secici_id biçimi SC00 olmalı');
    else if (seciciler && !seciciler.has(ifade.secici_id)) h(`tanımsız seçici ${ifade.secici_id}`);
  } else if (IKILI_ALAN.has(op)) {
    izinli(['op', 'sol', 'sag']);
    for (const a of ['sol', 'sag']) {
      if (typeof ifade[a] !== 'string' || !ifade[a]) h(`${a} alan yolu olmalı`);
      else if (alanlar && !alanlar.has(ifade[a])) h(`sözlükte olmayan alan ${ifade[a]}`);
    }
  } else {
    izinli(['op', 'alan', 'deger']);
    if (typeof ifade.alan !== 'string' || !ifade.alan) h('alan yolu olmalı');
    else if (alanlar && !alanlar.has(ifade.alan)) h(`sözlükte olmayan alan ${ifade.alan}`);
    if (!('deger' in ifade)) h('deger eksik');
    if (op === 'in' && !Array.isArray(ifade.deger)) h('"in" değeri liste olmalı');
    if (op.startsWith('date_') && !gecerliIsoTarih(ifade.deger)) h('tarih değeri YYYY-AA-GG olmalı');
    if (['gte', 'gt', 'lte', 'lt'].includes(op) && typeof ifade.deger !== 'number') h('sayısal değer gerekir');
  }
  return hatalar;
}

// İfadede geçen bütün alan yolları (seçicilerin içine girmeden).
export function ifadeAlanlari(ifade, kume = new Set()) {
  if (!ifade || typeof ifade !== 'object') return kume;
  if (ifade.alan) kume.add(ifade.alan);
  if (ifade.sol) kume.add(ifade.sol);
  if (ifade.sag) kume.add(ifade.sag);
  if (ifade.kosul) ifadeAlanlari(ifade.kosul, kume);
  if (ifade.kosullar) ifade.kosullar.forEach((k) => ifadeAlanlari(k, kume));
  return kume;
}
