// Vaka girdisinin normalleştirilmesi.
//
// Motorun tek kabul ettiği biçim "kanonik vaka"dır (docs/MIMARI.md). Burada:
//  - geçersiz tarih/sayı/enum değerleri sessizce düzeltilmez; null yapılır ve sorun kaydı üretilir,
//  - string sayı otomatik sayıya çevrilmez (kural_dili.tip_uyusmazligi),
//  - eklentinin 0.1 sürümündeki alan adları (ilam, mahsup_gun …) geriye uyum için çevrilir.

import { gecerliTarih } from '../zaman/takvim.js';
import { PROFIL_SECENEKLERI } from '../zaman/profil.js';

export const KAST_TURLERI = ['kasit', 'olasi_kast', 'taksir', 'bilincli_taksir', 'bilinmiyor'];
export const CEZA_TURLERI = ['sureli_hapis', 'muebbet', 'agirlastirilmis_muebbet', 'adli_para', 'adli_paradan_cevrilen_hapis', 'tazyik', 'disiplin_hapsi', 'zorlama_hapsi', 'diger'];
export const TEKERRUR_DEGERLERI = ['yok', 'birinci', 'ikinci', '58_9_ozel_tehlikelilik', 'belirsiz'];
export const MAGDUR_YAKINLIK = ['ustsoy', 'altsoy', 'es', 'kardes', 'diger'];
export const MAHSUP_TURLERI = ['gozalti', 'tutukluluk', 'konutu_terk_etmeme', 'denetimli_serbestlik', 'diger'];
export const KURUM_TURLERI = ['kapali', 'acik', 'cocuk_egitimevi', 'disarida', 'bilinmiyor'];
export const INFAZ_DURUMLARI = ['baslamadi', 'suruyor', 'tamamlandi', 'hukuken_kalkti', 'bilinmiyor'];

class Denetci {
  constructor() {
    this.sorunlar = [];
  }
  sorun(alan, mesaj, kod = 'GIRDI') {
    this.sorunlar.push({ kod, alan, mesaj });
  }
  tarih(o, alan, yol) {
    const v = o?.[alan];
    if (v === undefined || v === null || v === '') return null;
    if (gecerliTarih(v)) return v;
    this.sorun(yol, `Geçersiz tarih: ${JSON.stringify(v)} (YYYY-AA-GG bekleniyor)`);
    return null;
  }
  mantiksal(o, alan, yol) {
    const v = o?.[alan];
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    this.sorun(yol, `Doğru/yanlış bekleniyor: ${JSON.stringify(v)}`);
    return null;
  }
  tamsayi(o, alan, yol, { min = 0 } = {}) {
    const v = o?.[alan];
    if (v === undefined || v === null || v === '') return null;
    if (Number.isSafeInteger(v) && v >= min) return v;
    this.sorun(yol, `Tam sayı bekleniyor: ${JSON.stringify(v)}`);
    return null;
  }
  secim(o, alan, yol, izinli) {
    const v = o?.[alan];
    if (v === undefined || v === null || v === '') return null;
    if (izinli.includes(v)) return v;
    this.sorun(yol, `Geçersiz değer: ${JSON.stringify(v)}`);
    return null;
  }
  metin(o, alan) {
    const v = o?.[alan];
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }
  ceza(o, alan, yol) {
    const c = o?.[alan];
    if (c === undefined || c === null) return null;
    if (typeof c !== 'object' || Array.isArray(c)) {
      this.sorun(yol, 'Ceza {yil, ay, gun} biçiminde olmalı');
      return null;
    }
    const sonuc = {};
    for (const a of ['yil', 'ay', 'gun']) {
      const v = c[a] ?? 0;
      if (!Number.isSafeInteger(v) || v < 0) {
        this.sorun(`${yol}.${a}`, `Tam sayı bekleniyor: ${JSON.stringify(c[a])}`);
        return null;
      }
      sonuc[a] = v;
    }
    if (!sonuc.yil && !sonuc.ay && !sonuc.gun) return null;
    return sonuc;
  }
}

function geriyeUyum(v) {
  const o = { ...v };
  if (!o.suclar_ve_ilamlar && o.ilam) o.suclar_ve_ilamlar = [o.ilam];
  if (!o.mahsup_kayitlari && Number.isInteger(o.mahsup_gun)) {
    o.mahsup_kayitlari = o.mahsup_gun > 0 ? [{ tur: 'tutukluluk', gun: o.mahsup_gun }] : [];
  }
  if (o.rapor_105A_3_b === undefined && o.agir_hasta_yalniz_yasayamaz !== undefined) o.rapor_105A_3_b = o.agir_hasta_yalniz_yasayamaz;
  if (o.iyi_hal === undefined && o.iyi_hal_karari !== undefined) o.iyi_hal = o.iyi_hal_karari;
  return o;
}

function ilamNormallestir(d, i, yol) {
  if (!i || typeof i !== 'object' || Array.isArray(i)) {
    d.sorun(yol, 'İlam kaydı nesne olmalı.');
    i = {};
  }
  let mfb = i.kanun_madde_fikra_bent || {};
  if (typeof mfb !== 'object' || Array.isArray(mfb)) {
    d.sorun(`${yol}.kanun_madde_fikra_bent`, 'Suç maddesi nesne olmalı.');
    mfb = {};
  }
  const kanun = mfb.kanun === undefined || mfb.kanun === null || mfb.kanun === '' ? null : mfb.kanun;
  if (kanun !== null && (!Number.isSafeInteger(kanun) || kanun <= 0)) d.sorun(`${yol}.kanun_madde_fikra_bent.kanun`, `Kanun numarası pozitif tam sayı olmalı: ${JSON.stringify(kanun)}`);
  for (const [alan, desen] of [['madde', /^[1-9]\d*(?:\/[A-Z])?$/i], ['fikra', /^[1-9]\d*$/], ['bent', /^[a-zçğıöşü]$/i]]) {
    if (mfb[alan] != null && String(mfb[alan]).trim() !== '' && !desen.test(String(mfb[alan]).trim().replace(/^0+(?=\d)/, ''))) d.sorun(`${yol}.kanun_madde_fikra_bent.${alan}`, 'Geçersiz madde/fıkra/bent biçimi.');
  }
  const altMetin = (x) => (x === undefined || x === null || String(x).trim() === '' ? null : String(x).trim().toLowerCase());
  return {
    ilam_id: d.metin(i, 'ilam_id') || 'İlam-1',
    // Toplamada ilamı tanıtan kısa ad (ör. "Diyarbakır 12. Asliye Ceza 2017/157 E.") ve hüküm tarihi.
    etiket: d.metin(i, 'etiket'),
    karar_tarihi: d.tarih(i, 'karar_tarihi', `${yol}.karar_tarihi`),
    // İlk tekerrürde bu ilam için 108/2 sınırına esas en ağır önceki ceza.
    tekerrure_esas_en_agir_ceza: d.ceza(i, 'tekerrure_esas_en_agir_ceza', `${yol}.tekerrure_esas_en_agir_ceza`),
    suc_tarihi: d.tarih(i, 'suc_tarihi', `${yol}.suc_tarihi`),
    suc_tarihi_hukuken_belirlendi: d.mantiksal(i, 'suc_tarihi_hukuken_belirlendi', `${yol}.suc_tarihi_hukuken_belirlendi`),
    kanun_madde_fikra_bent: {
      kanun: Number.isInteger(kanun) ? kanun : null,
      madde: mfb.madde === undefined || mfb.madde === null || String(mfb.madde).trim() === '' ? null : String(mfb.madde).trim().replace(/^0+(?=\d)/, '').toUpperCase(),
      fikra: altMetin(mfb.fikra),
      bent: altMetin(mfb.bent),
    },
    kast_turu: d.secim(i, 'kast_turu', `${yol}.kast_turu`, KAST_TURLERI),
    hukumdeki_ceza_turu: d.secim(i, 'hukumdeki_ceza_turu', `${yol}.hukumdeki_ceza_turu`, CEZA_TURLERI) ?? d.secim(i, 'ceza_turu', `${yol}.ceza_turu`, CEZA_TURLERI),
    infazdaki_ceza_turu: d.secim(i, 'infazdaki_ceza_turu', `${yol}.infazdaki_ceza_turu`, CEZA_TURLERI),
    para_cezasindan_cevrilme: d.mantiksal(i, 'para_cezasindan_cevrilme', `${yol}.para_cezasindan_cevrilme`),
    hukumdeki_sonuc_ceza: d.ceza(i, 'hukumdeki_sonuc_ceza', `${yol}.hukumdeki_sonuc_ceza`),
    kesinlesme_tarihi: d.tarih(i, 'kesinlesme_tarihi', `${yol}.kesinlesme_tarihi`),
    hukumdeki_tekerrur: d.secim(i, 'hukumdeki_tekerrur', `${yol}.hukumdeki_tekerrur`, TEKERRUR_DEGERLERI),
    teror_kanunu_kapsami: d.mantiksal(i, 'teror_kanunu_kapsami', `${yol}.teror_kanunu_kapsami`),
    orgut_faaliyeti: d.mantiksal(i, 'orgut_faaliyeti', `${yol}.orgut_faaliyeti`),
    orgut_kurma_yonetme: d.mantiksal(i, 'orgut_kurma_yonetme', `${yol}.orgut_kurma_yonetme`),
    orgut_uyelik: d.mantiksal(i, 'orgut_uyelik', `${yol}.orgut_uyelik`),
    magdur_yakinlik: d.secim(i, 'magdur_yakinlik', `${yol}.magdur_yakinlik`, MAGDUR_YAKINLIK),
    magdur_savunmasiz: d.mantiksal(i, 'magdur_savunmasiz', `${yol}.magdur_savunmasiz`),
    deprem_yapi_olumu_baglantisi: d.mantiksal(i, 'deprem_yapi_olumu_baglantisi', `${yol}.deprem_yapi_olumu_baglantisi`),
    ks_geri_alindi: d.mantiksal(i, 'ks_geri_alindi', `${yol}.ks_geri_alindi`),
    ozel_ks_yasagi: d.mantiksal(i, 'ozel_ks_yasagi', `${yol}.ozel_ks_yasagi`),
    cocuga_karsi_suc: d.mantiksal(i, 'cocuga_karsi_suc', `${yol}.cocuga_karsi_suc`),
    mit_2937_kapsami_dogrulandi: d.mantiksal(i, 'mit_2937_kapsami_dogrulandi', `${yol}.mit_2937_kapsami_dogrulandi`),
    cocuk_hakkinda_adli_para_hukmu: d.mantiksal(i, 'cocuk_hakkinda_adli_para_hukmu', `${yol}.cocuk_hakkinda_adli_para_hukmu`),
  };
}

function oncekiNormallestir(d, o, i) {
  const yol = `onceki_mahkumiyetler[${i}]`;
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    d.sorun(yol, 'Önceki mahkûmiyet kaydı nesne olmalı.');
    o = {};
  }
  return {
    ilam_id: d.metin(o, 'ilam_id') || `Önceki-${i + 1}`,
    suc_tarihi: d.tarih(o, 'suc_tarihi', `${yol}.suc_tarihi`),
    suclunun_o_tarihteki_yasi: d.tamsayi(o, 'suclunun_o_tarihteki_yasi', `${yol}.suclunun_o_tarihteki_yasi`),
    kast_turu: d.secim(o, 'kast_turu', `${yol}.kast_turu`, KAST_TURLERI),
    kesinlesme_tarihi: d.tarih(o, 'kesinlesme_tarihi', `${yol}.kesinlesme_tarihi`),
    ceza_turu: d.secim(o, 'ceza_turu', `${yol}.ceza_turu`, CEZA_TURLERI),
    ceza: d.ceza(o, 'ceza', `${yol}.ceza`),
    infaz_durumu: d.secim(o, 'infaz_durumu', `${yol}.infaz_durumu`, INFAZ_DURUMLARI),
    infaz_tamamlanma_tarihi: d.tarih(o, 'infaz_tamamlanma_tarihi', `${yol}.infaz_tamamlanma_tarihi`),
    tekerrur_uygulanmis_mi: d.mantiksal(o, 'tekerrur_uygulanmis_mi', `${yol}.tekerrur_uygulanmis_mi`),
    karar_turu: d.secim(o, 'karar_turu', `${yol}.karar_turu`, ['mahkumiyet', 'hagb', 'hagb_aciklandi']),
    cmk_272_3_engeli: d.mantiksal(o, 'cmk_272_3_engeli', `${yol}.cmk_272_3_engeli`) ?? d.mantiksal(o, 'tekerrure_esas_olamaz', `${yol}.tekerrure_esas_olamaz`),
    yabanci_mahkeme_karari: d.mantiksal(o, 'yabanci_mahkeme_karari', `${yol}.yabanci_mahkeme_karari`),
    yabanci_istisna_sucu: d.mantiksal(o, 'yabanci_istisna_sucu', `${yol}.yabanci_istisna_sucu`),
    sirf_askeri_suc: d.mantiksal(o, 'sirf_askeri_suc', `${yol}.sirf_askeri_suc`),
  };
}

function mahsupNormallestir(d, m, i) {
  const yol = `mahsup_kayitlari[${i}]`;
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    d.sorun(yol, 'Mahsup kaydı nesne olmalı.');
    m = {};
  }
  return {
    kayit_id: d.metin(m, 'kayit_id') || `M${i + 1}`,
    tur: d.secim(m, 'tur', `${yol}.tur`, MAHSUP_TURLERI) || 'tutukluluk',
    gun: d.tamsayi(m, 'gun', `${yol}.gun`),
    baslangic: d.tarih(m, 'baslangic', `${yol}.baslangic`),
    bitis: d.tarih(m, 'bitis', `${yol}.bitis`),
    kaynak_karar: d.metin(m, 'kaynak_karar'),
  };
}

export function vakaNormallestir(girdi = {}) {
  const d = new Denetci();
  if (!girdi || typeof girdi !== 'object' || Array.isArray(girdi)) {
    d.sorun('$', 'Vaka nesne olmalı.');
    girdi = {};
  }
  const v = geriyeUyum(girdi || {});
  if (v.mahsup_gun != null && (!Number.isSafeInteger(v.mahsup_gun) || v.mahsup_gun < 0)) d.sorun('mahsup_gun', 'Mahsup gün sayısı sıfır veya pozitif tam sayı olmalı.');
  if (v.profil != null) {
    if (typeof v.profil !== 'object' || Array.isArray(v.profil)) d.sorun('profil', 'Hesap profili nesne olmalı.');
    else {
      for (const [alan, secenekler] of Object.entries(PROFIL_SECENEKLERI)) {
        if (v.profil[alan] != null && !Object.hasOwn(secenekler, v.profil[alan])) d.sorun(`profil.${alan}`, 'Geçersiz hesap profili seçimi.');
      }
      if (v.profil.mahsup_kurumda_gecmis_sayilir != null && typeof v.profil.mahsup_kurumda_gecmis_sayilir !== 'boolean') d.sorun('profil.mahsup_kurumda_gecmis_sayilir', 'Doğru/yanlış bekleniyor.');
    }
  }
  for (const alan of ['suclar_ve_ilamlar', 'onceki_mahkumiyetler', 'mahsup_kayitlari']) {
    if (v[alan] != null && !Array.isArray(v[alan])) d.sorun(alan, 'Liste bekleniyor.');
  }
  const ilamlar = Array.isArray(v.suclar_ve_ilamlar) ? v.suclar_ve_ilamlar : [];
  const cek = v.cek || {};
  const vaka = {
    hesap_tarihi: d.tarih(v, 'hesap_tarihi', 'hesap_tarihi'),
    dogum_tarihi: d.tarih(v, 'dogum_tarihi', 'dogum_tarihi'),
    cinsiyet: d.secim(v, 'cinsiyet', 'cinsiyet', ['kadin', 'erkek']),
    kadin_0_6_cocuk: d.mantiksal(v, 'kadin_0_6_cocuk', 'kadin_0_6_cocuk'),
    rapor_105A_3_b: d.mantiksal(v, 'rapor_105A_3_b', 'rapor_105A_3_b'),
    infaza_baslama_tarihi: d.tarih(v, 'infaza_baslama_tarihi', 'infaza_baslama_tarihi'),
    mevcut_kurum: d.secim(v, 'mevcut_kurum', 'mevcut_kurum', KURUM_TURLERI),
    iyi_hal: d.mantiksal(v, 'iyi_hal', 'iyi_hal'),
    ds_talebi: d.mantiksal(v, 'ds_talebi', 'ds_talebi'),
    yuksek_guvenlik: d.mantiksal(v, 'yuksek_guvenlik', 'yuksek_guvenlik'),
    mahsup_kayitlari: Array.isArray(v.mahsup_kayitlari) ? v.mahsup_kayitlari.map((m, i) => mahsupNormallestir(d, m, i)) : null,
    onceki_mahkumiyet_kayitlari_tam_mi: d.mantiksal(v, 'onceki_mahkumiyet_kayitlari_tam_mi', 'onceki_mahkumiyet_kayitlari_tam_mi'),
    onceki_mahkumiyetler: Array.isArray(v.onceki_mahkumiyetler) ? v.onceki_mahkumiyetler.map((o, i) => oncekiNormallestir(d, o, i)) : [],
    tekerrure_esas_en_agir_ceza: d.ceza(v, 'tekerrure_esas_en_agir_ceza', 'tekerrure_esas_en_agir_ceza'),
    suclar_ve_ilamlar: ilamlar.map((i, n) => ilamNormallestir(d, i, `suclar_ve_ilamlar[${n}]`)),
    cek: {
      m6_bedel_ve_faiz_tam_odendi_dogrulandi: d.mantiksal(cek, 'm6_bedel_ve_faiz_tam_odendi_dogrulandi', 'cek.m6_bedel_ve_faiz_tam_odendi_dogrulandi'),
      vazgecme_gecerli_dogrulandi: d.mantiksal(cek, 'vazgecme_gecerli_dogrulandi', 'cek.vazgecme_gecerli_dogrulandi'),
      gecici5_uygulama_karari_dogrulandi: d.mantiksal(cek, 'gecici5_uygulama_karari_dogrulandi', 'cek.gecici5_uygulama_karari_dogrulandi'),
      vadeli_taksit_aksama_sayisi: d.tamsayi(cek, 'vadeli_taksit_aksama_sayisi', 'cek.vadeli_taksit_aksama_sayisi'),
      kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi: d.mantiksal(cek, 'kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi', 'cek.kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi'),
      odemeler: Array.isArray(cek.odemeler) ? cek.odemeler : [],
    },
    profil: v.profil || null,
  };
  if (!vaka.suclar_ve_ilamlar.length) d.sorun('suclar_ve_ilamlar', 'En az bir ilam gerekir.', 'E011');
  for (const [n, i] of vaka.suclar_ve_ilamlar.entries()) {
    if (vaka.dogum_tarihi && i.suc_tarihi && vaka.dogum_tarihi > i.suc_tarihi) d.sorun('dogum_tarihi', 'Doğum tarihi suç tarihinden sonra olamaz.');
    if (i.karar_tarihi && i.suc_tarihi && i.karar_tarihi < i.suc_tarihi) d.sorun(`suclar_ve_ilamlar[${n}].suc_tarihi`, 'Suç tarihi hüküm tarihinden sonra olamaz.');
    if (i.kesinlesme_tarihi && i.suc_tarihi && i.kesinlesme_tarihi < i.suc_tarihi) d.sorun(`suclar_ve_ilamlar[${n}].kesinlesme_tarihi`, 'Kesinleşme tarihi suç tarihinden önce olamaz.');
    if (vaka.infaza_baslama_tarihi && i.suc_tarihi && vaka.infaza_baslama_tarihi < i.suc_tarihi) d.sorun('infaza_baslama_tarihi', 'İnfaza başlama tarihi suç tarihinden önce olamaz.');
    if (vaka.hesap_tarihi && i.suc_tarihi && i.suc_tarihi > vaka.hesap_tarihi) d.sorun(`suclar_ve_ilamlar[${n}].suc_tarihi`, 'Suç tarihi hesap tarihinden sonra olamaz.');
  }
  const ids = new Set();
  const araliklar = [];
  for (const m of vaka.mahsup_kayitlari || []) {
    if (ids.has(m.kayit_id)) d.sorun('mahsup_kayitlari', `Tekrarlanan mahsup kimliği: ${m.kayit_id}`);
    ids.add(m.kayit_id);
    if (m.gun === null && !(m.baslangic && m.bitis)) d.sorun('mahsup_kayitlari', `${m.kayit_id}: gün sayısı veya iki tarih gerekir.`);
    if (m.baslangic && m.bitis) {
      if (m.bitis < m.baslangic) d.sorun('mahsup_kayitlari', `${m.kayit_id}: bitiş başlangıçtan önce olamaz.`);
      araliklar.push(m);
    }
  }
  araliklar.sort((a, b) => a.baslangic.localeCompare(b.baslangic));
  let bitis = null;
  for (const m of araliklar) {
    if (bitis && m.baslangic <= bitis) d.sorun('mahsup_kayitlari', `${m.kayit_id}: mahsup dönemleri çakışıyor; aynı gün iki kez sayılamaz.`);
    if (!bitis || m.bitis > bitis) bitis = m.bitis;
  }
  return { vaka, sorunlar: d.sorunlar };
}
