// Takvim işlemleri. Saat dilimi etkisini önlemek için bütün tarihler UTC gün
// numarası olarak işlenir. Kural tabanı: "Takvim işlemi ile gün birimi işlemi ayrı
// fonksiyonlardır; artık gün ve ay sonu davranışı test edilir." (hesap_politikasi)

const GUN_MS = 86400000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function gecerliTarih(s) {
  if (typeof s !== 'string') return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, a, g] = [+m[1], +m[2], +m[3]];
  const d = new Date(Date.UTC(y, a - 1, g));
  return d.getUTCFullYear() === y && d.getUTCMonth() === a - 1 && d.getUTCDate() === g;
}

function parcala(s) {
  if (!gecerliTarih(s)) throw new Error('Geçersiz tarih: ' + s);
  const m = ISO.exec(s);
  return [+m[1], +m[2], +m[3]];
}

export function gunNo(s) {
  const [y, a, g] = parcala(s);
  return Date.UTC(y, a - 1, g) / GUN_MS;
}

export function gundenTarih(n) {
  const d = new Date(n * GUN_MS);
  const y = d.getUTCFullYear();
  const a = String(d.getUTCMonth() + 1).padStart(2, '0');
  const g = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${a}-${g}`;
}

export function gunEkle(s, n) {
  return gundenTarih(gunNo(s) + n);
}

export function gunFarki(bas, bit) {
  return gunNo(bit) - gunNo(bas);
}

export function karsilastir(a, b) {
  return Math.sign(gunNo(a) - gunNo(b));
}

export const once = (a, b) => karsilastir(a, b) < 0;
export const sonra = (a, b) => karsilastir(a, b) > 0;
export const ayniGun = (a, b) => karsilastir(a, b) === 0;
export const enGec = (...xs) => xs.filter(Boolean).reduce((a, b) => (karsilastir(a, b) >= 0 ? a : b));
export const enErken = (...xs) => xs.filter(Boolean).reduce((a, b) => (karsilastir(a, b) <= 0 ? a : b));

// 0 = Pazar … 6 = Cumartesi
export function haftaGunu(s) {
  return new Date(gunNo(s) * GUN_MS).getUTCDay();
}

// Hafta sonuna denk gelen son günü izleyen pazartesiye taşır. Resmî tatiller
// bu pakette bulunmadığından ayrıca kontrol edilmelidir.
export function haftaSonuSonrasi(s) {
  const g = haftaGunu(s);
  return g === 6 ? gunEkle(s, 2) : g === 0 ? gunEkle(s, 1) : s;
}

// Takvim ayı ekleme (ay sonu kırpılır). TCK 61/6 "ay otuz gün" kuralından ayrı
// bir yöntemdir; hesap profili hangisinin kullanılacağını belirler.
export function takvimAyiEkle(s, n) {
  const [y, a, g] = parcala(s);
  const toplam = y * 12 + (a - 1) + n;
  const hy = Math.floor(toplam / 12);
  const ha = (toplam % 12) + 1;
  const hg = Math.min(g, ayinGunSayisi(hy, ha));
  return `${hy}-${String(ha).padStart(2, '0')}-${String(hg).padStart(2, '0')}`;
}

function ayinGunSayisi(y, a) {
  return new Date(Date.UTC(y, a, 0)).getUTCDate();
}

// Yıl resmî takvime göre (TCK 61/6, R003). 29 Şubat'tan artık olmayan yıla geçişte
// ay sonuna (28 Şubat) çekilir; bu davranış hesap izinde ayrıca belirtilir.
export function yilEkle(s, n) {
  const [y, a, g] = parcala(s);
  const hy = y + n;
  const sonGun = ayinGunSayisi(hy, a);
  const hg = Math.min(g, sonGun);
  return `${hy}-${String(a).padStart(2, '0')}-${String(hg).padStart(2, '0')}`;
}

export function subat29Kirpilir(s, n) {
  const [y, a, g] = parcala(s);
  return a === 2 && g === 29 && ayinGunSayisi(y + n, 2) === 28;
}

// Ceza süresinin takvime eklenmesi: yıl resmî takvim, ay 30 gün, gün 24 saat (TCK 61/6).
export function cezaEkle(s, ceza) {
  return gunEkle(yilEkle(s, ceza.yil || 0), (ceza.ay || 0) * 30 + (ceza.gun || 0));
}

// İki ceza miktarını aynı başlangıç tarihine göre karşılaştırır (yıl/ay/gün yapısı korunur).
export function cezaKarsilastir(a, b, referans) {
  return karsilastir(cezaEkle(referans, a), cezaEkle(referans, b));
}

export function yasHesapla(dogum, tarih) {
  const [dy, da, dg] = parcala(dogum);
  const [ty, ta, tg] = parcala(tarih);
  let yas = ty - dy;
  if (ta < da || (ta === da && tg < dg)) yas--;
  return yas;
}

export function trTarih(s) {
  if (!s) return '—';
  const [y, a, g] = parcala(s);
  return `${String(g).padStart(2, '0')}.${String(a).padStart(2, '0')}.${y}`;
}

export function bugunIstanbul(simdi = new Date()) {
  // Europe/Istanbul (UTC+3, yaz saati yok)
  return gundenTarih(Math.floor((simdi.getTime() + 3 * 3600000) / GUN_MS));
}

export function cezaMetni(c) {
  if (!c) return '—';
  const p = [];
  if (c.yil) p.push(`${c.yil} yıl`);
  if (c.ay) p.push(`${c.ay} ay`);
  if (c.gun) p.push(`${c.gun} gün`);
  return p.length ? p.join(' ') : '0 gün';
}

export function gunMetni(n) {
  if (n === null || n === undefined) return '—';
  const yil = Math.floor(n / 365);
  const kalan = n - yil * 365;
  const ay = Math.floor(kalan / 30);
  const gun = kalan - ay * 30;
  const p = [];
  if (yil) p.push(`${yil} yıl`);
  if (ay) p.push(`${ay} ay`);
  if (gun || !p.length) p.push(`${gun} gün`);
  return `≈ ${p.join(' ')}`;
}
