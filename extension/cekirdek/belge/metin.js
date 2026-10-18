// Belge metni araçları: normalleştirme, Türkçe büyük harf eşlemesi, tarih ve ceza
// desenleri. UYAP çıktıları sekme, bölünmüş satır, "İ/I" ve "Hâ/Ha" farkları içerir;
// eşleştirme bu farklardan bağımsız bir "arama kopyası" üzerinde yapılır.
//
// Arama kopyası (ara) özgün metinle karakter karakter aynı uzunluktadır: Türkçe
// büyük harfe çevirme ve aksan kaldırma birebir eşlemedir. Böylece arama kopyasında
// bulunan bir aralık, özgün metinden aynen kesilip kaynak satırı olarak gösterilir.

import { gecerliTarih } from '../zaman/takvim.js';

const ASCII = { Ç: 'C', Ğ: 'G', İ: 'I', I: 'I', Ö: 'O', Ş: 'S', Ü: 'U', Â: 'A', Î: 'I', Û: 'U' };

// Özgün metni okunur biçime getirir (satırlar korunur).
export function normallestir(metin) {
  return String(metin ?? '')
    .replace(/﻿/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\t+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Arama kopyası: Türkçe büyük harf + aksansız (uzunluk korunur).
export function aramaKopyasi(metin) {
  let s = '';
  for (const ch of metin) {
    const u = ch.toLocaleUpperCase('tr');
    const tek = u.length === 1 ? u : ch;
    s += ASCII[tek] ?? tek;
  }
  return s;
}

// "DİYARBAKIR 12. ASLİYE CEZA" → "Diyarbakır 12. Asliye Ceza"
export function baslikHarfi(s) {
  return String(s)
    .toLocaleLowerCase('tr')
    .replace(/(^|[\s(/-])([a-zçğıöşüâîû])/g, (_, a, b) => a + b.toLocaleUpperCase('tr'))
    .replace(/\b(Ve|İle|Ile)\b/g, (m) => m.toLocaleLowerCase('tr'));
}

// 11 haneli sayı dizileri (TC kimlik no) kaynak metinden maskelenir.
export const maskele = (s) => String(s).replace(/\b\d{11}\b/g, '•••••••••••');

// ---------------------------------------------------------------------------
// Tarih
// ---------------------------------------------------------------------------

export const TARIH_DESENI = /(?<!\d)(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})(?!\d)/g;

export function tarihCoz(g, a, y) {
  const iso = `${y}-${String(a).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
  return gecerliTarih(iso) ? iso : null;
}

// Metindeki bütün geçerli tarihler (konumlarıyla).
export function tarihler(metin) {
  const sonuc = [];
  for (const m of metin.matchAll(TARIH_DESENI)) {
    const iso = tarihCoz(m[1], m[2], m[3]);
    if (iso) sonuc.push({ iso, bas: m.index, son: m.index + m[0].length });
  }
  return sonuc;
}

// ---------------------------------------------------------------------------
// Ceza miktarı: "4 YIL 8 AY 7 GÜN", "1 YIL 15 GÜN", "2 (İKİ) YIL 6 AY", "4 AY 15 GÜN"
// ---------------------------------------------------------------------------

const SAYI = String.raw`(\d{1,3})\s*(?:\([A-Z ]+\)\s*)?`;
export const CEZA_DESENI = new RegExp(String.raw`(?<![\d/])(?:${SAYI}YIL)?\s*(?:${SAYI}AY)?\s*(?:${SAYI}GUN)?`, 'g');

// Arama kopyasında (büyük, aksansız) ceza miktarlarını bulur.
export function cezalar(ara) {
  const sonuc = [];
  for (const m of ara.matchAll(CEZA_DESENI)) {
    if (!m[0].trim() || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) continue;
    // "5 YILLIK", "8 AYLIK" gibi kelime parçaları ceza miktarı değildir.
    if (/[A-Z]/.test(ara.charAt(m.index + m[0].trimEnd().length))) continue;
    const ceza = { yil: Number(m[1] || 0), ay: Number(m[2] || 0), gun: Number(m[3] || 0) };
    if (!(ceza.yil || ceza.ay || ceza.gun)) continue;
    const bas = m.index + (m[0].length - m[0].trimStart().length);
    sonuc.push({ ceza, bas, son: m.index + m[0].trimEnd().length });
  }
  return sonuc;
}

export const cezaMetniKisa = (c) => [c.yil && `${c.yil} yıl`, c.ay && `${c.ay} ay`, c.gun && `${c.gun} gün`].filter(Boolean).join(' ') || '0 gün';

// ---------------------------------------------------------------------------
// Satır ve aralık yardımcıları
// ---------------------------------------------------------------------------

// Konumu içeren satır (kaynak olarak gösterilir, TC no maskeli).
export function satiri(ozgun, konum) {
  const bas = ozgun.lastIndexOf('\n', Math.max(0, konum - 1)) + 1;
  const son = ozgun.indexOf('\n', konum);
  return maskele(ozgun.slice(bas, son < 0 ? undefined : son).trim());
}

export function kes(ozgun, bas, son, sinir = 240) {
  const s = maskele(ozgun.slice(bas, son).replace(/\s+/g, ' ').trim());
  return s.length > sinir ? `${s.slice(0, sinir - 1)}…` : s;
}

// Etiketten sonra gelen ilk tarih: "KOŞULLU SALIVERİLME TARİHİ : 12/03/2031"
// veya tablo hücresinde "Koşullu Salıverilme Tarihi 12.03.2031".
export function etiketliTarih(ara, ozgun, etiketDeseni, { aralik = 60 } = {}) {
  const re = new RegExp(`(?:${etiketDeseni})[^0-9\\n]{0,${aralik}}(\\d{1,2}\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{4})`, 'g');
  for (const m of ara.matchAll(re)) {
    const t = tarihler(m[1])[0];
    if (t) return { deger: t.iso, kaynak: satiri(ozgun, m.index) };
  }
  return null;
}

// Etiketten sonra gelen değer (satır sonuna kadar): "SUÇ : Hırsızlık"
export function etiketliDeger(ara, ozgun, etiketDeseni) {
  const re = new RegExp(`(?:^|\\n)\\s*(?:${etiketDeseni})\\s*:\\s*([^\\n]+)`, 'g');
  const m = re.exec(ara);
  if (!m) return null;
  const bas = m.index + m[0].length - m[1].length;
  return { deger: ozgun.slice(bas, bas + m[1].length).trim(), kaynak: satiri(ozgun, bas) };
}
