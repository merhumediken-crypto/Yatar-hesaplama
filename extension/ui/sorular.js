// Sıralı sorular.
//
// Temel sorular her dosyada sırayla sorulur. Ek sorular yalnız sonucu değiştirdiğinde
// sorulur: çekirdeğin "belgeli bağlamda belirsiz" dediği alanlar için her cevap
// seçeneği ayrı hesaplanır, kapalı/açık/çıkış/KS tarihlerinden biri değişiyorsa soru
// gösterilir. Bu modül DOM bilmez; Node'da test edilir.

import { hesapla, takvim as T } from '../cekirdek/index.js';
import { bilinmiyorMu, bilinmiyorYap, cezaVar, hesaplanabilir, kapsamDisi, klonla, vakaKur, ORGUT_MADDELERI, SURELI_TURLER } from './dosya.js';
import { maddeEtiketi, sucAdi } from './tck-maddeleri.js';

const tr = (s) => (s ? T.trTarih(s) : '');
const evetHayir = [
  { deger: true, etiket: 'Evet' },
  { deger: false, etiket: 'Hayır' },
];
const ekCevap = (id) => (d) => d.ek[id] !== undefined && d.ek[id] !== null;

// Soru alanları:
//   id, tur ('secim' | 'tarih' | 'ceza' | 'suc' | 'giris' | 'mahsup' | 'fikra')
//   baslik, aciklama(d)
//   secenekler(d)       secim türünde [{ deger, etiket, aciklama? }]
//   gorunur(d)          bu dosyada sorulur mu
//   cevaplandi(d)       cevap ya da "bilmiyorum" var mı
//   ata(d, deger)       cevabı dosyaya yazar (dosyayı değiştirir)
//   ozet(d)             dosya özetinde gösterilen kısa metin
//   bilinmiyor          "Bilmiyorum" düğmesi; metin varsayım satırıdır
//   alanlar, denemeler  ek sorular: ilgili karar alanları ve sınanacak cevaplar

export const TEMEL_SORULAR = [
  {
    id: 'konum',
    tur: 'secim',
    baslik: 'Kişi şu an nerede?',
    aciklama: () => 'Takvim buna göre kurulur.',
    secenekler: () => [
      { deger: 'cezaevinde', etiket: 'Cezaevinde', aciklama: 'Giriş tarihi belli' },
      { deger: 'girmedi', etiket: 'Hüküm var, henüz girmedi', aciklama: 'Girdiği gün başlar' },
      { deger: 'varsayimsal', etiket: 'Henüz ceza almadı', aciklama: '"Şu kadar alırsa" hesabı' },
    ],
    gorunur: () => true,
    cevaplandi: (d) => !!d.konum,
    ata: (d, v) => {
      d.konum = v;
    },
    ozet: (d) => ({ cezaevinde: 'Cezaevinde', girmedi: 'Henüz girmedi', varsayimsal: 'Varsayımsal hesap' })[d.konum],
  },
  {
    id: 'suc_tarihi',
    tur: 'tarih',
    baslik: 'Suç tarihi',
    aciklama: () => 'Hangi infaz kurallarının uygulanacağını suç tarihi belirler.',
    gorunur: () => true,
    cevaplandi: (d) => !!d.suc_tarihi,
    ata: (d, v) => {
      d.suc_tarihi = v || null;
    },
    ozet: (d) => `Suç ${tr(d.suc_tarihi)}`,
  },
  {
    id: 'ceza',
    tur: 'ceza',
    baslik: (d) => (d.konum === 'varsayimsal' ? 'Alabileceği ceza' : 'Hükümdeki ceza'),
    aciklama: (d) => (d.konum === 'varsayimsal' ? 'Örneğin 5 yıl alırsa: 5 yıl yazın.' : 'Kesinleşen sonuç ceza (yıl / ay / gün).'),
    gorunur: () => true,
    cevaplandi: (d) => (SURELI_TURLER.includes(d.ceza_turu) ? cezaVar(d.ceza) : !!d.ceza_turu),
    ata: (d, v) => {
      d.ceza_turu = v.ceza_turu || 'sureli_hapis';
      d.ceza = SURELI_TURLER.includes(d.ceza_turu) ? v.ceza : null;
    },
    ozet: (d) => {
      const tur = { muebbet: 'Müebbet', agirlastirilmis_muebbet: 'Ağırlaştırılmış müebbet' }[d.ceza_turu];
      if (tur) return tur;
      return `${T.cezaMetni(d.ceza)}${d.ceza_turu === 'adli_paradan_cevrilen_hapis' ? ' (paradan çevrilen)' : ''}`;
    },
  },
  {
    id: 'suc',
    tur: 'suc',
    baslik: 'Suç',
    aciklama: () => 'Adını ya da madde numarasını yazın. Oranı suç belirler.',
    bilinmiyor: 'Suç girilmedi: özel oran ve istisna listelerinin dışında bir suç varsayıldı.',
    gorunur: () => true,
    cevaplandi: (d) => !!d.suc || bilinmiyorMu(d, 'suc'),
    ata: (d, v) => {
      d.suc = v;
    },
    ozet: (d) => (d.suc ? `${maddeEtiketi(d.suc)}${sucAdi(d.suc) ? ' · ' + sucAdi(d.suc) : ''}` : 'Suç bilinmiyor'),
  },
  {
    id: 'tekerrur',
    tur: 'secim',
    baslik: 'Tekerrür (mükerrirlik) var mı?',
    aciklama: (d) =>
      d.konum === 'varsayimsal'
        ? 'Daha önce kesinleşmiş bir hapis cezası varsa ve tekerrür süresi dolmadıysa mükerrir olur.'
        : 'Hükümde tekerrür hükümleri uygulandı mı?',
    secenekler: () => [
      { deger: 'yok', etiket: 'Yok' },
      { deger: 'birinci', etiket: '1. tekerrür', aciklama: 'mükerrir' },
      { deger: 'ikinci', etiket: '2. tekerrür', aciklama: 'ikinci kez mükerrir' },
    ],
    bilinmiyor: 'Tekerrür bilinmiyor: tekerrürsüz gösterildi, tekerrürlü sonuçlar altta.',
    gorunur: () => true,
    cevaplandi: (d) => !!d.tekerrur || bilinmiyorMu(d, 'tekerrur'),
    ata: (d, v) => {
      d.tekerrur = v;
    },
    ozet: (d) => ({ yok: 'Tekerrür yok', birinci: '1. tekerrür', ikinci: '2. tekerrür' })[d.tekerrur] || 'Tekerrür bilinmiyor',
  },
  {
    id: 'esas_ceza',
    tur: 'ceza',
    baslik: 'Tekerrüre esas önceki ceza ne kadardı?',
    aciklama: () => 'Tekerrür nedeniyle eklenen süre bu cezayı aşamaz (5275 m.108/2). Birden çoksa en ağırını yazın.',
    bilinmiyor: 'Önceki ceza bilinmiyor: 108/2 sınırı uygulanmadı, süre en çok değerdir.',
    gorunur: (d) => d.tekerrur === 'birinci' && SURELI_TURLER.includes(d.ceza_turu),
    cevaplandi: (d) => cezaVar(d.esas_ceza) || bilinmiyorMu(d, 'esas_ceza'),
    ata: (d, v) => {
      d.esas_ceza = v.ceza;
    },
    ozet: (d) => (cezaVar(d.esas_ceza) ? `Önceki ceza ${T.cezaMetni(d.esas_ceza)}` : 'Önceki ceza bilinmiyor'),
  },
  {
    id: 'giris',
    tur: 'giris',
    baslik: (d) => (d.konum === 'cezaevinde' ? 'Cezaevine giriş tarihi' : 'Ne zaman girdiği varsayılsın?'),
    aciklama: (d) => (d.konum === 'cezaevinde' ? 'İnfaza başlama tarihi (müddetnamedeki başlangıç).' : 'Bugün ya da bilinen bir tarih.'),
    bilinmiyor: 'Giriş tarihi bilinmiyor: bugün girdiği varsayıldı.',
    gorunur: () => true,
    cevaplandi: (d) => !!d.giris || bilinmiyorMu(d, 'giris'),
    ata: (d, v) => {
      d.giris = v;
    },
    ozet: (d) => (d.giris?.tur === 'tarih' ? `Giriş ${tr(d.giris.tarih)}` : 'Giriş bugün'),
  },
  {
    id: 'mahsup',
    tur: 'mahsup',
    baslik: 'Gözaltı veya tutuklulukta geçen süre var mı?',
    aciklama: () => 'Bu dosyada gözaltı ve tutuklulukta geçen günler cezadan düşülür.',
    bilinmiyor: 'Gözaltı/tutukluluk bilinmiyor: mahsup yapılmadı.',
    gorunur: (d) => SURELI_TURLER.includes(d.ceza_turu) || d.ceza_turu === 'muebbet' || d.ceza_turu === 'agirlastirilmis_muebbet',
    cevaplandi: (d) => !!d.mahsup || bilinmiyorMu(d, 'mahsup'),
    ata: (d, v) => {
      d.mahsup = v;
    },
    ozet: (d) => {
      const g = (d.mahsup?.gozalti || 0) + (d.mahsup?.tutukluluk || 0);
      return d.mahsup ? (g ? `Mahsup ${g} gün` : 'Mahsup yok') : 'Mahsup bilinmiyor';
    },
  },
];

// Ek sorular: sırası önem sırasıdır. Her biri yalnız sonucu değiştirdiğinde sorulur.
export const EK_SORULAR = [
  {
    id: 'fikra',
    tur: 'fikra',
    baslik: (d) => `${maddeEtiketi(d.suc)}: hangi fıkra ve bent?`,
    aciklama: () => 'Bu maddede oran ya da açık cezaevi fıkraya göre değişiyor.',
    bilinmiyor: 'Fıkra/bent bilinmiyor: daha ağır sonuç esas alındı (en çok).',
    alanlar: ['ilam.fikra', 'ilam.bent'],
    // 220/314'te fıkra kurma ile üyeliği ayırır; karar alanı fıkra olmasa da sorulur.
    zorunlu: (d) => d.suc?.kanun === 5237 && ORGUT_MADDELERI.has(d.suc.madde) && !d.suc.fikra,
    gorunur: (d) => !!d.suc?.madde,
    cevaplandi: (d) => !!d.suc?.fikra || bilinmiyorMu(d, 'fikra'),
    ata: (d, v) => {
      d.suc = { ...d.suc, fikra: v.fikra || null, bent: v.bent || null };
    },
    ozet: (d) => (d.suc?.fikra ? `Fıkra ${d.suc.fikra}${d.suc.bent ? '-' + d.suc.bent : ''}` : 'Fıkra bilinmiyor'),
  },
  {
    id: 'yas',
    tur: 'secim',
    baslik: 'Yaşı',
    aciklama: () => 'Çocuk ve ileri yaştaki hükümlüler için süreler farklı.',
    secenekler: () => [
      { deger: 'yetiskin', etiket: 'Yetişkin', aciklama: 'suç tarihinde 18+, bugün 65 altı' },
      { deger: 'cocuk', etiket: 'Suç tarihinde 18 yaşından küçük' },
      { deger: 'yasli', etiket: 'Bugün 65 yaş veya üstü' },
    ],
    bilinmiyor: 'Yaş bilinmiyor: suç tarihinde yetişkin olduğu varsayıldı.',
    gorunur: () => true,
    cevaplandi: (d) => !!d.ek.yas || bilinmiyorMu(d, 'yas'),
    ata: (d, v) => {
      d.ek.yas = v;
      if (v === 'yetiskin') delete d.ek.dogum_tarihi;
    },
    // Sınama için temsilî doğum tarihleri: yetişkin, 15 yaşında çocuk, bugün 71 yaşında.
    denemeler: (d, bugun) => [null, T.yilEkle(d.suc_tarihi, -15), T.yilEkle(bugun, -71)],
    denemeAta: (d, dogum) => {
      d.ek.dogum_tarihi = dogum;
    },
    ozet: (d) => ({ yetiskin: 'Yetişkin', cocuk: 'Suçta 18 yaş altı', yasli: '65 yaş üstü' })[d.ek.yas] || 'Yaş bilinmiyor',
  },
  {
    id: 'dogum_tarihi',
    tur: 'tarih',
    baslik: 'Doğum tarihi',
    aciklama: (d) => (d.ek.yas === 'cocuk' ? 'Çocukta yaş grubuna göre süre ve gün ağırlığı hesaplanır.' : 'Yaşa bağlı denetimli serbestlik yolları için.'),
    bilinmiyor: 'Doğum tarihi bilinmiyor: yaşa bağlı özel hükümler uygulanmadı.',
    gorunur: (d) => d.ek.yas === 'cocuk' || d.ek.yas === 'yasli',
    cevaplandi: (d) => !!d.ek.dogum_tarihi || bilinmiyorMu(d, 'dogum_tarihi'),
    ata: (d, v) => {
      d.ek.dogum_tarihi = v || null;
    },
    ozet: (d) => (d.ek.dogum_tarihi ? `Doğum ${tr(d.ek.dogum_tarihi)}` : 'Doğum tarihi bilinmiyor'),
    // Yaş cevabından sonra gelir; sonucu değiştirip değiştirmediği sınanmaz.
    dogrudan: true,
  },
  {
    id: 'kadin_cocuk',
    tur: 'secim',
    baslik: 'Hükümlü, 0-6 yaş arası çocuğu olan bir kadın mı?',
    aciklama: () => 'Bu durumda denetimli serbestlik daha erken başlar.',
    secenekler: () => evetHayir,
    bilinmiyor: '0-6 yaş çocuklu kadın hükümlü olmadığı varsayıldı.',
    alanlar: ['kisi.kadin_hukumlu', 'kisi.0_6_yas_grubunda_cocugu_var'],
    gorunur: () => true,
    cevaplandi: (d) => ekCevap('kadin_cocuk')(d) || bilinmiyorMu(d, 'kadin_cocuk'),
    ata: (d, v) => {
      d.ek.kadin_cocuk = v;
    },
    denemeler: () => [true, false],
    ozet: (d) => (d.ek.kadin_cocuk ? '0-6 yaş çocuklu kadın' : d.ek.kadin_cocuk === false ? 'Çocuklu kadın değil' : 'Çocuklu kadın: bilinmiyor'),
  },
  {
    id: 'rapor',
    tur: 'secim',
    baslik: 'Ağır hastalık, engellilik veya kocama raporu var mı?',
    aciklama: () => 'Hayatını yalnız idame ettiremediğine dair resmî sağlık kurulu raporu.',
    secenekler: () => evetHayir,
    bilinmiyor: 'Sağlık raporu olmadığı varsayıldı.',
    alanlar: ['kisi.105A_3_b_raporu_dogrulandi'],
    gorunur: () => true,
    cevaplandi: (d) => ekCevap('rapor')(d) || bilinmiyorMu(d, 'rapor'),
    ata: (d, v) => {
      d.ek.rapor = v;
    },
    denemeler: () => [true, false],
    ozet: (d) => (d.ek.rapor ? 'Sağlık raporu var' : d.ek.rapor === false ? 'Sağlık raporu yok' : 'Rapor: bilinmiyor'),
  },
  {
    id: 'magdur_yakinlik',
    tur: 'secim',
    baslik: 'Mağdurla yakınlığı',
    aciklama: () => 'Bu suçta mağdurun kim olduğu açık cezaevi ve oranları etkiliyor.',
    secenekler: () => [
      { deger: 'es', etiket: 'Eşi' },
      { deger: 'ustsoy', etiket: 'Üstsoyu', aciklama: 'anne, baba…' },
      { deger: 'altsoy', etiket: 'Altsoyu', aciklama: 'çocuğu, torunu…' },
      { deger: 'kardes', etiket: 'Kardeşi' },
      { deger: 'diger', etiket: 'Yakını değil' },
    ],
    bilinmiyor: 'Mağdurla yakınlık bilinmiyor: daha ağır sonuç esas alındı.',
    alanlar: ['ilam.magdur_yakinlik', 'ilam.magdur_es'],
    gorunur: () => true,
    cevaplandi: (d) => ekCevap('magdur_yakinlik')(d) || bilinmiyorMu(d, 'magdur_yakinlik'),
    ata: (d, v) => {
      d.ek.magdur_yakinlik = v;
    },
    denemeler: () => ['es', 'ustsoy', 'altsoy', 'kardes', 'diger'],
    ozet: (d) => ({ es: 'Mağdur: eşi', ustsoy: 'Mağdur: üstsoyu', altsoy: 'Mağdur: altsoyu', kardes: 'Mağdur: kardeşi', diger: 'Mağdur: yakını değil' })[d.ek.magdur_yakinlik] || 'Mağdur: bilinmiyor',
  },
  {
    id: 'magdur_savunmasiz',
    tur: 'secim',
    baslik: 'Mağdur çocuk, yaşlı ya da kendini savunamayacak durumda mıydı?',
    aciklama: () => 'Bu suçta oran mağdurun durumuna göre değişiyor.',
    secenekler: () => evetHayir,
    bilinmiyor: 'Mağdurun durumu bilinmiyor: daha ağır sonuç esas alındı.',
    alanlar: ['ilam.magdur_savunmasiz'],
    gorunur: () => true,
    cevaplandi: (d) => ekCevap('magdur_savunmasiz')(d) || bilinmiyorMu(d, 'magdur_savunmasiz'),
    ata: (d, v) => {
      d.ek.magdur_savunmasiz = v;
    },
    denemeler: () => [true, false],
    ozet: (d) => (d.ek.magdur_savunmasiz ? 'Mağdur savunmasız' : 'Mağdur savunmasız değil'),
  },
  {
    id: 'deprem',
    tur: 'secim',
    baslik: 'Ölüm, depremde yapı çökmesiyle mi bağlantılı?',
    aciklama: () => 'Deprem/yapı bağlantılı ölümlerde açık cezaevi hükümleri farklı.',
    secenekler: () => evetHayir,
    bilinmiyor: 'Deprem/yapı bağlantısı bilinmiyor: daha ağır sonuç esas alındı.',
    alanlar: ['ilam.deprem_yapi_olumu'],
    gorunur: () => true,
    cevaplandi: (d) => ekCevap('deprem')(d) || bilinmiyorMu(d, 'deprem'),
    ata: (d, v) => {
      d.ek.deprem = v;
    },
    denemeler: () => [true, false],
    ozet: (d) => (d.ek.deprem ? 'Deprem/yapı bağlantılı' : 'Deprem bağlantısı yok'),
  },
  {
    id: 'mit_2937',
    tur: 'secim',
    baslik: 'Hüküm 2937 sayılı Kanun (MİT) ceza hükümleri kapsamında mı?',
    aciklama: () => 'Kapsam hükümden doğrulanmalı.',
    secenekler: () => evetHayir,
    bilinmiyor: '2937 kapsamı doğrulanmadı.',
    alanlar: ['ilam.2937_ceza_kapsami_dogrulandi'],
    gorunur: (d) => d.suc?.kanun === 2937,
    cevaplandi: (d) => ekCevap('mit_2937')(d) || bilinmiyorMu(d, 'mit_2937'),
    ata: (d, v) => {
      d.ek.mit_2937 = v;
    },
    denemeler: () => [true, false],
    ozet: (d) => (d.ek.mit_2937 ? '2937 kapsamında' : '2937 kapsamı dışında'),
  },
];

export const TUM_SORULAR = [...TEMEL_SORULAR, ...EK_SORULAR];

// "Bilmiyorum": varsa önceki cevap silinir, soru bilinmiyor olarak işaretlenir.
export function bilinmiyorCevabi(d, id) {
  if (id === 'suc') d.suc = null;
  else if (id === 'fikra' && d.suc) d.suc = { ...d.suc, fikra: null, bent: null };
  else if (id === 'tekerrur') d.tekerrur = null;
  else if (id === 'esas_ceza') d.esas_ceza = null;
  else if (id === 'giris') d.giris = null;
  else if (id === 'mahsup') d.mahsup = null;
  else if (id === 'yas') {
    delete d.ek.yas;
    delete d.ek.dogum_tarihi;
  } else delete d.ek[id];
  bilinmiyorYap(d, id, true);
}

// Gerçek cevap: soru bilinmiyor listesinden çıkar.
export function cevapla(d, s, deger) {
  s.ata(d, deger);
  bilinmiyorYap(d, s.id, false);
  if (s.id === 'suc') bilinmiyorYap(d, 'fikra', false);
}
export const soru = (id) => TUM_SORULAR.find((s) => s.id === id);

export const metin = (deger, d) => (typeof deger === 'function' ? deger(d) : deger);

// Ekranda büyük gösterilen senaryo: tekerrür cevabı, bilinmiyorsa tekerrürsüz.
export const gosterilenSenaryo = (d) => d.tekerrur || 'yok';

// Bir senaryonun avukat açısından önemli sonuçları; karşılaştırma için.
export function imza(S) {
  if (!S) return 'yok';
  const t = S.takvim || {};
  return [S.uygulanabilir, S.hesaplanamadi, S.kurumda_kalis_gun, t.kapalidan_aciga_hak_kazanma, t.kurumdan_cikis, t.kosullu_saliverilme, t.hak_ederek_tahliye].join('|');
}

function senaryoSonucu(kt, d, bugun, anahtar) {
  return hesapla(kt, vakaKur(d, bugun)).senaryolar[anahtar];
}

// Ek sorunun bu dosyada sonucu değiştirip değiştirmediği.
export function sonucuDegistirir(kt, d, bugun, s, S) {
  if (s.dogrudan) return true;
  if (s.zorunlu?.(d)) return true;
  if (s.alanlar && !s.alanlar.some((a) => S.belirsiz_kosullar.includes(a))) return false;
  if (!s.denemeler) return true;
  const anahtar = gosterilenSenaryo(d);
  const imzalar = new Set(
    s.denemeler(d, bugun).map((deger) => {
      const k = klonla(d);
      (s.denemeAta || s.ata)(k, deger);
      return imza(senaryoSonucu(kt, k, bugun, anahtar));
    }),
  );
  return imzalar.size > 1;
}

// Sıradaki soru: önce temel sorular, sonra sonucu değiştiren ilk ek soru.
// `cikti` mevcut dosyanın hesap çıktısıdır (yoksa ek soru aranmaz).
export function sonrakiSoru(kt, d, bugun, cikti) {
  if (kapsamDisi(d)) return null;
  for (const s of TEMEL_SORULAR) if (s.gorunur(d) && !s.cevaplandi(d)) return s;
  if (!hesaplanabilir(d) || !cikti) return null;
  const S = cikti.senaryolar?.[gosterilenSenaryo(d)];
  if (!S?.takvim) return null;
  for (const s of EK_SORULAR) {
    if (!s.gorunur(d) || s.cevaplandi(d)) continue;
    if (sonucuDegistirir(kt, d, bugun, s, S)) return s;
  }
  return null;
}

// Dosya özetindeki cevaplar (sırayla).
export function cevaplar(d) {
  return TUM_SORULAR.filter((s) => s.gorunur(d) && s.cevaplandi(d)).map((s) => ({ id: s.id, metin: s.ozet(d), bilinmiyor: bilinmiyorMu(d, s.id) }));
}

// "Bilmiyorum" cevaplarının varsayım satırları.
export function varsayimSatirlari(d) {
  return TUM_SORULAR.filter((s) => s.gorunur(d) && bilinmiyorMu(d, s.id) && s.bilinmiyor).map((s) => s.bilinmiyor);
}
