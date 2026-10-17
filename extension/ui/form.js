// Form ↔ kanonik vaka eşlemesi ve form durumunun saklanması.
// Formdaki boş alan "bilinmiyor" (null) demektir; hiçbir boş alan "hayır" sayılmaz.

import { $ } from './yardimci.js';

// Karar dilindeki alan → kullanıcıya gösterilecek ad ve ilgili form denetimi.
export const ALAN_ETIKETLERI = {
  'ilam.kanun': ['Kanun', 'kanun'],
  'ilam.madde': ['Suç maddesi', 'madde'],
  'ilam.fikra': ['Fıkra', 'fikra'],
  'ilam.bent': ['Bent', 'bent'],
  'ilam.kitap': ['Suç maddesi', 'madde'],
  'ilam.kisim': ['Suç maddesi', 'madde'],
  'ilam.bolum': ['Suç maddesi', 'madde'],
  'ilam.suc_grubu': ['Suç maddesi', 'madde'],
  'ilam.cinsel_dokunulmazlik': ['Suç maddesi', 'madde'],
  'ilam.suc_tarihi': ['Suç tarihi', 'suc_tarihi'],
  'ilam.ceza_turu': ['Ceza türü', 'ceza_turu'],
  'ilam.para_cezasindan_cevrilme': ['Adli paradan çevrilme', 'ceza_turu'],
  'ilam.tekerrur': ['Hükümdeki tekerrür', 'hukumdeki_tekerrur'],
  'ilam.kast_turu': ['Kast türü', 'kast_turu'],
  'ilam.kast_grubu': ['Kast türü', 'kast_turu'],
  'ilam.teror': ['Terörle Mücadele K. kapsamı', 'teror_kanunu_kapsami'],
  'ilam.orgut_faaliyeti': ['Örgüt faaliyeti', 'orgut_faaliyeti'],
  'ilam.orgut_kurma_yonetme': ['Örgüt kurma/yönetme', 'orgut_kurma_yonetme'],
  'ilam.orgut_kurma_yonetme_uyelik': ['Örgüt üyeliği', 'orgut_uyelik'],
  'ilam.ozel_KS_yasagi_dogrulandi': ['Özel KS yasağı', 'ozel_ks_yasagi'],
  'ilam.KS_geri_alinmis_aynen_infaz': ['KS geri alınması', 'ks_geri_alindi'],
  'ilam.magdur_yakinlik': ['Mağdurla yakınlık', 'magdur_yakinlik'],
  'ilam.magdur_es': ['Mağdur eş mi', 'magdur_yakinlik'],
  'ilam.magdur_savunmasiz': ['Mağdurun savunmasızlığı', 'magdur_savunmasiz'],
  'ilam.deprem_yapi_olumu': ['Deprem/yapı bağlantılı ölüm', 'deprem_yapi_olumu_baglantisi'],
  'ilam.2937_ceza_kapsami_dogrulandi': ['2937 kapsamı', 'mit_2937_kapsami_dogrulandi'],
  'ilam.cocuk_hakkinda_adli_para_hukmu': ['Çocuk hakkında adli para', 'cocuk_hakkinda_adli_para_hukmu'],
  'kisi.suc_yasi': ['Doğum tarihi', 'dogum_tarihi'],
  'kisi.kadin_hukumlu': ['Cinsiyet', 'cinsiyet'],
  'kisi.0_6_yas_grubunda_cocugu_var': ['0-6 yaş çocuk', 'kadin_0_6_cocuk'],
  'kisi.105A_3_b_raporu_dogrulandi': ['105/A-3-b sağlık raporu', 'rapor_105A_3_b'],
  'infaz.iyi_hal': ['İyi hâl', 'iyi_hal'],
  'infaz.DS_talebi_var': ['DS talebi', 'ds_talebi'],
  'infaz.toplam_hapis_uc_takvim_yili_veya_az': ['Ceza miktarı', 'ceza_yil'],
  'infaz.toplam_hapis_bes_takvim_yili_veya_az': ['Ceza miktarı', 'ceza_yil'],
  'infaz.toplam_hapis_on_takvim_yilindan_az': ['Ceza miktarı', 'ceza_yil'],
};

const MAHSUP_ALANLARI = [
  ['mahsup_gozalti', 'gozalti'],
  ['mahsup_tutukluluk', 'tutukluluk'],
  ['mahsup_konut', 'konutu_terk_etmeme'],
  ['mahsup_diger', 'diger'],
];

export function sayi(deger) {
  const v = String(deger ?? '').trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

const uc = (v) => (v === 'evet' ? true : v === 'hayir' ? false : null);
const ucMetin = (v) => (v === true ? 'evet' : v === false ? 'hayir' : '');

function cezaOku(yil, ay, gun) {
  const p = [sayi(yil), sayi(ay), sayi(gun)];
  if (p.every((x) => x === null)) return null;
  // Geçersiz değerler motorun girdi denetimine bırakılır (sessizce düzeltilmez).
  return { yil: p[0] ?? 0, ay: p[1] ?? 0, gun: p[2] ?? 0 };
}

// "87/2-d" gibi tek alana yazılan madde/fıkra/bent ayrıştırılır.
export function maddeAyristir() {
  let madde = $('madde').value.trim();
  let fikra = $('fikra').value.trim();
  let bent = $('bent').value.trim();
  const m = /^(\d+(?:\/[a-zA-Z])?)\s*(?:\/\s*(\d+))?\s*(?:[-.]\s*([a-zçğıöşü]))?$/i.exec(madde);
  if (m) {
    madde = m[1].toUpperCase();
    if (!fikra && m[2]) fikra = m[2];
    if (!bent && m[3]) bent = m[3].toLowerCase();
  }
  return { madde: madde || null, fikra: fikra || null, bent: bent || null };
}

export function formAlanlari() {
  return [...document.querySelectorAll('[data-form] input[id], [data-form] select[id]')];
}

function oncekiOku() {
  return [...document.querySelectorAll('#oncekiListe .onceki')].map((kart, i) => {
    const d = (a) => kart.querySelector(`[data-a="${a}"]`);
    return {
      ilam_id: `Önceki-${i + 1}`,
      suc_tarihi: d('suc_tarihi').value || null,
      kesinlesme_tarihi: d('kesinlesme_tarihi').value || null,
      ceza_turu: d('ceza_turu').value,
      ceza: cezaOku(d('yil').value, d('ay').value, d('gun').value),
      kast_turu: d('kast_turu').value || null,
      infaz_durumu: d('infaz_durumu').value || null,
      infaz_tamamlanma_tarihi: d('infaz_tamamlanma_tarihi').value || null,
      tekerrur_uygulanmis_mi: uc(d('tekerrur_uygulanmis_mi').value),
      karar_turu: d('karar_turu').value || null,
      cmk_272_3_engeli: uc(d('cmk_272_3_engeli').value),
      yabanci_mahkeme_karari: uc(d('yabanci_mahkeme_karari').value),
      yabanci_istisna_sucu: uc(d('yabanci_istisna_sucu').value),
      sirf_askeri_suc: uc(d('sirf_askeri_suc').value),
      suclunun_o_tarihteki_yasi: Number.isInteger(sayi(d('suclunun_o_tarihteki_yasi').value)) ? sayi(d('suclunun_o_tarihteki_yasi').value) : null,
    };
  });
}

export function vakaOku() {
  const tur = $('ceza_turu').value;
  const kanunSecim = $('kanun').value;
  const kanun = kanunSecim === 'diger' ? sayi($('kanun_no').value) : Number(kanunSecim);
  const mahsupDolu = MAHSUP_ALANLARI.filter(([id]) => $(id).value.trim() !== '');
  const val = (id) => $(id).value || null;
  return {
    hesap_tarihi: val('hesap_tarihi'),
    infaza_baslama_tarihi: val('infaza_baslama_tarihi'),
    dogum_tarihi: val('dogum_tarihi'),
    cinsiyet: val('cinsiyet'),
    kadin_0_6_cocuk: uc($('kadin_0_6_cocuk').value),
    rapor_105A_3_b: uc($('rapor_105A_3_b').value),
    iyi_hal: uc($('iyi_hal').value),
    ds_talebi: uc($('ds_talebi').value),
    yuksek_guvenlik: $('yuksek_guvenlik').checked || null,
    mahsup_kayitlari: mahsupDolu.length ? mahsupDolu.map(([id, t]) => ({ tur: t, gun: sayi($(id).value) })).filter((m) => m.gun !== 0) : null,
    tekerrure_esas_en_agir_ceza: cezaOku($('esas_yil').value, $('esas_ay').value, $('esas_gun').value),
    onceki_mahkumiyet_kayitlari_tam_mi: $('kayit_tam').checked ? true : null,
    onceki_mahkumiyetler: oncekiOku(),
    profil: { gun_kusurati: $('profil_kusurat').value, kurum_ayi: $('profil_ay').value },
    cek: {
      m6_bedel_ve_faiz_tam_odendi_dogrulandi: uc($('cek_m6').value),
      vazgecme_gecerli_dogrulandi: uc($('cek_vazgecme').value),
      gecici5_uygulama_karari_dogrulandi: uc($('cek_gecici5').value),
      vadeli_taksit_aksama_sayisi: Number.isInteger(sayi($('cek_aksama').value)) ? sayi($('cek_aksama').value) : null,
      kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi: uc($('para_odendi').value),
    },
    suclar_ve_ilamlar: [
      {
        ilam_id: 'İlam-1',
        suc_tarihi: val('suc_tarihi'),
        hukumdeki_sonuc_ceza: cezaOku($('ceza_yil').value, $('ceza_ay').value, $('ceza_gun').value),
        kanun_madde_fikra_bent: { kanun: Number.isInteger(kanun) ? kanun : null, ...maddeAyristir() },
        kast_turu: val('kast_turu'),
        hukumdeki_ceza_turu: tur === 'adli_paradan_cevrilen_hapis' ? 'adli_para' : tur,
        infazdaki_ceza_turu: tur === 'adli_paradan_cevrilen_hapis' ? 'adli_paradan_cevrilen_hapis' : null,
        para_cezasindan_cevrilme: tur === 'adli_paradan_cevrilen_hapis' ? true : null,
        kesinlesme_tarihi: val('kesinlesme_tarihi'),
        hukumdeki_tekerrur: val('hukumdeki_tekerrur'),
        teror_kanunu_kapsami: uc($('teror_kanunu_kapsami').value),
        orgut_faaliyeti: uc($('orgut_faaliyeti').value),
        orgut_kurma_yonetme: uc($('orgut_kurma_yonetme').value),
        orgut_uyelik: uc($('orgut_uyelik').value),
        magdur_yakinlik: val('magdur_yakinlik'),
        magdur_savunmasiz: uc($('magdur_savunmasiz').value),
        deprem_yapi_olumu_baglantisi: uc($('deprem_yapi_olumu_baglantisi').value),
        ks_geri_alindi: uc($('ks_geri_alindi').value),
        ozel_ks_yasagi: uc($('ozel_ks_yasagi').value),
        cocuga_karsi_suc: uc($('cocuga_karsi_suc').value),
        mit_2937_kapsami_dogrulandi: uc($('mit_2937_kapsami_dogrulandi').value),
        cocuk_hakkinda_adli_para_hukmu: uc($('cocuk_hakkinda_adli_para_hukmu').value),
      },
    ],
  };
}

// Kayıtlı vaka dosyasını forma geri yükler (vakaOku'nun tersi).
export function vakadanForm(v, oncekiKartEkle) {
  const ilam = v.suclar_ve_ilamlar?.[0] || v.ilam || {};
  const mfb = ilam.kanun_madde_fikra_bent || {};
  const ata = (id, deger) => {
    const el = $(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!deger;
    else el.value = deger ?? '';
  };
  formAlanlari().forEach((el) => (el.type === 'checkbox' ? (el.checked = false) : el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '')));
  ata('suc_tarihi', ilam.suc_tarihi);
  ata('ceza_yil', ilam.hukumdeki_sonuc_ceza?.yil || '');
  ata('ceza_ay', ilam.hukumdeki_sonuc_ceza?.ay || '');
  ata('ceza_gun', ilam.hukumdeki_sonuc_ceza?.gun || '');
  ata('hukumdeki_tekerrur', ilam.hukumdeki_tekerrur);
  const bilinen = ['5237', '5941', '2937'];
  ata('kanun', mfb.kanun == null ? '5237' : bilinen.includes(String(mfb.kanun)) ? String(mfb.kanun) : 'diger');
  ata('kanun_no', bilinen.includes(String(mfb.kanun)) ? '' : mfb.kanun);
  ata('madde', mfb.madde);
  ata('fikra', mfb.fikra);
  ata('bent', mfb.bent);
  const cevrilmis = ilam.infazdaki_ceza_turu === 'adli_paradan_cevrilen_hapis' || ilam.para_cezasindan_cevrilme === true;
  ata('ceza_turu', cevrilmis ? 'adli_paradan_cevrilen_hapis' : ilam.hukumdeki_ceza_turu || ilam.ceza_turu || 'sureli_hapis');
  ata('kast_turu', ilam.kast_turu);
  for (const id of ['hesap_tarihi', 'infaza_baslama_tarihi', 'dogum_tarihi', 'cinsiyet']) ata(id, v[id]);
  ata('kesinlesme_tarihi', ilam.kesinlesme_tarihi);
  for (const id of ['kadin_0_6_cocuk', 'rapor_105A_3_b', 'iyi_hal', 'ds_talebi']) ata(id, ucMetin(v[id]));
  ata('yuksek_guvenlik', v.yuksek_guvenlik === true);
  for (const id of ['teror_kanunu_kapsami', 'orgut_faaliyeti', 'orgut_kurma_yonetme', 'orgut_uyelik', 'magdur_savunmasiz', 'deprem_yapi_olumu_baglantisi', 'ks_geri_alindi', 'ozel_ks_yasagi', 'cocuga_karsi_suc', 'mit_2937_kapsami_dogrulandi', 'cocuk_hakkinda_adli_para_hukmu']) ata(id, ucMetin(ilam[id]));
  ata('magdur_yakinlik', ilam.magdur_yakinlik);
  for (const [id, t] of MAHSUP_ALANLARI) {
    const k = (v.mahsup_kayitlari || []).filter((m) => m.tur === t).reduce((s, m) => s + (m.gun || 0), 0);
    ata(id, k || '');
  }
  ata('esas_yil', v.tekerrure_esas_en_agir_ceza?.yil || '');
  ata('esas_ay', v.tekerrure_esas_en_agir_ceza?.ay || '');
  ata('esas_gun', v.tekerrure_esas_en_agir_ceza?.gun || '');
  ata('kayit_tam', v.onceki_mahkumiyet_kayitlari_tam_mi === true);
  ata('profil_kusurat', v.profil?.gun_kusurati || 'asagi');
  ata('profil_ay', v.profil?.kurum_ayi || '30_gun');
  const c = v.cek || {};
  ata('cek_m6', ucMetin(c.m6_bedel_ve_faiz_tam_odendi_dogrulandi));
  ata('cek_vazgecme', ucMetin(c.vazgecme_gecerli_dogrulandi));
  ata('cek_gecici5', ucMetin(c.gecici5_uygulama_karari_dogrulandi));
  ata('cek_aksama', c.vadeli_taksit_aksama_sayisi ?? '');
  ata('para_odendi', ucMetin(c.kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi));
  $('oncekiListe').innerHTML = '';
  for (const o of v.onceki_mahkumiyetler || []) {
    oncekiKartEkle({
      ...o,
      yil: o.ceza?.yil || '',
      ay: o.ceza?.ay || '',
      gun: o.ceza?.gun || '',
      tekerrur_uygulanmis_mi: ucMetin(o.tekerrur_uygulanmis_mi),
      cmk_272_3_engeli: ucMetin(o.cmk_272_3_engeli),
      yabanci_mahkeme_karari: ucMetin(o.yabanci_mahkeme_karari) || 'hayir',
      yabanci_istisna_sucu: ucMetin(o.yabanci_istisna_sucu),
      sirf_askeri_suc: ucMetin(o.sirf_askeri_suc) || 'hayir',
    });
  }
}

export function formDurumu() {
  const alanlar = {};
  for (const el of formAlanlari()) alanlar[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  const onceki = [...document.querySelectorAll('#oncekiListe .onceki')].map((kart) => {
    const o = {};
    kart.querySelectorAll('[data-a]').forEach((el) => (o[el.dataset.a] = el.value));
    return o;
  });
  return { surum: 2, alanlar, onceki };
}

export function formuDoldur(durum, oncekiKartEkle) {
  if (!durum || durum.surum !== 2) return;
  for (const el of formAlanlari()) {
    if (!(el.id in durum.alanlar)) continue;
    if (el.type === 'checkbox') el.checked = !!durum.alanlar[el.id];
    else el.value = durum.alanlar[el.id];
  }
  $('oncekiListe').innerHTML = '';
  (durum.onceki || []).forEach((o) => oncekiKartEkle(o));
}

export function formuSifirla() {
  for (const el of formAlanlari()) {
    if (el.type === 'checkbox') el.checked = false;
    else if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  }
  $('oncekiListe').innerHTML = '';
}
