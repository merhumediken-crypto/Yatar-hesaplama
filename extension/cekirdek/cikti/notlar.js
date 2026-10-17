// Gerekçe notları ve durum makinesi.
//
// Seviyeler: bilgi < varsayim < inceleme < eksik
// Durum makinesi (hesap_politikasi.durum_makinesi) bu paketle yalnız ilk üç durumu
// üretebilir: eksik_veri, hukuki_inceleme_gerekli, varsayimli_senaryo.

export const SEVIYE_SIRASI = { bilgi: 0, varsayim: 1, inceleme: 2, eksik: 3 };

export class Notlar {
  constructor() {
    this.liste = [];
  }

  ekle(seviye, kod, mesaj, kurallar = []) {
    if (!(seviye in SEVIYE_SIRASI)) throw new Error('Geçersiz not seviyesi: ' + seviye);
    if (!this.liste.some((n) => n.kod === kod && n.mesaj === mesaj)) this.liste.push({ seviye, kod, mesaj, kurallar });
    return this;
  }

  hepsi(liste) {
    for (const n of liste) this.ekle(n.seviye, n.kod, n.mesaj, n.kurallar);
    return this;
  }

  get enYuksek() {
    return this.liste.reduce((m, n) => (SEVIYE_SIRASI[n.seviye] > SEVIYE_SIRASI[m] ? n.seviye : m), 'bilgi');
  }
}

export function durumBelirle(...notListeleri) {
  const tum = notListeleri.flat();
  if (tum.some((n) => n.seviye === 'eksik')) return 'eksik_veri';
  if (tum.some((n) => n.seviye === 'inceleme')) return 'hukuki_inceleme_gerekli';
  return 'varsayimli_senaryo';
}

// Not kodlarında ve metinlerinde geçen kimlikleri toplar.
//   onEkler: ['A'] açık konular, ['E'] hata kodları, ['N'] norm çatışmaları
export function kodlariTopla(notlar, onEkler) {
  const desen = new RegExp(`\\b(?:${onEkler.join('|')})\\d{2,3}\\b`, 'g');
  const kume = new Set();
  for (const n of notlar) {
    for (const m of `${n.kod} ${n.mesaj}`.matchAll(desen)) kume.add(m[0]);
  }
  return [...kume].sort();
}
