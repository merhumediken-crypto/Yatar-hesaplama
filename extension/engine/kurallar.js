// Kural tabanına erişim ve gösterim yardımcıları. Hesap motoru sayısal değerleri
// (oran, süre, tarih eşiği) doğrudan kural kayıtlarının parametrelerinden okur.

import { Kesir } from './rasyonel.js';

const KANUN_ADLARI = {
  5237: 'TCK',
  5275: '5275 s. CGTİHK',
  3713: '3713 s. TMK',
  5271: 'CMK',
  4675: '4675 s. Kanun',
  5402: '5402 s. Kanun',
  7550: '7550 s. Kanun',
  7571: '7571 s. Kanun',
  7593: '7593 s. Kanun',
  7595: '7595 s. Kanun',
  7456: '7456 s. Kanun',
  7242: '7242 s. Kanun',
  AcikKurumaAyrilmaYonetmeligi: 'Açık Kuruma Ayrılma Yön.',
};

export function mevzuatEtiketi(ref) {
  const [kanun, madde = ''] = String(ref).split(':');
  const ad = KANUN_ADLARI[kanun] || `${kanun} s. Kanun`;
  const m = madde
    .replace(/^gecici(\d+)/, 'geçici $1')
    .replace(/_son_cumle$/, ' son cümle')
    .replace(/_ikinci_cumle$/, ' ikinci cümle')
    .replace(/_eski$/, ' (eski)')
    .replace(/_surumleri$/, ' (sürümleri)');
  return `${ad} m.${m}`;
}

export class KuralTabani {
  constructor(db) {
    if (!db || !Array.isArray(db.kurallar)) throw new Error('Kural tabanı geçersiz.');
    this.db = db;
    this.kurallar = new Map(db.kurallar.map((r) => [r.kural_id, r]));
    this.kaynaklar = new Map(db.kaynaklar.map((s) => [s.kaynak_id, s]));
    this.acikKonular = new Map(db.acik_konular.map((q) => [q.konu_id, q]));
    this.esikler = new Map(db.tarih_esikleri.map((t) => [t.esik_id, t]));
    this.hataKodlari = db.hesap_politikasi.hata_kodlari;
    this.seciciler = db.suclara_ozgu_seciciler;
  }

  get surum() {
    return this.db.paket.surum;
  }

  kural(id) {
    const r = this.kurallar.get(id);
    if (!r) throw new Error('Kural bulunamadı: ' + id);
    return r;
  }

  p(id) {
    return this.kural(id).parametreler;
  }

  oran(id, alan = 'oran') {
    return Kesir.from(this.p(id)[alan]);
  }

  esik(id) {
    return this.esikler.get(id).tarih;
  }

  katalog(ad) {
    const l = this.seciciler[ad];
    if (!Array.isArray(l)) throw new Error('Seçici bulunamadı: ' + ad);
    return l;
  }

  kuralOzeti(id) {
    const r = this.kural(id);
    return {
      kural_id: id,
      ozet: r.ozet,
      mevzuat: r.mevzuat_maddeleri.map(mevzuatEtiketi),
      dogrulama: r.dogrulama,
      kaynak_idleri: r.kaynak_idleri,
    };
  }

  kaynaklariTopla(kuralIdleri) {
    const ids = new Set();
    for (const id of kuralIdleri) {
      const r = this.kurallar.get(id);
      if (r) r.kaynak_idleri.forEach((s) => ids.add(s));
    }
    return [...ids].sort().map((id) => this.kaynaklar.get(id)).filter(Boolean);
  }
}
