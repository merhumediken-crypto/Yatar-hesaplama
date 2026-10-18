// Hesap dosyası: avukatın sıralı sorulara verdiği cevaplar ve belgeden okunanlar.
//
// Dosya düz bir nesnedir ve kalıcı olarak saklanır. Bu modül onu çekirdeğin kanonik
// vaka biçimine çevirir. DOM bilmez; Node'da test edilir.
//
// Sürüm 4 yapısı:
//   dosya  = { konum, giris, ek (yaş, doğum, kişisel durum), muddetname, bilinmiyor,
//              belge (okunan belgenin özeti), ilamlar: [ilam, …] }
//   ilam   = { suc_tarihi, ceza_turu, ceza, suc, ozel, tekerrur, esas_ceza, mahsup,
//              ek (ilama özgü ek cevaplar), bilinmiyor, meta (mahkeme, esas/karar, belge kaynağı) }
// Tek ilamlı hesap, tek elemanlı ilam listesidir. Birden çok ilamda çekirdek toplama
// hesabını (5275 m.99) yapar.
//
// İlam görünümü (ilamGorunumu): dosya düzeyi alanlar ile bir ilamın alanlarını tek bir
// nesne gibi gösterir. Soru ve özet modülleri "d.suc_tarihi", "d.konum", "d.ek.yas" gibi
// düz okumalar yapar; görünüm her alanı doğru yere yönlendirir. Böylece aynı soru
// tanımı her ilam için ayrı ayrı çalışır.
//
// Cevaplanmamış alan null'dır. "Bilmiyorum" cevabı `bilinmiyor` listesine yazılır ve
// alan null kalır: çekirdek olağan dosya varsayımını ya da hükümlü aleyhine ihtiyat
// çözümünü uygular, sonuç ekranı bunu tek satırla bildirir.

import { takvim as T } from '../cekirdek/index.js';

export const DOSYA_SURUMU = 4;

// 5237 sayılı TCK ve 5275 sayılı Kanun'un yürürlüğü. Öncesindeki suçlar lehe kanun
// karşılaştırması gerektirir; araç bunları hesaplamaz.
export const KAPSAM_BASLANGICI = '2005-06-01';

export const SURELI_TURLER = ['sureli_hapis', 'adli_paradan_cevrilen_hapis'];
const CEZA_TURLERI = [...SURELI_TURLER, 'muebbet', 'agirlastirilmis_muebbet'];

// 3713 m.3: bu TCK maddelerindeki suçlar terör suçudur (310'da yalnız 1. fıkra).
const TEROR_MADDELERI = new Set(['302', '307', '309', '310', '311', '312', '313', '314', '315', '320']);
// Örgüt kurma/yönetme (1. fıkra) veya üyelik (diğer fıkralar). Üyelik tek başına
// "örgüt faaliyeti çerçevesinde" sayılmaz (R023: yalnız üyelik adıyla eşitleme yok).
export const ORGUT_MADDELERI = new Set(['220', '314']);
// Suç tanımında taksir bulunan TCK maddeleri.
const TAKSIRLI_MADDELER = new Set(['85', '89', '171', '180', '182']);

// İlama ait alanlar ve sorular; geri kalanı dosya düzeyindedir.
export const ILAM_ALANLARI = ['suc_tarihi', 'ceza_turu', 'ceza', 'suc', 'ozel', 'tekerrur', 'esas_ceza', 'mahsup', 'meta'];
const ILAM_EK = ['fikra_cevaplandi', 'magdur_yakinlik', 'magdur_savunmasiz', 'deprem', 'mit_2937'];
export const ILAM_SORULARI = new Set(['suc_tarihi', 'ceza', 'suc', 'fikra', 'tekerrur', 'esas_ceza', 'mahsup', 'magdur_yakinlik', 'magdur_savunmasiz', 'deprem', 'mit_2937']);
const DOSYA_SORULARI = new Set(['giris', 'yas', 'dogum_tarihi', 'kadin_cocuk', 'rapor']);

export function bosIlam(meta = {}) {
  return {
    suc_tarihi: null,
    ceza_turu: 'sureli_hapis',
    ceza: null, // { yil, ay, gun }
    suc: null, // { kanun, madde, fikra, bent }
    // null: maddeden otomatik; true/false: avukatın seçimi. orgut: "örgüt faaliyeti çerçevesinde".
    ozel: { teror: null, orgut: null, taksir: null },
    tekerrur: null, // 'yok' | 'birinci' | 'ikinci'
    esas_ceza: null, // 108/2: tekerrüre esas en ağır önceki ceza
    mahsup: null, // [{ tur, gun } | { tur, baslangic, bitis }]; [] = yok
    ek: {},
    bilinmiyor: [],
    // { etiket, mahkeme, esas_no, karar_no, karar_tarihi, infaz_no, suc_adi, madde_onerileri, kaynak }
    meta: { ...meta },
  };
}

export function bosDosya() {
  return {
    surum: DOSYA_SURUMU,
    konum: null, // 'cezaevinde' | 'girmedi' | 'varsayimsal'
    giris: null, // { tur: 'bugun' } | { tur: 'tarih', tarih }
    ek: {}, // yaş, doğum tarihi, 0-6 yaş çocuklu kadın, sağlık raporu
    muddetname: {}, // karşılaştırma için müddetnamedeki tarihler: { acik, cikis, ks, bitis }
    bilinmiyor: [],
    belge: null, // okunan belgenin özeti (tür, karar, kişi adı, toplam ceza)
    ilamlar: [bosIlam()],
  };
}

// ---------------------------------------------------------------------------
// İlam görünümü
// ---------------------------------------------------------------------------

const KAYNAK = Symbol('dosya');

export function ilamGorunumu(d, i) {
  const il = () => d.ilamlar[i];
  const ekHedef = (k) => (ILAM_EK.includes(k) ? il().ek : d.ek);
  const ek = new Proxy(
    {},
    {
      get: (_, k) => ekHedef(k)[k],
      set: (_, k, v) => {
        ekHedef(k)[k] = v;
        return true;
      },
      deleteProperty: (_, k) => delete ekHedef(k)[k],
      has: (_, k) => k in ekHedef(k),
      ownKeys: () => [...new Set([...Reflect.ownKeys(d.ek), ...Reflect.ownKeys(il().ek)])],
      getOwnPropertyDescriptor: (_, k) => (k in ekHedef(k) ? { value: ekHedef(k)[k], enumerable: true, configurable: true, writable: true } : undefined),
    },
  );
  return new Proxy(
    {},
    {
      get(_, k) {
        if (k === KAYNAK) return { d, i };
        if (k === 'ek') return ek;
        if (k === 'bilinmiyor') return [...d.bilinmiyor, ...il().bilinmiyor];
        return ILAM_ALANLARI.includes(k) ? il()[k] : d[k];
      },
      set(_, k, v) {
        if (k === 'bilinmiyor') {
          il().bilinmiyor = v.filter((x) => ILAM_SORULARI.has(x));
          d.bilinmiyor = v.filter((x) => !ILAM_SORULARI.has(x));
        } else if (ILAM_ALANLARI.includes(k)) il()[k] = v;
        else d[k] = v;
        return true;
      },
      has: (_, k) => (ILAM_ALANLARI.includes(k) ? k in il() : k in d),
    },
  );
}

// Görünümün arkasındaki tam dosya (düz dosya verilirse kendisi).
export const tamDosya = (x) => x?.[KAYNAK]?.d ?? x;
export const gorunumIlami = (x) => x?.[KAYNAK]?.i ?? 0;
export const anaGorunum = (x) => (x?.[KAYNAK] ? x : ilamGorunumu(x, 0));
export const cokluMu = (x) => tamDosya(x).ilamlar.length > 1;

export function klonla(x) {
  const k = x?.[KAYNAK];
  return k ? ilamGorunumu(structuredClone(k.d), k.i) : structuredClone(x);
}

export function ilamEkle(d, meta = {}) {
  d.ilamlar.push(bosIlam(meta));
  return d.ilamlar.length - 1;
}

export function ilamSil(d, i) {
  if (d.ilamlar.length <= 1) return;
  d.ilamlar.splice(i, 1);
}

// İlamın kısa adı: belgeden okunan etiket ("Diyarbakır 12. Asliye Ceza 2017/157 E.") ya da sıra.
// Aynı hükümden birden çok ceza aynı etiketi taşır; metinlerde ayırt edilsin diye sıra eklenir.
export function ilamAdi(d, i) {
  const etiket = d.ilamlar[i]?.meta?.etiket;
  if (!etiket) return `${i + 1}. ilam`;
  return d.ilamlar.some((il, j) => j !== i && il.meta?.etiket === etiket) ? `${etiket} (${i + 1}. ilam)` : etiket;
}

// Sıralı listelerde (ilam dökümü, gerekçe) ad: sıra başta; ayırt etmek için eklenen sıra tekrarlanmaz.
export function siraliIlamAdi(sira, ad) {
  if (/^\d+\. ilam$/.test(ad)) return ad;
  return `${sira}. ${ad.replace(new RegExp(` \\(${sira}\\. ilam\\)$`), '')}`;
}

// ---------------------------------------------------------------------------
// Yükleme ve göç
// ---------------------------------------------------------------------------

const tarihVeya = (t) => (T.gecerliTarih(t) ? t : null);
const cezaKopya = (c) => (cezaVar(c) ? { yil: c.yil || 0, ay: c.ay || 0, gun: c.gun || 0 } : null);

function sucYukle(s) {
  if (!(s && Number.isSafeInteger(s.kanun) && s.kanun > 0 && typeof s.madde === 'string' && /^\d+(?:\/[A-Z])?$/.test(s.madde))) return null;
  return {
    kanun: s.kanun,
    madde: s.madde.replace(/^0+(?=\d)/, ''),
    fikra: typeof s.fikra === 'string' && /^\d+$/.test(s.fikra) ? s.fikra : null,
    bent: typeof s.bent === 'string' && /^[a-zçğıöşü]$/i.test(s.bent) ? s.bent.toLocaleLowerCase('tr') : null,
  };
}

const METIN_META = ['etiket', 'mahkeme', 'esas_no', 'karar_no', 'infaz_no', 'suc_adi', 'kaynak', 'belge_turu'];

// Bir ilam kaydı (sürüm 4 ilamı veya sürüm 3 dosyasının ilam alanları) güvenle okunur.
function ilamYukle(k = {}) {
  const il = bosIlam();
  il.suc_tarihi = tarihVeya(k.suc_tarihi);
  if (CEZA_TURLERI.includes(k.ceza_turu)) il.ceza_turu = k.ceza_turu;
  il.ceza = cezaKopya(k.ceza);
  il.esas_ceza = cezaKopya(k.esas_ceza);
  il.suc = sucYukle(k.suc);
  for (const o of Object.keys(il.ozel)) if (typeof k.ozel?.[o] === 'boolean') il.ozel[o] = k.ozel[o];
  if (['yok', 'birinci', 'ikinci'].includes(k.tekerrur)) il.tekerrur = k.tekerrur;
  il.mahsup = mahsupYukle(k.mahsup);
  const ek = k.ek || {};
  for (const e of ['fikra_cevaplandi', 'magdur_savunmasiz', 'deprem', 'mit_2937']) if (typeof ek[e] === 'boolean') il.ek[e] = ek[e];
  if (['es', 'ustsoy', 'altsoy', 'kardes', 'diger'].includes(ek.magdur_yakinlik)) il.ek.magdur_yakinlik = ek.magdur_yakinlik;
  il.bilinmiyor = Array.isArray(k.bilinmiyor) ? [...new Set(k.bilinmiyor.filter((id) => ILAM_SORULARI.has(id)))] : [];
  const m = k.meta || {};
  for (const a of METIN_META) if (typeof m[a] === 'string' && m[a].length <= 400) il.meta[a] = m[a];
  if (T.gecerliTarih(m.karar_tarihi)) il.meta.karar_tarihi = m.karar_tarihi;
  if (Array.isArray(m.madde_onerileri)) il.meta.madde_onerileri = m.madde_onerileri.map(sucYukle).filter(Boolean).slice(0, 6);
  return il;
}

function dosyaAlanlari(d, kayit) {
  if (['cezaevinde', 'girmedi', 'varsayimsal'].includes(kayit.konum)) d.konum = kayit.konum;
  if (kayit.giris?.tur === 'tarih' && T.gecerliTarih(kayit.giris.tarih)) d.giris = { tur: 'tarih', tarih: kayit.giris.tarih };
  else if (kayit.giris?.tur === 'bugun' && d.konum !== 'cezaevinde') d.giris = { tur: 'bugun' };
  for (const id of ['acik', 'cikis', 'ks', 'bitis']) if (T.gecerliTarih(kayit.muddetname?.[id])) d.muddetname[id] = kayit.muddetname[id];
  const ek = kayit.ek || {};
  if (['yetiskin', 'cocuk', 'yasli'].includes(ek.yas)) d.ek.yas = ek.yas;
  if (T.gecerliTarih(ek.dogum_tarihi)) d.ek.dogum_tarihi = ek.dogum_tarihi;
  for (const e of ['kadin_cocuk', 'rapor']) if (typeof ek[e] === 'boolean') d.ek[e] = ek[e];
  d.bilinmiyor = Array.isArray(kayit.bilinmiyor) ? [...new Set(kayit.bilinmiyor.filter((id) => DOSYA_SORULARI.has(id)))] : [];
  const b = kayit.belge;
  if (b && typeof b === 'object' && typeof b.tur === 'string') {
    d.belge = { tur: b.tur, tur_adi: String(b.tur_adi || ''), karar: b.karar && typeof b.karar === 'object' ? { ...b.karar } : null, kisi_ad: typeof b.kisi_ad === 'string' ? b.kisi_ad : null, toplam: cezaKopya(b.toplam), uyusuyor: typeof b.uyusuyor === 'boolean' ? b.uyusuyor : null };
  }
}

// Kayıtlı dosyayı güvenle yükler; bilinmeyen alanlar atılır. Sürüm 3 (tek ilam, düz alanlar)
// sürüm 4'e çevrilir: ilam alanları ilk ilama, ilama özgü ek cevaplar ilamın ek'ine taşınır.
export function dosyaYukle(kayit) {
  const d = bosDosya();
  if (!kayit || typeof kayit !== 'object') return d;
  if (kayit.surum === 3) {
    dosyaAlanlari(d, kayit);
    const bil = Array.isArray(kayit.bilinmiyor) ? kayit.bilinmiyor : [];
    d.ilamlar = [ilamYukle({ ...kayit, bilinmiyor: bil })];
    return d;
  }
  if (kayit.surum !== DOSYA_SURUMU || !Array.isArray(kayit.ilamlar) || !kayit.ilamlar.length) return d;
  dosyaAlanlari(d, kayit);
  d.ilamlar = kayit.ilamlar.slice(0, 40).map(ilamYukle);
  return d;
}

// ---------------------------------------------------------------------------
// Mahsup
// ---------------------------------------------------------------------------

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
  if (!Array.isArray(m)) {
    if (typeof m !== 'object' || !['gozalti', 'tutukluluk'].some((k) => Object.hasOwn(m, k))) return null;
    if (!['gozalti', 'tutukluluk'].every((k) => m[k] == null || (Number.isSafeInteger(m[k]) && m[k] >= 0))) return null;
    return ['gozalti', 'tutukluluk'].filter((k) => m[k] > 0).map((k) => ({ tur: k, gun: m[k] }));
  }
  const sonuc = [];
  for (const k of m) {
    if (!k || !MAHSUP_TURLERI.some(([t]) => t === k.tur)) return null;
    if (Number.isSafeInteger(k.gun) && k.gun > 0) sonuc.push({ tur: k.tur, gun: k.gun });
    else if (k.gun != null && k.gun !== 0) return null;
    else if (T.gecerliTarih(k.baslangic) && T.gecerliTarih(k.bitis) && k.bitis >= k.baslangic) sonuc.push({ tur: k.tur, baslangic: k.baslangic, bitis: k.bitis });
    else if (k.gun !== 0 || k.baslangic || k.bitis) return null;
  }
  return sonuc;
}

// Kaydın takvim günü (aralıkta başlangıç ve bitiş dahil) ve cezadan düşülen gün.
export function mahsupGunu(k) {
  const takvimGunu = k.gun > 0 ? k.gun : k.baslangic && k.bitis && k.bitis >= k.baslangic ? gunSay(k.baslangic, k.bitis) + 1 : 0;
  return { takvim: takvimGunu, dusulen: k.tur === 'konutu_terk_etmeme' ? takvimGunu / 2 : takvimGunu };
}
const gunSay = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const mahsupToplami = (liste) => Math.floor((mahsupYukle(liste) || []).reduce((t, k) => t + mahsupGunu(k).dusulen, 0));

// ---------------------------------------------------------------------------
// Durum sorguları
// ---------------------------------------------------------------------------

export const bilinmiyorMu = (d, id) => d.bilinmiyor.includes(id);

// Liste her zaman yeniden atanır: görünümde `bilinmiyor` birleşik bir kopyadır, yerinde
// değiştirmek (push) kalıcı olmaz.
export function bilinmiyorYap(d, id, evet = true) {
  d.bilinmiyor = [...d.bilinmiyor.filter((x) => x !== id), ...(evet ? [id] : [])];
}

export const kapsamDisi = (x) => tamDosya(x).ilamlar.some((il) => !!il.suc_tarihi && il.suc_tarihi < KAPSAM_BASLANGICI);

export const cezaVar = (c) => !!c && typeof c === 'object' && !Array.isArray(c) && ['yil', 'ay', 'gun'].every((k) => c[k] == null || (Number.isSafeInteger(c[k]) && c[k] >= 0)) && (c.yil > 0 || c.ay > 0 || c.gun > 0);

const ilamHazir = (il) => !!il.suc_tarihi && (SURELI_TURLER.includes(il.ceza_turu) ? cezaVar(il.ceza) : !!il.ceza_turu);

export function hesaplanabilir(x) {
  const d = tamDosya(x);
  return !kapsamDisi(d) && d.ilamlar.every(ilamHazir);
}

// Maddeden türeyen özel durumlar; avukatın açık seçimi her zaman önce gelir.
export function ozelDurum(g) {
  const tck = g.suc?.kanun === 5237 ? g.suc.madde : null;
  return {
    teror: g.ozel.teror ?? (tck ? TEROR_MADDELERI.has(tck) && (tck !== '310' || !g.suc.fikra || g.suc.fikra === '1') : false),
    orgut: g.ozel.orgut ?? false,
    taksir: g.ozel.taksir ?? (tck ? TAKSIRLI_MADDELER.has(tck) : false),
  };
}

export function girisTarihi(d, bugun) {
  return d.giris?.tur === 'tarih' && d.giris.tarih ? d.giris.tarih : bugun;
}

// ---------------------------------------------------------------------------
// Dosya → kanonik vaka
// ---------------------------------------------------------------------------

// Bir ilam görünümünden çekirdeğin ilam kaydı.
function ilamVakasi(g, i, coklu, ad) {
  const ozel = ozelDurum(g);
  const tck = g.suc?.kanun === 5237 ? g.suc.madde : null;
  // 220/314: 1. fıkra kurma/yönetme, diğerleri üyelik; fıkra bilinmiyorsa en az üyelik vardır.
  const orgutMaddesi = !!tck && ORGUT_MADDELERI.has(tck);
  const orgutKurma = orgutMaddesi ? (g.suc.fikra ? g.suc.fikra === '1' : null) : false;
  const orgutUyelik = orgutMaddesi ? (g.suc.fikra ? g.suc.fikra !== '1' : true) : false;
  const cevrilmis = g.ceza_turu === 'adli_paradan_cevrilen_hapis';
  const ek = g.ek;
  return {
    ilam_id: coklu ? `I${i + 1}` : 'İlam-1',
    ...(coklu ? { etiket: ad } : {}),
    karar_tarihi: g.meta?.karar_tarihi || null,
    suc_tarihi: g.suc_tarihi,
    hukumdeki_sonuc_ceza: SURELI_TURLER.includes(g.ceza_turu) && cezaVar(g.ceza) ? g.ceza : null,
    kanun_madde_fikra_bent: g.suc
      ? { kanun: g.suc.kanun ?? null, madde: g.suc.madde || null, fikra: g.suc.fikra || null, bent: g.suc.bent || null }
      : { kanun: null, madde: null, fikra: null, bent: null },
    kast_turu: ozel.taksir ? 'taksir' : 'kasit',
    hukumdeki_ceza_turu: cevrilmis ? 'adli_para' : g.ceza_turu,
    infazdaki_ceza_turu: cevrilmis ? 'adli_paradan_cevrilen_hapis' : null,
    para_cezasindan_cevrilme: cevrilmis,
    hukumdeki_tekerrur: g.tekerrur,
    tekerrure_esas_en_agir_ceza: g.tekerrur === 'birinci' && cezaVar(g.esas_ceza) ? g.esas_ceza : null,
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
  };
}

// Dosya (veya görünüm) → kanonik vaka (docs/MIMARI.md). İyi hâl ve DS talebi açıkça var
// sayılır: sonuç ekranı tarihleri "iyi hâl şartıyla" verir. Talepsiz hâl ayrıca hesaplanır.
// Bütün ilamların mahsup kayıtları toplam cezadan düşülür (aralık çakışması çekirdekte denetlenir).
export function vakaKur(x, bugun, { dsTalebi = true } = {}) {
  const d = tamDosya(x);
  const coklu = d.ilamlar.length > 1;
  const gorunumler = d.ilamlar.map((_, i) => ilamGorunumu(d, i));
  const mahsup = gorunumler
    .flatMap((g) => mahsupYukle(g.mahsup) || [])
    .filter((k) => mahsupGunu(k).takvim > 0)
    .map((k, n) => (k.gun > 0 ? { kayit_id: `M${n + 1}`, tur: k.tur, gun: k.gun } : { kayit_id: `M${n + 1}`, tur: k.tur, baslangic: k.baslangic, bitis: k.bitis }));
  const ek = d.ek;
  const kadinCocuk = ek.kadin_cocuk === true ? true : ek.kadin_cocuk === false ? false : null;
  const ilk = gorunumler[0];
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
    tekerrure_esas_en_agir_ceza: !coklu && ilk.tekerrur === 'birinci' && cezaVar(ilk.esas_ceza) ? ilk.esas_ceza : null,
    onceki_mahkumiyetler: [],
    suclar_ve_ilamlar: gorunumler.map((g, i) => ilamVakasi(g, i, coklu, ilamAdi(d, i))),
  };
}
