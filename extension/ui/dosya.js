// Hesap dosyası: avukatın sıralı sorulara verdiği cevaplar.
//
// Dosya düz bir nesnedir ve kalıcı olarak saklanır. Bu modül onu çekirdeğin kanonik
// vaka biçimine çevirir. DOM bilmez; Node'da test edilir.
//
// Cevaplanmamış alan null'dır. "Bilmiyorum" cevabı `bilinmiyor` listesine yazılır ve
// alan null kalır: çekirdek olağan dosya varsayımını ya da hükümlü aleyhine ihtiyat
// çözümünü uygular, sonuç ekranı bunu tek satırla bildirir.

export const DOSYA_SURUMU = 3;

// 5237 sayılı TCK ve 5275 sayılı Kanun'un yürürlüğü. Öncesindeki suçlar lehe kanun
// karşılaştırması gerektirir; araç bunları hesaplamaz.
export const KAPSAM_BASLANGICI = '2005-06-01';

export const SURELI_TURLER = ['sureli_hapis', 'adli_paradan_cevrilen_hapis'];

// 3713 m.3: bu TCK maddelerindeki suçlar terör suçudur (310'da yalnız 1. fıkra).
const TEROR_MADDELERI = new Set(['302', '307', '309', '310', '311', '312', '313', '314', '315', '320']);
// Örgüt kurma/yönetme (1. fıkra) veya üyelik (diğer fıkralar). Üyelik tek başına
// "örgüt faaliyeti çerçevesinde" sayılmaz (R023: yalnız üyelik adıyla eşitleme yok).
export const ORGUT_MADDELERI = new Set(['220', '314']);
// Suç tanımında taksir bulunan TCK maddeleri.
const TAKSIRLI_MADDELER = new Set(['85', '89', '171', '180', '182']);

export function bosDosya() {
  return {
    surum: DOSYA_SURUMU,
    konum: null, // 'cezaevinde' | 'girmedi' | 'varsayimsal'
    suc_tarihi: null,
    ceza_turu: 'sureli_hapis',
    ceza: null, // { yil, ay, gun }
    suc: null, // { kanun, madde, fikra, bent }
    // null: maddeden otomatik; true/false: avukatın seçimi. orgut: "örgüt faaliyeti çerçevesinde".
    ozel: { teror: null, orgut: null, taksir: null },
    tekerrur: null, // 'yok' | 'birinci' | 'ikinci'
    esas_ceza: null, // 108/2: tekerrüre esas en ağır önceki ceza
    giris: null, // { tur: 'bugun' } | { tur: 'tarih', tarih }
    mahsup: null, // [{ tur, gun } | { tur, baslangic, bitis }]; [] = yok
    ek: {}, // sonuca göre sorulan ek sorular
    muddetname: {}, // karşılaştırma için müddetnamedeki tarihler: { acik, cikis, ks, bitis }
    bilinmiyor: [],
  };
}

// Kayıtlı (veya eski sürüm) dosyayı güvenle yükler; bilinmeyen alanlar atılır.
export function dosyaYukle(kayit) {
  const d = bosDosya();
  if (!kayit || kayit.surum !== DOSYA_SURUMU) return d;
  for (const k of Object.keys(d)) if (k in kayit && k !== 'surum') d[k] = kayit[k];
  d.ozel = { ...bosDosya().ozel, ...(kayit.ozel || {}) };
  d.ek = { ...(kayit.ek || {}) };
  d.muddetname = { ...(kayit.muddetname || {}) };
  d.mahsup = mahsupYukle(kayit.mahsup);
  d.bilinmiyor = Array.isArray(kayit.bilinmiyor) ? [...kayit.bilinmiyor] : [];
  return d;
}

export const klonla = (d) => structuredClone(d);

// Mahsup ve önceki infaz kayıt türleri (çekirdekteki MAHSUP_TURLERI'nin arayüzde sorulanları).
export const MAHSUP_TURLERI = [
  ['gozalti', 'Gözaltı'],
  ['tutukluluk', 'Tutukluluk'],
  ['konutu_terk_etmeme', 'Konutu terk etmeme (2 gün = 1 gün)'],
  ['denetimli_serbestlik', 'Kullanılan denetimli serbestlik'],
];

// Faz 1 biçimi { gozalti, tutukluluk } kayıt listesine çevrilir.
export function mahsupYukle(m) {
  if (m === null || m === undefined) return null;
  if (Array.isArray(m)) return m.filter((k) => k && MAHSUP_TURLERI.some(([t]) => t === k.tur)).map((k) => ({ ...k }));
  const liste = [];
  if (m.gozalti > 0) liste.push({ tur: 'gozalti', gun: m.gozalti });
  if (m.tutukluluk > 0) liste.push({ tur: 'tutukluluk', gun: m.tutukluluk });
  return liste;
}

// Kaydın takvim günü (aralıkta başlangıç ve bitiş dahil) ve cezadan düşülen gün.
export function mahsupGunu(k) {
  const takvimGunu = k.gun > 0 ? k.gun : k.baslangic && k.bitis && k.bitis >= k.baslangic ? gunSay(k.baslangic, k.bitis) + 1 : 0;
  return { takvim: takvimGunu, dusulen: k.tur === 'konutu_terk_etmeme' ? Math.floor(takvimGunu / 2) : takvimGunu };
}
const gunSay = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const mahsupToplami = (liste) => (mahsupYukle(liste) || []).reduce((t, k) => t + mahsupGunu(k).dusulen, 0);

export const bilinmiyorMu = (d, id) => d.bilinmiyor.includes(id);

export function bilinmiyorYap(d, id, evet = true) {
  d.bilinmiyor = d.bilinmiyor.filter((x) => x !== id);
  if (evet) d.bilinmiyor.push(id);
}

export const kapsamDisi = (d) => !!d.suc_tarihi && d.suc_tarihi < KAPSAM_BASLANGICI;

export const cezaVar = (c) => !!c && (c.yil > 0 || c.ay > 0 || c.gun > 0);

export function hesaplanabilir(d) {
  if (!d.suc_tarihi || kapsamDisi(d)) return false;
  return SURELI_TURLER.includes(d.ceza_turu) ? cezaVar(d.ceza) : !!d.ceza_turu;
}

// Maddeden türeyen özel durumlar; avukatın açık seçimi her zaman önce gelir.
export function ozelDurum(d) {
  const tck = d.suc?.kanun === 5237 ? d.suc.madde : null;
  return {
    teror: d.ozel.teror ?? (tck ? TEROR_MADDELERI.has(tck) && (tck !== '310' || !d.suc.fikra || d.suc.fikra === '1') : false),
    orgut: d.ozel.orgut ?? false,
    taksir: d.ozel.taksir ?? (tck ? TAKSIRLI_MADDELER.has(tck) : false),
  };
}

export function girisTarihi(d, bugun) {
  return d.giris?.tur === 'tarih' && d.giris.tarih ? d.giris.tarih : bugun;
}

// Dosya → kanonik vaka (docs/MIMARI.md). İyi hâl ve DS talebi açıkça var sayılır:
// sonuç ekranı tarihleri "iyi hâl şartıyla" verir. Talepsiz hâl ayrıca hesaplanır.
export function vakaKur(d, bugun, { dsTalebi = true } = {}) {
  const ozel = ozelDurum(d);
  const tck = d.suc?.kanun === 5237 ? d.suc.madde : null;
  // 220/314: 1. fıkra kurma/yönetme, diğerleri üyelik; fıkra bilinmiyorsa en az üyelik vardır.
  const orgutMaddesi = !!tck && ORGUT_MADDELERI.has(tck);
  const orgutKurma = orgutMaddesi ? (d.suc.fikra ? d.suc.fikra === '1' : null) : false;
  const orgutUyelik = orgutMaddesi ? (d.suc.fikra ? d.suc.fikra !== '1' : true) : false;
  const cevrilmis = d.ceza_turu === 'adli_paradan_cevrilen_hapis';
  const ek = d.ek;
  // Çekirdek aralıkları kendisi sayar, çakışmayı denetler ve konutu terk etmemede 2:1 uygular.
  const mahsup = (mahsupYukle(d.mahsup) || [])
    .filter((k) => mahsupGunu(k).takvim > 0)
    .map((k, i) => (k.gun > 0 ? { kayit_id: `M${i + 1}`, tur: k.tur, gun: k.gun } : { kayit_id: `M${i + 1}`, tur: k.tur, baslangic: k.baslangic, bitis: k.bitis }));
  const kadinCocuk = ek.kadin_cocuk === true ? true : ek.kadin_cocuk === false ? false : null;

  return {
    hesap_tarihi: bugun,
    infaza_baslama_tarihi: girisTarihi(d, bugun),
    dogum_tarihi: ek.dogum_tarihi || null,
    cinsiyet: kadinCocuk ? 'kadin' : null,
    kadin_0_6_cocuk: kadinCocuk,
    rapor_105A_3_b: typeof ek.rapor === 'boolean' ? ek.rapor : null,
    iyi_hal: true,
    ds_talebi: dsTalebi,
    mahsup_kayitlari: mahsup,
    tekerrure_esas_en_agir_ceza: d.tekerrur === 'birinci' && cezaVar(d.esas_ceza) ? d.esas_ceza : null,
    onceki_mahkumiyetler: [],
    suclar_ve_ilamlar: [
      {
        ilam_id: 'İlam-1',
        suc_tarihi: d.suc_tarihi,
        hukumdeki_sonuc_ceza: SURELI_TURLER.includes(d.ceza_turu) && cezaVar(d.ceza) ? d.ceza : null,
        kanun_madde_fikra_bent: d.suc
          ? { kanun: d.suc.kanun ?? null, madde: d.suc.madde || null, fikra: d.suc.fikra || null, bent: d.suc.bent || null }
          : { kanun: null, madde: null, fikra: null, bent: null },
        kast_turu: ozel.taksir ? 'taksir' : 'kasit',
        hukumdeki_ceza_turu: cevrilmis ? 'adli_para' : d.ceza_turu,
        infazdaki_ceza_turu: cevrilmis ? 'adli_paradan_cevrilen_hapis' : null,
        para_cezasindan_cevrilme: cevrilmis,
        hukumdeki_tekerrur: d.tekerrur,
        teror_kanunu_kapsami: ozel.teror,
        orgut_faaliyeti: ozel.orgut,
        orgut_kurma_yonetme: orgutKurma,
        orgut_uyelik: orgutUyelik,
        magdur_yakinlik: ek.magdur_yakinlik || null,
        magdur_savunmasiz: typeof ek.magdur_savunmasiz === 'boolean' ? ek.magdur_savunmasiz : null,
        deprem_yapi_olumu_baglantisi: typeof ek.deprem === 'boolean' ? ek.deprem : null,
        mit_2937_kapsami_dogrulandi: typeof ek.mit_2937 === 'boolean' ? ek.mit_2937 : null,
        ks_geri_alindi: false,
        ozel_ks_yasagi: false,
      },
    ],
  };
}
