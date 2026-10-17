// Kural tabanı deposu: derlenmiş çalışma paketine (extension/veri/paket.json)
// dizinli, salt okunur erişim. Hesap katmanı sayısal değerleri buradan okur.

import { Kesir } from '../zaman/rasyonel.js';

const KANUN_ADLARI = {
  5237: 'TCK',
  5275: '5275 s. CGTİHK',
  3713: '3713 s. TMK',
  5271: 'CMK',
  4675: '4675 s. İnfaz Hâkimliği K.',
  5402: '5402 s. DS Hizmetleri K.',
  5395: '5395 s. Çocuk Koruma K.',
  5941: '5941 s. Çek K.',
  16564: 'Açık Kuruma Ayrılma Yön.',
  2324: 'CİK Yönetimi Yön.',
  36118: 'Gözlem ve Sınıflandırma Yön.',
  39039: 'DS Hizmetleri Yön.',
  10885: 'Çocuk Koruma Usul Yön.',
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
  constructor(paket) {
    if (!paket?.kimlik || !Array.isArray(paket.kurallar) || !Array.isArray(paket.karar_dugumleri)) {
      throw new Error('Geçersiz çalışma paketi: npm run veri ile yeniden derleyin.');
    }
    this.paket = paket;
    this.kimlik = paket.kimlik;
    this.kurallar = new Map(paket.kurallar.map((r) => [r.kural_id, r]));
    this.dugumler = new Map(paket.karar_dugumleri.map((d) => [d.dugum_id, d]));
    this.seciciler = new Map(paket.makine_secicileri.map((s) => [s.secici_id, s]));
    this.alanSozlugu = new Map(paket.karar_alani_sozlugu.map((a) => [a.alan, a]));
    this.kanitlar = new Map(paket.kural_kanitlari.map((k) => [k.kanit_id, k]));
    this.kaynaklar = new Map(paket.kaynaklar.map((s) => [s.kaynak_id, s]));
    this.acikKonular = new Map(paket.acik_konular.map((q) => [q.konu_id, q]));
    this.kapanisKayitlari = new Map(paket.onceki_eksiklerin_kapanis_kaydi.map((q) => [q.konu_id, q]));
    this.esikler = new Map(paket.tarih_esikleri.map((t) => [t.esik_id, t]));
    this.normCakismalari = new Map(paket.norm_cakismalari.map((n) => [n.id, n]));
    this.anlamsalDenetimler = new Map(paket.vaka_anlamsal_denetimleri.map((v) => [v.id, v]));
    this.hataKodlari = paket.hesap_politikasi.hata_kodlari;
    this.mevzuatListesi = paket.mevzuat_listesi;
    this.maddeKurallari = new Map(paket.madde_kapsam_matrisi.map((m) => [m.madde_id, m.kural_idleri]));
    this.gruplar = new Map();
    for (const d of paket.karar_dugumleri) {
      if (!this.gruplar.has(d.grup)) this.gruplar.set(d.grup, []);
      this.gruplar.get(d.grup).push(d);
    }
    for (const liste of this.gruplar.values()) liste.sort((a, b) => a.oncelik - b.oncelik);
  }

  get surum() {
    return this.kimlik.paket_surumu;
  }

  get sha256() {
    return this.kimlik.kaynak_sha256;
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

  dugum(id) {
    const d = this.dugumler.get(id);
    if (!d) throw new Error('Karar düğümü bulunamadı: ' + id);
    return d;
  }

  esik(id) {
    return this.esikler.get(id).tarih;
  }

  // TCK maddesinin [kitap, kısım, bölüm] konumu (tam metindeki başlıklardan türetilir).
  tckKonumu(madde) {
    return this.paket.tck_yapisi[String(madde)] || null;
  }

  kaynakMevzuat(numara) {
    return this.mevzuatListesi.find((m) => m.mevzuat_numarasi === String(numara)) || null;
  }

  // "5275:105/A/1-2" → "U03:govde:105/A" (tam metin madde kimliği)
  maddeIdCoz(ref) {
    const [numara, madde = ''] = String(ref).split(':');
    const m = this.kaynakMevzuat(numara);
    if (!m) return null;
    const temel = madde.replace(/^gecici(\d+).*/, 'gecici_$1').match(/^(gecici_\d+|\d+(?:\/[A-Z])?)/);
    return temel ? `${m.kaynak_id}:govde:${temel[1]}` : null;
  }

  kuralOzeti(id) {
    const r = this.kural(id);
    return {
      kural_id: id,
      grup: r.grup,
      ozet: r.ozet,
      mevzuat: r.mevzuat_maddeleri.map(mevzuatEtiketi),
      madde_idleri: r.madde_referanslari || [],
      kanit_idleri: r.kanit_kimlikleri || [],
      karar_dugumu_idleri: r.karar_dugumu_idleri || [],
      dogrulama: r.dogrulama,
      otomasyon_kapsami: r.otomasyon_kapsami,
      kaynak_idleri: r.kaynak_idleri,
    };
  }

  kaynaklariTopla(kuralIdleri) {
    const ids = new Set();
    for (const id of kuralIdleri) this.kurallar.get(id)?.kaynak_idleri.forEach((s) => ids.add(s));
    return [...ids].sort().map((id) => this.kaynaklar.get(id)).filter(Boolean);
  }
}
