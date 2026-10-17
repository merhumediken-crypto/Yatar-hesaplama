// Kanonik vakadan infaz-kosul diline bağlam üretimi (kural_tabani.baglam_uyarlama).
//
// İki katman vardır:
//  1. Belgeli bağlam: yalnız girilen ve hukuken türetilebilen değerler; bilinmeyen null kalır.
//  2. Varsayım bağlamı: "olağan dosya" varsayımları açıkça uygulanır ve her biri kayda geçer.
// Varsayımlı senaryo sonuçları ikinci katmandan, "belirsiz koşullar" listesi birinciden üretilir.

import { yasHesapla, cezaKarsilastir } from '../zaman/takvim.js';
import { veya } from '../dil/kosul.js';

export const KAST_GRUBU = { kasit: 'kasit', olasi_kast: 'kasit', taksir: 'taksir', bilincli_taksir: 'taksir' };

// Özel listelerde yer almayan bir suç maddesini temsil eden gözcü değer. Bütün
// "eq ilam.madde" karşılaştırmaları bu değer için false döner.
export const GENEL_MADDE = '∅';

function tckMadde(ilam) {
  const { kanun, madde } = ilam.kanun_madde_fikra_bent;
  if (kanun === null || madde === null) return { bilinmiyor: true };
  if (kanun !== 5237) return { tck: false };
  const n = parseInt(madde, 10);
  return { tck: true, no: Number.isFinite(n) ? n : null, madde };
}

function cinselDokunulmazlik(ilam) {
  const t = tckMadde(ilam);
  if (t.bilinmiyor) return null;
  if (!t.tck) return false;
  return t.no >= 102 && t.no <= 105; // TCK 2. Kitap 2. Kısım 6. Bölüm
}

function sucGrubu(ilam) {
  const t = tckMadde(ilam);
  if (t.bilinmiyor) return null;
  if (!t.tck) return 'diger';
  if (t.no === 86 || t.no === 87) return 'kasten_yaralama_ve_neticesi_sebebiyle_agirlasmis_yaralama';
  if ([81, 82, 83, 85].includes(t.no)) return 'oldurme';
  return 'diger';
}

// baglam_uyarlama.ceza_turu_onceligi: infazdaki tür → belgeli çevirme → hükümdeki tür.
export function infazCezaTuru(ilam) {
  if (ilam.infazdaki_ceza_turu) return ilam.infazdaki_ceza_turu;
  if (ilam.para_cezasindan_cevrilme === true) return 'adli_paradan_cevrilen_hapis';
  return ilam.hukumdeki_ceza_turu;
}

// 107/16 ve 3713 m.17 / 5275 geçici 2 kanuni KS yasakları (R032, R116).
export function kanuniKsYasagi(kt, ilam) {
  const tur = infazCezaTuru(ilam);
  if (tur !== 'agirlastirilmis_muebbet') return null;
  if (ilam.teror_kanunu_kapsami === true) {
    return { kural: 'R116', neden: 'Terör suçlusunun ağırlaştırılmış müebbet hapsi: koşullu salıverilme hükümleri uygulanmaz (3713 m.17, 5275 geçici m.2).' };
  }
  const konum = ilam.kanun_madde_fikra_bent.kanun === 5237 ? kt.tckKonumu(ilam.kanun_madde_fikra_bent.madde) : null;
  if (konum && konum[0] === 2 && konum[1] === 4 && [4, 5, 6].includes(konum[2]) && ilam.orgut_faaliyeti === true) {
    return { kural: 'R032', neden: 'TCK 2. Kitap 4. Kısım 4-6. bölüm suçunun örgüt faaliyeti çerçevesinde işlenmesinden ağırlaştırılmış müebbet: koşullu salıverilme hükümleri uygulanmaz (5275 m.107/16).' };
  }
  return null;
}

export function sucYasi(vaka, tarih) {
  return vaka.dogum_tarihi && tarih ? yasHesapla(vaka.dogum_tarihi, tarih) : null;
}

// Hükümlünün suç tarihindeki yaşı; doğum tarihi yoksa null.
export function kararBaglami(kt, ortam, { tekerrur, infaz = {} } = {}) {
  const { vaka, ilam } = ortam;
  const mfb = ilam.kanun_madde_fikra_bent;
  const konum = mfb.kanun === 5237 && mfb.madde ? kt.tckKonumu(mfb.madde) : null;
  const kanuni = kanuniKsYasagi(kt, ilam);
  const ceza = ortam.ceza;
  const E = ortam.E;
  const sureKarsilastir = (yil) => (ceza && E ? cezaKarsilastir(ceza, { yil, ay: 0, gun: 0 }, E) : null);
  const kucukEsit = (yil) => {
    const c = sureKarsilastir(yil);
    return c === null ? null : c <= 0;
  };
  const kucuk = (yil) => {
    const c = sureKarsilastir(yil);
    return c === null ? null : c < 0;
  };
  const kadin = vaka.cinsiyet === 'kadin' ? true : vaka.cinsiyet === 'erkek' ? false : null;

  return {
    kisi: {
      suc_yasi: sucYasi(vaka, ilam.suc_tarihi),
      kadin_hukumlu: kadin,
      '0_6_yas_grubunda_cocugu_var': vaka.kadin_0_6_cocuk,
      '105A_3_b_raporu_dogrulandi': vaka.rapor_105A_3_b,
    },
    ilam: {
      kanun: mfb.kanun,
      madde: mfb.madde,
      fikra: mfb.fikra,
      bent: mfb.bent,
      kitap: konum ? konum[0] : mfb.kanun !== null && mfb.kanun !== 5237 ? 0 : null,
      kisim: konum ? konum[1] : mfb.kanun !== null && mfb.kanun !== 5237 ? 0 : null,
      bolum: konum ? konum[2] : mfb.kanun !== null && mfb.kanun !== 5237 ? 0 : null,
      suc_tarihi: ilam.suc_tarihi,
      tekerrur: tekerrur ?? ilam.hukumdeki_tekerrur,
      ceza_turu: infazCezaTuru(ilam),
      para_cezasindan_cevrilme: ilam.para_cezasindan_cevrilme,
      kast_turu: ilam.kast_turu === 'bilinmiyor' ? null : ilam.kast_turu,
      kast_grubu: KAST_GRUBU[ilam.kast_turu] ?? null,
      teror: ilam.teror_kanunu_kapsami,
      orgut_faaliyeti: ilam.orgut_faaliyeti,
      orgut_kurma_yonetme: ilam.orgut_kurma_yonetme,
      orgut_kurma_yonetme_uyelik: veya([ilam.orgut_kurma_yonetme, ilam.orgut_uyelik]),
      cinsel_dokunulmazlik: cinselDokunulmazlik(ilam),
      suc_grubu: sucGrubu(ilam),
      magdur_yakinlik: ilam.magdur_yakinlik,
      magdur_savunmasiz: ilam.magdur_savunmasiz,
      magdur_es: ilam.magdur_yakinlik === null ? null : ilam.magdur_yakinlik === 'es',
      deprem_yapi_olumu: ilam.deprem_yapi_olumu_baglantisi,
      KS_geri_alinmis_aynen_infaz: ilam.ks_geri_alindi,
      ozel_KS_yasagi_dogrulandi: kanuni ? true : ilam.ozel_ks_yasagi,
      '2937_ceza_kapsami_dogrulandi': ilam.mit_2937_kapsami_dogrulandi,
      cocuk_hakkinda_adli_para_hukmu: ilam.cocuk_hakkinda_adli_para_hukmu,
    },
    infaz: {
      kurum: vaka.mevcut_kurum === 'bilinmiyor' ? null : vaka.mevcut_kurum,
      iyi_hal: vaka.iyi_hal,
      DS_talebi_var: vaka.ds_talebi,
      aciga_ayrilma_sartlari_saglandi: null,
      iradesi_disinda_ayrilamama: null,
      KSye_bir_takvim_yili_veya_az: null,
      KSye_iki_takvim_yili_veya_az: null,
      KSye_uc_takvim_yili_veya_az: null,
      toplam_hapis_uc_takvim_yili_veya_az: kucukEsit(3),
      toplam_hapis_bes_takvim_yili_veya_az: kucukEsit(5),
      toplam_hapis_on_takvim_yilindan_az: kucuk(10),
      ...infaz,
    },
    cek: {
      m6_bedel_ve_faiz_tam_odendi_dogrulandi: vaka.cek.m6_bedel_ve_faiz_tam_odendi_dogrulandi,
      vazgecme_gecerli_dogrulandi: vaka.cek.vazgecme_gecerli_dogrulandi,
      gecici5_uygulama_karari_dogrulandi: vaka.cek.gecici5_uygulama_karari_dogrulandi,
      vadeli_taksit_aksama_sayisi: vaka.cek.vadeli_taksit_aksama_sayisi,
    },
    para: {
      kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi: vaka.cek.kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi,
    },
    _kanuni_ks_yasagi: kanuni,
  };
}

// ---------------------------------------------------------------------------
// Olağan dosya varsayımları
// ---------------------------------------------------------------------------

// Her biri: bilinmeyen (null) alan → varsayılan değer. Yalnız belgelenmemiş
// alanlara uygulanır; girilmiş bir değerin üzerine asla yazılmaz.
export const OLAGAN_VARSAYIMLAR = [
  { alan: 'ilam.ceza_turu', deger: 'sureli_hapis', kurallar: ['R020'], mesaj: 'Ceza türü belirtilmedi; süreli hapis kabul edildi.' },
  { alan: 'ilam.madde', deger: GENEL_MADDE, kurallar: ['R021', 'R022', 'R050'], kod: 'E001', mesaj: 'Suç maddesi girilmedi; suçun özel oran ve istisna listelerinin dışında olduğu varsayıldı.' },
  { alan: 'ilam.kanun', deger: 5237, kurallar: ['R021'], mesaj: 'Kanun belirtilmedi; TCK kabul edildi.' },
  // Madde bilinmediğinde maddeden türetilen alanlar da "genel suç" değerini alır.
  { alan: 'ilam.kitap', deger: 0, kurallar: ['R050'], gizli: true },
  { alan: 'ilam.kisim', deger: 0, kurallar: ['R050'], gizli: true },
  { alan: 'ilam.bolum', deger: 0, kurallar: ['R050'], gizli: true },
  { alan: 'ilam.suc_grubu', deger: 'diger', kurallar: ['R050'], gizli: true },
  { alan: 'ilam.cinsel_dokunulmazlik', deger: false, kurallar: ['R060'], gizli: true },
  { alan: 'kisi.suc_yasi', deger: 18, kurallar: ['R013', 'R025'], mesaj: 'Doğum tarihi girilmedi; suç tarihinde 18 yaşını doldurmuş olduğu varsayıldı.' },
  { alan: 'ilam.kast_turu', deger: 'kasit', kurallar: ['R012', 'R060'], mesaj: 'Kast türü belirtilmedi; kasıtlı suç kabul edildi.' },
  { alan: 'ilam.kast_grubu', deger: 'kasit', kurallar: ['R012'], gizli: true },
  { alan: 'ilam.teror', deger: false, kurallar: ['R024', 'R116'], mesaj: 'Terörle Mücadele Kanunu kapsamı belirtilmedi; kapsam dışı varsayıldı.' },
  { alan: 'ilam.orgut_faaliyeti', deger: false, kurallar: ['R023'], mesaj: 'Örgüt faaliyeti belirtilmedi; örgüt suçu olmadığı varsayıldı.' },
  { alan: 'ilam.orgut_kurma_yonetme', deger: false, kurallar: ['R023'], gizli: true },
  { alan: 'ilam.orgut_kurma_yonetme_uyelik', deger: false, kurallar: ['R060'], gizli: true },
  { alan: 'ilam.ozel_KS_yasagi_dogrulandi', deger: false, kurallar: ['R032', 'R116'], mesaj: 'Özel koşullu salıverilme yasağı (5275 m.107/16, 3713 m.17) bulunmadığı varsayıldı.' },
  { alan: 'ilam.KS_geri_alinmis_aynen_infaz', deger: false, kurallar: ['R074'], mesaj: 'Bu hükümde koşullu salıverilmenin geri alınmadığı varsayıldı.' },
  { alan: 'ilam.para_cezasindan_cevrilme', deger: false, kurallar: ['R044', 'R102'], mesaj: 'Hapsin adli para cezasından çevrilmediği varsayıldı.' },
  { alan: 'infaz.iyi_hal', deger: true, kurallar: ['R062'], kod: 'E008', mesaj: 'İyi hâl varsayıldı. İyi hâl tarih hesabından türetilemez; kurul ve yetkili merci kararı gerekir.' },
  { alan: 'infaz.DS_talebi_var', deger: true, kurallar: ['R040'], mesaj: 'Hükümlünün denetimli serbestlik talebinde bulunacağı varsayıldı.' },
  { alan: 'kisi.kadin_hukumlu', deger: false, kurallar: ['R041'], gizli: true },
  { alan: 'kisi.0_6_yas_grubunda_cocugu_var', deger: false, kurallar: ['R041'], gizli: true },
  { alan: 'kisi.105A_3_b_raporu_dogrulandi', deger: false, kurallar: ['R041'], gizli: true },
  { alan: 'ilam.cocuk_hakkinda_adli_para_hukmu', deger: false, kurallar: ['R104'], gizli: true },
];

function yaz(baglam, yol, deger) {
  const parcalar = yol.split('.');
  let o = baglam;
  for (const p of parcalar.slice(0, -1)) o = o[p];
  o[parcalar.at(-1)] = deger;
}

function oku(baglam, yol) {
  return yol.split('.').reduce((o, p) => (o == null ? undefined : o[p]), baglam);
}

export function varsayimlariUygula(belgeli) {
  const baglam = structuredClone(belgeli);
  const uygulanan = [];
  for (const v of OLAGAN_VARSAYIMLAR) {
    const mevcut = oku(baglam, v.alan);
    if (mevcut === null || mevcut === undefined) {
      yaz(baglam, v.alan, v.deger);
      if (!v.gizli) uygulanan.push({ alan: v.alan, deger: v.deger, mesaj: v.mesaj, kurallar: v.kurallar, kod: v.kod || null });
    }
  }
  return { baglam, uygulanan };
}

// Aynı bağlamda bir infaz kapısının (ör. "KS'ye bir yıl veya az kaldı") belirli bir
// aday tarihte sağlandığı kabul edilerek değerlendirme yapılır.
export function kapiliBaglam(baglam, infazEk) {
  return { ...baglam, infaz: { ...baglam.infaz, ...infazEk } };
}
