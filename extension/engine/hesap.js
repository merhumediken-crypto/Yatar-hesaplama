// Deterministik infaz ön değerlendirme motoru.
//
// Kural tabanının hesap politikası gereği bu motor yalnız şu durumları üretir:
// "eksik_veri", "hukuki_inceleme_gerekli", "varsayimli_senaryo". Kesin tahliye tarihi
// üretmez; her sayı, dayandığı kural kimliği ve varsayımlarla birlikte döner.

import { Kesir } from './rasyonel.js';
import * as T from './tarih.js';
import { katalogEslesir, maddeListesindeMi, normalMadde, veya } from './katalog.js';
import { KuralTabani } from './kurallar.js';
import { tekerrurTespit, adayMetni } from './tekerrur.js';

export const SENARYOLAR = [
  { anahtar: 'yok', baslik: 'Tekerrürsüz' },
  { anahtar: 'birinci', baslik: '1. Tekerrür (mükerrir)' },
  { anahtar: 'ikinci', baslik: '2. Tekerrür' },
];

const SEVIYE_SIRASI = { bilgi: 0, varsayim: 1, inceleme: 2, eksik: 3 };

class Notlar {
  constructor() {
    this.liste = [];
  }
  ekle(seviye, kod, mesaj, kurallar = []) {
    if (!this.liste.some((n) => n.kod === kod && n.mesaj === mesaj)) {
      this.liste.push({ seviye, kod, mesaj, kurallar });
    }
  }
  enYuksek() {
    return this.liste.reduce((m, n) => (SEVIYE_SIRASI[n.seviye] > SEVIYE_SIRASI[m] ? n.seviye : m), 'bilgi');
  }
}

const KAST_GRUBU = { kasit: 'kast', olasi_kast: 'kast', taksir: 'taksir', bilincli_taksir: 'taksir' };

function gecerliCeza(c) {
  if (!c || typeof c !== 'object') return false;
  const alanlar = ['yil', 'ay', 'gun'];
  if (!alanlar.every((a) => c[a] === undefined || c[a] === null || (Number.isInteger(c[a]) && c[a] >= 0))) return false;
  return alanlar.some((a) => (c[a] || 0) > 0);
}

function temizCeza(c) {
  return { yil: c.yil || 0, ay: c.ay || 0, gun: c.gun || 0 };
}

// ---------------------------------------------------------------------------
// Bağlam
// ---------------------------------------------------------------------------

function baglamKur(kt, vaka, notlar) {
  const ilam = { ...(vaka.ilam || {}) };
  ilam.kanun_madde_fikra_bent = { kanun: 5237, ...(ilam.kanun_madde_fikra_bent || {}) };
  const ceza_turu = ilam.ceza_turu || 'sureli_hapis';
  const eksik = [];

  if (!T.gecerliTarih(ilam.suc_tarihi)) eksik.push({ kod: 'E001', alan: 'suc_tarihi', mesaj: 'Suç tarihi girilmedi veya geçersiz (YYYY-AA-GG).' });
  if (ceza_turu === 'sureli_hapis' && !gecerliCeza(ilam.hukumdeki_sonuc_ceza)) {
    eksik.push({ kod: 'E001', alan: 'hukumdeki_sonuc_ceza', mesaj: 'Hükümdeki sonuç ceza (yıl/ay/gün) girilmedi.' });
  }
  if (ceza_turu === 'adli_para') {
    eksik.push({ kod: 'E011', alan: 'ceza_turu', mesaj: 'Adli para cezasında infaz kurumunda kalış hesabı yapılmaz; ödenmeyip hapse çevrilmişse "adli paradan çevrilen hapis" seçilmelidir.' });
  }

  const bugun = T.bugunIstanbul();
  const hesapTarihi = T.gecerliTarih(vaka.hesap_tarihi) ? vaka.hesap_tarihi : bugun;
  if (!T.gecerliTarih(vaka.hesap_tarihi)) notlar.ekle('bilgi', 'hesap_tarihi', `Hesap tarihi olarak bugün (${T.trTarih(bugun)}) kullanıldı; norm sürümleri bu tarihe göre seçildi.`);

  let baslama = vaka.infaza_baslama_tarihi;
  let baslamaVarsayildi = false;
  if (!T.gecerliTarih(baslama)) {
    baslama = hesapTarihi;
    baslamaVarsayildi = true;
  }

  let mahsup = Number.isInteger(vaka.mahsup_gun) && vaka.mahsup_gun >= 0 ? vaka.mahsup_gun : 0;

  const dogum = T.gecerliTarih(vaka.dogum_tarihi) ? vaka.dogum_tarihi : null;
  const suc = T.gecerliTarih(ilam.suc_tarihi) ? ilam.suc_tarihi : null;
  const yasSuc = dogum && suc ? T.yasHesapla(dogum, suc) : null;
  const yasHesap = dogum ? T.yasHesapla(dogum, hesapTarihi) : null;

  return {
    vaka,
    ilam,
    ceza_turu,
    ceza: ilam.hukumdeki_sonuc_ceza ? temizCeza(ilam.hukumdeki_sonuc_ceza) : null,
    suc,
    hesapTarihi,
    baslama,
    baslamaVarsayildi,
    mahsup,
    E: T.gunEkle(baslama, -mahsup),
    dogum,
    yasSuc,
    yasHesap,
    cocuk: yasSuc === null ? null : yasSuc < 18,
    kast: KAST_GRUBU[ilam.kast_turu] || null,
    profil: vaka.yuvarlama === 'yukari' ? 'yukari' : 'asagi',
    eksik,
  };
}

function genelVarsayimlar(kt, ctx, notlar) {
  const { ilam, vaka } = ctx;
  if (ctx.baslamaVarsayildi) {
    notlar.ekle('varsayim', 'infaza_baslama_tarihi', `İnfaza başlama tarihi girilmedi; hesap tarihi (${T.trTarih(ctx.baslama)}) başlangıç kabul edildi. Takvim tarihleri bu varsayıma göredir.`, ['R003']);
  }
  if (!Number.isInteger(vaka.mahsup_gun)) {
    notlar.ekle('varsayim', 'mahsup', 'Mahsup (gözaltı/tutukluluk) girilmedi; mahsup yok kabul edildi.', ['R004']);
  } else if (ctx.mahsup > 0) {
    notlar.ekle('varsayim', 'Q04', `${ctx.mahsup} gün mahsup, infaz kurumunda geçmiş gün olarak hem koşullu salıverilme hem asgari kurum süresine sayıldı; mahsup ile asgari süre etkileşimi doğrulanmadı (Q04, E006).`, ['R004', 'R042']);
  }
  if (normalMadde(ilam.kanun_madde_fikra_bent.madde) === null) {
    notlar.ekle('varsayim', 'E001', 'Suç maddesi girilmedi; suçun özel oran ve istisna kataloglarının dışında olduğu varsayıldı.', ['R021', 'R022', 'R050']);
  }
  if (ctx.dogum === null) {
    notlar.ekle('varsayim', 'dogum_tarihi', 'Doğum tarihi girilmedi; suç tarihinde 18 yaşını doldurmuş olduğu varsayıldı.', ['R013', 'R025']);
  }
  if (ilam.teror_kanunu_kapsami == null) notlar.ekle('varsayim', 'teror', 'Terörle Mücadele Kanunu kapsamı belirtilmedi; kapsam dışı varsayıldı.', ['R024']);
  if (ilam.orgut_faaliyeti == null && ilam.orgut_kurma_yonetme == null) notlar.ekle('varsayim', 'orgut', 'Örgüt bağlantısı belirtilmedi; örgüt suçu olmadığı varsayıldı.', ['R023']);
  if (!ctx.kast) notlar.ekle('varsayim', 'kast_turu', 'Kast türü belirtilmedi; kasıtlı suç kabul edildi.', ['R012', 'R060']);
  if (vaka.iyi_hal_karari !== true) {
    notlar.ekle('varsayim', 'E008', 'İyi hâl kararı varsayıldı. İyi hâl tarih aritmetiğinden türetilemez; kurul ve yetkili merci kararı gerekir.', ['R062']);
  }
  if (!T.gecerliTarih(ilam.kesinlesme_tarihi)) {
    notlar.ekle('varsayim', 'R002', 'Kesinleşme tarihi girilmedi; hükmün kesinleştiği varsayıldı. Kesinleşmemiş hüküm infaz edilemez.', ['R002']);
  }
  notlar.ekle('varsayim', 'Q03', `Kesirli gün ${ctx.profil === 'yukari' ? 'yukarı' : 'aşağı'} yuvarlandı (gün artığı infaz edilmez); oran ve onda bir yuvarlama sırası resmî müddetnameyle doğrulanmadı (Q03, E006).`, ['R003']);
  notlar.ekle('varsayim', 'tek_ilam', 'Başka ilam, toplama kararı, disiplin cezası veya infaz kesintisi olmadığı varsayıldı.', ['R005']);

  if (ctx.suc && T.once(ctx.suc, kt.esik('T01'))) {
    notlar.ekle('inceleme', 'E010', '01/06/2005 öncesi suç: 647 ve 765 sayılı mülga kanunlarla lehe kanun karşılaştırması gerekir; sonuç 5275 rejimine göre gösterilmiştir (Q06).', ['R001']);
    notlar.ekle('inceleme', 'Q06', 'Tarihsel dosya: 647/765/5252 karşılaştırması yapılmadan kesin sonuç verilemez.', ['R001']);
  }
  if (Number(ilam.kanun_madde_fikra_bent.kanun) === 2937) {
    notlar.ekle('inceleme', 'E009', '2937 sayılı Kanun ceza hükümleri otomatik eşleştirilmez; 107/2 özel oranı (2/3) kapsamı belgeyle doğrulanmalı.', ['R021']);
  }
  if (ilam.para_cezasindan_cevrilme == null && ctx.ceza_turu === 'sureli_hapis') {
    notlar.ekle('varsayim', 'para_cezasi', 'Hapis cezasının adli para cezasından çevrilmediği varsayıldı.', ['R044']);
  }
}

// ---------------------------------------------------------------------------
// Temel koşullu salıverilme oranı (R020-R026)
// ---------------------------------------------------------------------------

export function temelOranBelirle(kt, ctx, notlar = new Notlar()) {
  const { ilam, suc } = ctx;
  const maddeVar = normalMadde(ilam.kanun_madde_fikra_bent.madde) !== null;
  const adaylar = [{ oran: kt.oran('R020'), kural: 'R020', neden: 'Genel oran: süreli hapiste iyi hâl şartıyla 1/2 (5275 m.107/2).' }];

  if (ctx.cocuk === true) {
    const r = katalogEslesir(kt.katalog(kt.p('R025').secici), ilam);
    if (r.sonuc === true) adaylar.push({ oran: kt.oran('R025'), kural: 'R025', neden: `Çocukta sayılan suç (${r.eslesenler.join('; ')}): 2/3.` });
    else if (r.sonuc === null) notlar.ekle('varsayim', 'R025', 'Çocukta 2/3 oranlı suç grubunda olup olmadığı belirlenemedi; genel oran kullanıldı.', ['R025']);
    if (ilam.teror_kanunu_kapsami === true) adaylar.push({ oran: kt.oran('R024', 'cocuk_oran'), kural: 'R024', neden: 'Terör kapsamında çocuk hükümlü: 2/3 (3713 m.17).' });
  } else {
    const r21 = katalogEslesir(kt.katalog(kt.p('R021').secici), ilam);
    if (r21.sonuc === true) adaylar.push({ oran: kt.oran('R021'), kural: 'R021', neden: `5275 m.107/2 özel suç grubu (${r21.eslesenler.join('; ')}): 2/3.` });
    if (Number(ilam.kanun_madde_fikra_bent.kanun) === 2937) adaylar.push({ oran: kt.oran('R021'), kural: 'R021', neden: '2937 s. Kanun ceza hükümleri (otomatik eşleştirilmedi, doğrulanmalı): 2/3.' });

    const r22 = katalogEslesir(kt.katalog(kt.p('R022').secici), ilam);
    if (r22.sonuc === true) {
      const r26 = kt.p('R026');
      if (suc && T.once(suc, r26.suc_tarihi.lt) && maddeListesindeMi(ilam, r26.tck_maddeleri)) {
        adaylar.push({ oran: kt.oran('R026'), kural: 'R026', neden: `28/06/2014 öncesi suç (${r22.eslesenler.join('; ')}): geçici 9/4 uyarınca 2/3.` });
      } else {
        adaylar.push({ oran: kt.oran('R022'), kural: 'R022', neden: `5275 m.108/9 kapsamı (${r22.eslesenler.join('; ')}): yetişkinde 3/4.` });
      }
    } else if (r22.sonuc === null && r21.sonuc !== true && maddeVar) {
      notlar.ekle('varsayim', 'R022', `Fıkra/bent bilinmediği için 108/9 (3/4) kapsamı belirlenemedi: ${r22.belirsizler.join('; ')}.`, ['R022']);
    }
    if (maddeVar && r21.sonuc === null && r21.belirsizler.some((b) => !b.startsWith('2937'))) {
      notlar.ekle('varsayim', 'R021', `Fıkra/bent bilinmediği için 107/2 (2/3) kapsamı belirlenemedi: ${r21.belirsizler.filter((b) => !b.startsWith('2937')).join('; ')}.`, ['R021']);
    }

    if (veya(ilam.orgut_kurma_yonetme ?? null, ilam.orgut_faaliyeti ?? null) === true) {
      adaylar.push({ oran: kt.oran('R023', 'sureli_oran'), kural: 'R023', neden: 'Örgüt kurma/yönetme veya örgüt faaliyeti: 2/3 (5275 m.107/4).' });
    }
    if (ilam.teror_kanunu_kapsami === true) {
      adaylar.push({ oran: kt.oran('R024', 'yetiskin_sureli_oran'), kural: 'R024', neden: 'Terör kapsamında yetişkin süreli hapis: 3/4 (3713 m.17). 3713 tam metni ayrıca doğrulanmalı.' });
    }
  }

  const secilen = adaylar.reduce((a, b) => (b.oran.karsilastir(a.oran) >= 0 ? b : a));
  return { ...secilen, adaylar };
}

// ---------------------------------------------------------------------------
// Denetimli serbestlik penceresi (R040, R041, R050, R051)
// ---------------------------------------------------------------------------

export function dsPenceresiBelirle(kt, ctx, notlar = new Notlar()) {
  const { ilam, suc, vaka } = ctx;
  const adaylar = [{ yil: kt.p('R040').normal_pencere_yil, kural: 'R040', ad: '5275 m.105/A genel (1 yıl)' }];
  const elenen = [];

  const r41 = kt.p('R041');
  if (vaka.kadin_0_6_cocuk === true) {
    adaylar.push({ yil: r41.sifir_alti_yas_cocugu_bulunan_kadin_yil, kural: 'R041', ad: '0-6 yaş çocuğu olan kadın hükümlü (105/A/3)' });
  }
  if (vaka.agir_hasta_yalniz_yasayamaz === true) {
    adaylar.push({ yil: r41.agir_hastalik_engellilik_kocama_yalniz_yasam_surdurememe_yil, kural: 'R041', ad: 'Ağır hastalık/engellilik/kocama (105/A/3; sağlık raporu gerekir)' });
  }

  const r50 = kt.p('R050');
  if (suc && !T.sonra(suc, r50.suc_tarihi.lte)) {
    const g61 = katalogEslesir(kt.katalog(r50.istisna_secici), ilam);
    if (g61.sonuc === true) {
      elenen.push({ yol: 'Geçici 6/1 (3 yıl)', neden: `İstisna suç: ${g61.eslesenler.join('; ')}`, kural: 'R050' });
    } else {
      adaylar.push({ yil: r50.pencere_yil, kural: 'R050', ad: 'Geçici 6/1: 30/03/2020 ve öncesi suç (3 yıl)' });
      if (g61.sonuc === null) notlar.ekle('varsayim', 'R050', `Geçici 6/1 istisna kataloğu kapsamı belirlenemedi (${g61.belirsizler.slice(0, 4).join('; ')}${g61.belirsizler.length > 4 ? '…' : ''}); kapsam dışı varsayıldı.`, ['R050']);
    }

    const r51 = kt.p('R051');
    const g62 = katalogEslesir(kt.katalog(r51.istisna_secici), ilam);
    if (g62.sonuc !== true) {
      if (vaka.kadin_0_6_cocuk === true || (ctx.yasHesap !== null && ctx.yasHesap >= 70)) {
        adaylar.push({ yil: r51.sifir_alti_yas_cocuklu_kadin_veya_70_yasini_bitirmis_yil, kural: 'R051', ad: 'Geçici 6/2: 0-6 yaş çocuklu kadın veya 70 yaşını bitirmiş (4 yıl)' });
      }
      if (ctx.yasHesap !== null && ctx.yasHesap >= 65 && vaka.agir_hasta_yalniz_yasayamaz === true) {
        adaylar.push({ yil: null, kural: 'R051', ad: 'Geçici 6/2: 65 yaşını bitirmiş, hayatını yalnız sürdüremeyen (sabit pencere üst sınırı yok)' });
      }
    } else if (vaka.kadin_0_6_cocuk === true || (ctx.yasHesap ?? 0) >= 65) {
      elenen.push({ yol: 'Geçici 6/2', neden: `İstisna suç: ${g62.eslesenler.join('; ')}`, kural: 'R051' });
    }
  } else if (suc) {
    elenen.push({ yol: 'Geçici 6/1 (3 yıl)', neden: 'Suç tarihi 30/03/2020 sonrası.', kural: 'R050' });
  }

  const sinirsiz = adaylar.find((a) => a.yil === null);
  const secilen = sinirsiz || adaylar.reduce((a, b) => (b.yil > a.yil ? b : a));
  return { ...secilen, adaylar, elenen };
}

// ---------------------------------------------------------------------------
// Doğrudan açık kurum uygunluğu (R060, R063)
// ---------------------------------------------------------------------------

export function acikKurumDegerlendir(kt, ctx, derece, notlar = new Notlar()) {
  const { ilam } = ctx;
  if (ctx.ceza_turu !== 'sureli_hapis') {
    return { dogrudan: false, neden: 'Müebbet hapiste doğrudan açık kuruma kabul yoktur; kapalıdan açığa ayrılma yönetmelikle belirlenir.' };
  }
  const r60 = kt.p('R060');
  const cocuk = ctx.cocuk === true;
  const r63 = kt.p('R063');
  const taksir = ctx.kast === 'taksir';
  const limit = cocuk
    ? taksir ? r63.dogrudan_egitimevi_taksirli_azami_yil : r63.dogrudan_egitimevi_kasitli_azami_yil
    : taksir ? r60.taksirli_toplam_azami_yil : r60.kasitli_toplam_azami_yil;
  const kurumAdi = cocuk ? 'çocuk eğitimevine' : 'açık kuruma';

  if (T.cezaKarsilastir(ctx.ceza, { yil: limit, ay: 0, gun: 0 }, ctx.E) > 0) {
    return { dogrudan: false, neden: `${taksir ? 'Taksirli' : 'Kasıtlı'} suçta toplam ceza ${limit} yılı aşıyor; doğrudan ${kurumAdi} kabul yok (5275 m.14).`, kural: cocuk ? 'R063' : 'R060' };
  }
  if (!taksir) {
    const ist = katalogEslesir(kt.katalog(r60.kasitli_istisna_secici), ilam, { tekerrur: derece });
    if (ist.sonuc === true) {
      return { dogrudan: false, neden: `5275 m.14/2-a istisnası: ${ist.eslesenler.join('; ')}.`, kural: 'R060' };
    }
    if (ist.sonuc === null) {
      notlar.ekle('varsayim', 'R060', `Doğrudan açık kurum istisnası olmadığı varsayıldı (bilinmeyen: ${ist.belirsizler.join('; ')}).`, ['R060']);
    }
  }
  if (cocuk) notlar.ekle('varsayim', 'R063', 'Çocuk eğitimevine doğrudan kabul eşikleri 18/08/2026 sürümünden alındı; kurul kararı gerekir.', ['R063']);
  return { dogrudan: true, neden: `${taksir ? 'Taksirli' : 'Kasıtlı'} suçta toplam ceza ${limit} yılı aşmıyor; doğrudan ${kurumAdi} kabul olanağı (5275 m.14).`, kural: cocuk ? 'R063' : 'R060' };
}

// ---------------------------------------------------------------------------
// Çocukta kurum günü ağırlığı (R052 geçici 6/4, R053 107/5-2026)
// ---------------------------------------------------------------------------

export function gunAgirligiBelirle(kt, ctx, notlar = new Notlar()) {
  if (ctx.cocuk !== true || !ctx.dogum) return null;
  const r52 = kt.p('R052');
  const r53 = kt.p('R053');
  if (!T.sonra(ctx.suc, r52.suc_tarihi.lte)) {
    return {
      kural: 'R052',
      ad: 'Geçici 6/4: 15 yaş altı her gün 3, 15-18 yaş arası her gün 2 gün',
      agirlik: (yas) => (yas < 15 ? r52.yas_15_alti_gun_agirligi : yas < 18 ? r52.yas_15_dahil_18_alti_gun_agirligi : 1),
    };
  }
  if (!T.once(ctx.suc, r53.yururluk) && !T.once(ctx.hesapTarihi, r53.yururluk)) {
    const ist = katalogEslesir(kt.katalog(r53.istisna_secici), ctx.ilam);
    if (ist.sonuc === true) {
      notlar.ekle('bilgi', 'R053', `107/5 (2026) gün ağırlığı istisnası: ${ist.eslesenler.join('; ')}.`, ['R053']);
      return null;
    }
    if (ist.sonuc === null) notlar.ekle('varsayim', 'R053', '107/5 (2026) istisna suç olmadığı varsayıldı.', ['R053']);
    return {
      kural: 'R053',
      ad: '5275 m.107/5 (18/08/2026): 15 yaş altı her gün 2 gün',
      agirlik: (yas) => (yas < 15 ? r53.yas_15_alti_gun_agirligi : 1),
    };
  }
  notlar.ekle('inceleme', 'E010', '31/03/2020 - 17/08/2026 arası suçta çocuk gün sayımı (107/5) sürümü veritabanında doğrulanmadı; gün ağırlığı uygulanmadı. 2026 sürümü eski suça aleyhe otomatik uygulanamaz (R053).', ['R053']);
  return null;
}

// K29 gibi doğrudan dönem toplamı için: [{ yas, gun }] → ağırlıklı gün
export function agirlikliGunToplami(parcalar, agirlik) {
  return parcalar.reduce((t, p) => t + p.gun * agirlik(p.yas), 0);
}

function agirlikliTarih(E, hedef, dogum, agirlik) {
  let toplam = 0;
  let d = 0;
  while (toplam < hedef && d < 60000) {
    toplam += agirlik(T.yasHesapla(dogum, T.gunEkle(E, d)));
    d++;
  }
  return T.gunEkle(E, d);
}

// ---------------------------------------------------------------------------
// Senaryo hesapları
// ---------------------------------------------------------------------------

function yeniSenaryo(anahtar) {
  const tanim = SENARYOLAR.find((s) => s.anahtar === anahtar);
  return {
    anahtar,
    baslik: tanim.baslik,
    uygulanabilir: true,
    neden: null,
    durum: null,
    oran: null,
    oran_kurali: null,
    ks_ham_gun: null,
    ks_gun: null,
    ust_sinir_108_2: null,
    ds_penceresi: null,
    asgari_kurum: null,
    acik_kurum: null,
    kurumda_kalis_gun: null,
    toplam_infaz_gun: null,
    en_cok: false,
    takvim: null,
    alternatif_yollar: [],
    elenen_yollar: [],
    izler: [],
    notlar: new Notlar(),
    kural_idleri: new Set(),
  };
}

function iz(S, adim, aciklama, kurallar = []) {
  S.izler.push({ adim, aciklama, kurallar });
  kurallar.forEach((k) => S.kural_idleri.add(k));
}

function sureliSenaryo(kt, ctx, derece, tek, ds) {
  const S = yeniSenaryo(derece);
  const { ilam, E, profil } = ctx;

  if (derece !== 'yok' && ctx.cocuk === true) {
    S.uygulanabilir = false;
    S.neden = 'Suç 18 yaşından önce işlenmiş; tekerrür hükümleri uygulanmaz (TCK 58/5).';
    S.kural_idleri.add('R013');
    return S;
  }

  const bihakkin = T.cezaEkle(E, ctx.ceza);
  const toplamGun = T.gunFarki(E, bihakkin);
  iz(S, 'Ceza süresi', `${T.cezaMetni(ctx.ceza)}: ${T.trTarih(E)} etkin başlangıçtan takvimle ${toplamGun} gün (yıl resmî takvim, ay 30 gün; TCK 61/6).`, ['R003']);
  if (T.subat29Kirpilir(E, ctx.ceza.yil)) S.notlar.ekle('bilgi', 'R003', '29 Şubat başlangıcında yıl eklemesi 28 Şubat\'a çekildi.', ['R003']);

  // Adli paradan çevrilen hapis (R044)
  if (ilam.para_cezasindan_cevrilme === true) {
    if (derece !== 'yok') {
      S.uygulanabilir = false;
      S.neden = 'Adli paradan çevrilen hapiste koşullu salıverilme genel hesabı yoktur; tekerrür sonucu değiştirmez.';
      S.kural_idleri.add('R044');
      return S;
    }
    iz(S, 'Adli paradan çevrilen hapis', 'Genel koşullu salıverilme ve 105/A denetimli serbestlik uygulanmaz; ödeme halinde tahliye (5275 m.106/9, 105/A/4).', ['R044']);
    S.notlar.ekle('inceleme', 'R044', 'Ödenmeyen adli para cezasından çevrilen hapis ayrı kalemdir; 5275 m.110 özel halleri otomatik dışlanmamıştır.', ['R044']);
    return tamamla(S, ctx, { ksTarihi: bihakkin, cikis: bihakkin, bihakkin, toplamGun, dsYok: true });
  }

  // Koşullu salıverme geri alınmış (R032, R074)
  if (ilam.ks_geri_alindi === true) {
    iz(S, 'Koşullu salıverilme yasağı', 'Aynı hükümde koşullu salıverilme geri alınmış; yeniden koşullu salıverilme ve olağan DS hesabı kurulmaz.', ['R032', 'R074']);
    S.notlar.ekle('inceleme', 'R074', 'Geri alma kararındaki aynen infaz süresi esas alınmalıdır.', ['R074']);
    return tamamla(S, ctx, { ksTarihi: bihakkin, cikis: bihakkin, bihakkin, toplamGun, dsYok: true });
  }

  const temel = ctx.temel;
  let oran = temel.oran;
  let ksHam = new Kesir(toplamGun).carp(oran);
  S.oran_kurali = temel.kural;
  iz(S, 'Temel oran', `${temel.neden} → ${toplamGun} × ${oran} = ${ksHam.ondalik()} gün.`, [temel.kural]);

  if (derece === 'birinci') {
    const r27 = kt.p('R027');
    const o = Kesir.from(r27.sureli_genel_oran);
    const temelKs = ksHam;
    oran = Kesir.max(temel.oran, o);
    let ham = new Kesir(toplamGun).carp(oran);
    iz(S, 'Birinci tekerrür', `max(temel ${temel.oran}, ${o}) = ${oran} → ${ham.ondalik()} gün (5275 m.108/1).`, ['R027']);
    const C = ctx.vaka.tekerrure_esas_en_agir_ceza && gecerliCeza(ctx.vaka.tekerrure_esas_en_agir_ceza)
      ? temizCeza(ctx.vaka.tekerrure_esas_en_agir_ceza)
      : tek.tekerrure_esas_en_agir_ceza;
    if (C) {
      const cGun = T.gunFarki(E, T.cezaEkle(E, C));
      const ust = temelKs.topla(cGun);
      S.ust_sinir_108_2 = { ceza: C, gun: cGun, ust_sinir: ust };
      if (ham.karsilastir(ust) > 0) {
        iz(S, '108/2 üst sınırı', `Eklenecek süre tekerrüre esas en ağır cezayı (${T.cezaMetni(C)} = ${cGun} gün) aşamaz: min(${ham.ondalik()}, ${temelKs.ondalik()} + ${cGun}) = ${ust.ondalik()} gün.`, ['R027']);
        ham = ust;
      } else {
        iz(S, '108/2 üst sınırı', `Üst sınır ${ust.ondalik()} gün; aşılmadı.`, ['R027']);
      }
    } else {
      S.en_cok = true;
      S.notlar.ekle('varsayim', 'R027', 'Tekerrüre esas en ağır önceki ceza girilmedi; 108/2 üst sınırı uygulanamadı. Sonuç "en çok" değerdir; gerçek süre daha kısa olabilir.', ['R027']);
    }
    ksHam = ham;
    S.notlar.ekle('bilgi', 'R073', 'Mükerrirlere özgü infaz rejimi ve koşullu salıverilme sonrası denetim (5275 m.108/4-7): en az 1 yıl, karar ile en çok 5 yıla kadar uzatılabilir.', ['R073']);
  }

  if (derece === 'ikinci') {
    const r28 = kt.p('R028');
    if (T.once(ctx.hesapTarihi, r28.yururluk)) {
      iz(S, 'İkinci tekerrür (eski 108/3)', 'Hesap tarihi 04/06/2025 öncesi: ikinci tekerrürde koşullu salıverilme yasağı (tarihsel sürüm).', ['R029']);
      S.notlar.ekle('inceleme', 'E010', 'Eski 108/3 salıverilme yasağı tarihsel sürümdür; lehe 7550 değerlendirmesi gerekir.', ['R029']);
      return tamamla(S, ctx, { ksTarihi: bihakkin, cikis: bihakkin, bihakkin, toplamGun, dsYok: true });
    }
    const o = kt.oran('R028');
    oran = Kesir.max(temel.oran, o);
    ksHam = new Kesir(toplamGun).carp(oran);
    iz(S, 'İkinci tekerrür', `max(temel ${temel.oran}, ${o}) = ${oran} → ${ksHam.ondalik()} gün (5275 m.108/3, 7550 m.14). 108/2 üst sınırı uygulanmaz.`, ['R028']);
    if (ctx.suc && T.once(ctx.suc, r28.yururluk)) {
      S.notlar.ekle('inceleme', 'E010', 'Suç 04/06/2025 öncesi: eski 108/3 koşullu salıverilme yasağı yerine 7550 ile gelen 3/4 oranının lehe kanun olarak uygulandığı varsayıldı (TCK 7/2; R029).', ['R028', 'R029', 'R001']);
    }
    S.notlar.ekle('bilgi', 'R073', 'Mükerrirlere özgü infaz rejimi ve koşullu salıverilme sonrası denetim (5275 m.108/4-7).', ['R073']);
  }

  S.oran = oran;
  S.ks_ham_gun = ksHam;
  const ksGun = ksHam.yuvarla(profil);
  S.ks_gun = ksGun;

  // Koşullu salıverilme tarihi (çocukta gün ağırlığı ile)
  let ksTarihi = T.gunEkle(E, ksGun);
  const agirlik = ctx.gunAgirligi;
  if (agirlik) {
    ksTarihi = agirlikliTarih(E, ksGun, ctx.dogum, agirlik.agirlik);
    iz(S, 'Çocukta gün ağırlığı', `${agirlik.ad}: ${ksGun} ağırlıklı güne ${T.gunFarki(E, ksTarihi)} takvim gününde ulaşılır (yalnız koşullu salıverilme süresine uygulanır).`, [agirlik.kural]);
    S.notlar.ekle('varsayim', 'Q04', 'Mahsup günleri gün ağırlığı hesabında infaza başlamadan hemen önceki ardışık günler sayıldı.', ['R004', agirlik.kural]);
  }
  iz(S, 'Koşullu salıverilme', `${ksHam.ondalik()} → ${ksGun} gün; tarih ${T.trTarih(ksTarihi)}.`, ['R003']);

  // Denetimli serbestlik penceresi
  S.ds_penceresi = ds;
  const dsPencereTarihi = ds.yil === null ? E : T.yilEkle(ksTarihi, -ds.yil);
  iz(S, 'Denetimli serbestlik penceresi', ds.yil === null ? `${ds.ad}: sabit pencere sınırı yok.` : `${ds.ad}: koşullu salıverilmeden ${ds.yil} yıl önce → ${T.trTarih(dsPencereTarihi)}.`, [ds.kural]);

  // Asgari kurum süresi (R042)
  const r42 = kt.p('R042');
  let asgariTarihi = E;
  if (ctx.suc && !T.once(ctx.suc, r42.suc_tarihi.gte)) {
    const kurumKs = agirlik ? new Kesir(T.gunFarki(E, ksTarihi)) : ksHam;
    const onda = Kesir.from(r42.ksye_kadar_kurum_suresi_asgari_orani);
    const asgariHam = Kesir.max(r42.asgari_gun, kurumKs.carp(onda));
    const asgariGun = asgariHam.yuvarla(profil);
    asgariTarihi = T.gunEkle(E, asgariGun);
    S.asgari_kurum = { uygulanir: true, ham: asgariHam, gun: asgariGun, tarih: asgariTarihi };
    iz(S, 'Asgari kurum süresi', `max(${r42.asgari_gun} gün, ${kurumKs.ondalik()} × ${onda} = ${kurumKs.carp(onda).ondalik()}) = ${asgariHam.ondalik()} → ${asgariGun} gün (5275 m.105/A/1 son cümle; yalnız DS şartı).`, ['R042']);
  } else {
    S.asgari_kurum = { uygulanir: false };
    iz(S, 'Asgari kurum süresi', 'Suç 04/06/2025 öncesi: onda bir / 5 gün şartı uygulanmaz.', ['R042']);
  }

  // Açık kurum ön koşulu (R060, R061)
  const acik = acikKurumDegerlendir(kt, ctx, derece, S.notlar);
  S.acik_kurum = acik;
  iz(S, 'Açık kurum', acik.neden, [acik.kural || 'R060']);
  if (!acik.dogrudan) {
    S.alt_sinir = true;
    S.notlar.ekle('inceleme', 'Q01', 'Kapalı kurumdan açık kuruma ayrılma süresi (Açık Ceza İnfaz Kurumlarına Ayrılma Yönetmeliği m.6) veritabanında doğrulanmadı; DS ancak açık kurumdan kullanılabildiğinden sonuç alt sınırdır (E005).', ['R061', 'R043']);
    S.kural_idleri.add('R061');
  }

  let dsTarihi = T.enGec(dsPencereTarihi, asgariTarihi, E);
  let cikis = dsTarihi;
  if (T.sonra(dsTarihi, ksTarihi)) {
    cikis = ksTarihi;
    iz(S, 'Sonuç birleştirme', 'Asgari kurum süresi koşullu salıverilme tarihini aşıyor; çıkış koşullu salıverilme ile.', ['R042', 'R043']);
  } else {
    iz(S, 'Sonuç birleştirme', `max(DS penceresi, asgari kurum süresi${acik.dogrudan ? '' : ', açığa ayrılma süresi (bilinmiyor)'}) → ${T.trTarih(dsTarihi)}.`, ['R043']);
  }

  // Geçici 10/6 yolu (R055, R056, R058)
  gecici10Yolu(kt, ctx, derece, S, dsPencereTarihi, cikis, ksTarihi);

  return tamamla(S, ctx, { ksTarihi, cikis, dsTarihi, bihakkin, toplamGun });
}

function gecici10Yolu(kt, ctx, derece, S, dsPencereTarihi, cikis, ksTarihi) {
  const r55 = kt.p('R055');
  const r56 = kt.p('R056');
  const { E, ilam } = ctx;
  if (!ctx.suc) return;
  if (T.sonra(ctx.suc, r55.suc_tarihi.lte)) {
    S.elenen_yollar.push({ yol: 'Geçici 10/6', neden: 'Suç tarihi 31/07/2023 sonrası.', kural: 'R055' });
    return;
  }
  if (T.once(ctx.hesapTarihi, kt.esik('T06'))) return;

  let katalogAdi = r55.istisna_secici;
  if (T.once(ctx.hesapTarihi, r55.yururluk)) {
    katalogAdi = 'gecici_10_6_2023_ilk_surum_istisnalar';
    S.notlar.ekle('inceleme', 'Q07', 'Hesap tarihi 25/12/2025 öncesi: geçici 10/6 ilk sürümü (7456) şartları ayrıca incelenmeli.', ['R054', 'R058']);
  }
  const ist = katalogEslesir(kt.katalog(katalogAdi), ilam, { tekerrur: derece });
  if (katalogAdi === r55.istisna_secici) {
    const ilk = katalogEslesir(kt.katalog('gecici_10_6_2023_ilk_surum_istisnalar'), ilam, { tekerrur: derece });
    if (ist.sonuc === true && ilk.sonuc === false) {
      S.notlar.ekle('inceleme', 'R058', 'Suç 2025 istisna listesinde, 2023 ilk sürümünde değil: önceki kararlar ve sürüm yönünden hukuki inceleme gerekir.', ['R058']);
    }
  }
  if (ist.sonuc === true) {
    S.elenen_yollar.push({ yol: 'Geçici 10/6', neden: `İstisna suç: ${ist.eslesenler.join('; ')}`, kural: 'R055' });
    return;
  }
  const r55k = r55.kapalida_asgari;
  const onYil = T.cezaKarsilastir(ctx.ceza, { yil: 10, ay: 0, gun: 0 }, E) >= 0;
  const kapaliAy = onYil ? r55k.toplam_hapis_10_yil_ve_uzeri_ay : r55k.toplam_hapis_10_yildan_az_ay;
  const enErkenKurum = T.gunEkle(E, (kapaliAy + r56.acik_kurum_asgari_ay) * 30);
  const erken = T.yilEkle(dsPencereTarihi, -r56.normal_DS_tarihinden_erken_yil);
  let tarih = T.enGec(erken, enErkenKurum, E);
  if (T.sonra(tarih, ksTarihi)) tarih = ksTarihi;
  const yol = {
    yol: 'Geçici 10/6',
    tarih,
    kurumda_kalis_gun: Math.max(0, T.gunFarki(ctx.baslama, tarih)),
    durum: 'hukuki_inceleme_gerekli',
    aciklama: `Normal DS tarihinden ${r56.normal_DS_tarihinden_erken_yil} yıl erken; kapalıda en az ${kapaliAy} ay + açık kurumda en az ${r56.acik_kurum_asgari_ay} ay. Normal açığa ayrılma şartları ve infaz hâkimi kararı ayrıca aranır.`,
    kurallar: ['R055', 'R056'],
  };
  if (ist.sonuc === null) S.notlar.ekle('varsayim', 'R055', 'Geçici 10/6 istisna kataloğunun dışında olduğu varsayıldı.', ['R055']);
  if (T.once(tarih, cikis)) {
    S.alternatif_yollar.push(yol);
    S.notlar.ekle('inceleme', 'Q07', 'Geçici 10/6 yolu normal yoldan erken sonuç veriyor; açık kurum statüsü ve kararla doğrulanmalı (R056).', ['R056']);
    S.kural_idleri.add('R055');
    S.kural_idleri.add('R056');
  } else {
    S.elenen_yollar.push({ yol: 'Geçici 10/6', neden: 'Normal yoldan daha erken sonuç vermiyor; normal yol 3 ay açık kurum şartıyla bekletilmez.', kural: 'R056' });
  }
}

function tamamla(S, ctx, { ksTarihi, cikis, dsTarihi = null, bihakkin, toplamGun, dsYok = false }) {
  S.kurumda_kalis_gun = Math.max(0, T.gunFarki(ctx.baslama, cikis));
  S.toplam_infaz_gun = Math.max(0, T.gunFarki(ctx.E, cikis));
  S.takvim = {
    infaza_baslama: ctx.baslama,
    etkin_baslangic: ctx.E,
    mahsup_gun: ctx.mahsup,
    kapalidan_aciga_hak_kazanma: S.acik_kurum?.dogrudan ? ctx.baslama : null,
    DSye_hak_kazanma: dsYok ? null : dsTarihi,
    kurumdan_cikis: cikis,
    kosullu_saliverilme: dsYok && ksTarihi === bihakkin ? null : ksTarihi,
    hak_ederek_tahliye: bihakkin,
    toplam_ceza_gun: toplamGun,
    ds_suresi_gun: dsYok ? 0 : Math.max(0, T.gunFarki(cikis, ksTarihi)),
    ks_sonrasi_denetim_gun: Math.max(0, T.gunFarki(ksTarihi, bihakkin)),
  };
  return S;
}

function muebbetSenaryo(kt, ctx, derece, ds) {
  const S = yeniSenaryo(derece);
  const { ilam, E } = ctx;
  const r30 = kt.p('R030');
  S.kural_idleri.add('R030');
  S.notlar.ekle('inceleme', 'R030', 'Müebbet hesapları özel dosya incelemesi gerektirir; oran çarpımı yerine kanuni süre kategorileri kullanılır.', ['R030']);

  if (ctx.cocuk === true) {
    S.uygulanabilir = derece === 'yok';
    S.neden = derece === 'yok' ? 'Çocuk hükümlüde müebbet koşullu salıverilme süreleri veritabanında yok.' : 'Suç 18 yaşından önce işlenmiş; tekerrür uygulanmaz (TCK 58/5).';
    S.hesaplanamadi = true;
    return S;
  }
  if (derece === 'ikinci') {
    S.hesaplanamadi = true;
    S.neden = 'İkinci tekerrürde müebbet koşullu salıverilme süresi veritabanında yer almıyor; hukuki inceleme gerekir.';
    return S;
  }
  const agir = ctx.ceza_turu === 'agirlastirilmis_muebbet';
  const alan = agir ? 'agirlastirilmis_muebbet_yil' : 'muebbet_yil';
  const kat = [{ ad: 'Genel (5275 m.107/2)', yil: r30.genel[alan] }];
  if (veya(ilam.orgut_kurma_yonetme ?? null, ilam.orgut_faaliyeti ?? null) === true) kat.push({ ad: 'Örgüt (5275 m.107/4)', yil: r30.orgut_107_4[alan] });
  if (ilam.teror_kanunu_kapsami === true) {
    kat.push({ ad: 'Terör (107/4 süreleri esas alındı)', yil: r30.orgut_107_4[alan] });
    S.notlar.ekle('inceleme', 'R032', 'Terör kapsamındaki müebbet cezalarında koşullu salıverilme yasağı (5275 m.107/16, geçici 2; 3713 m.17) ayrıca kontrol edilmeli.', ['R032']);
  }
  if (derece === 'birinci') kat.push({ ad: 'Tekerrür (5275 m.108/1)', yil: r30.tekerrur_108_1[alan] });
  const secilen = kat.reduce((a, b) => (b.yil > a.yil ? b : a));
  const ksTarihi = T.yilEkle(E, secilen.yil);
  iz(S, 'Müebbet koşullu salıverilme', `${agir ? 'Ağırlaştırılmış müebbet' : 'Müebbet'} — ${secilen.ad}: ${secilen.yil} yıl → ${T.trTarih(ksTarihi)}.`, ['R030']);
  S.ds_penceresi = ds;
  const dsPencereTarihi = ds.yil === null ? E : T.yilEkle(ksTarihi, -ds.yil);
  iz(S, 'Denetimli serbestlik penceresi', `${ds.ad} → ${T.trTarih(dsPencereTarihi)}.`, [ds.kural]);
  S.acik_kurum = acikKurumDegerlendir(kt, ctx, derece, S.notlar);
  S.alt_sinir = true;
  S.notlar.ekle('inceleme', 'Q01', 'Müebbette DS için açık kuruma ayrılma şartı yönetmelikle belirlenir ve doğrulanmadı (E005).', ['R061']);
  S.kural_idleri.add('R061');
  S.kurumda_kalis_gun = Math.max(0, T.gunFarki(ctx.baslama, dsPencereTarihi));
  S.toplam_infaz_gun = Math.max(0, T.gunFarki(E, dsPencereTarihi));
  S.takvim = {
    infaza_baslama: ctx.baslama,
    etkin_baslangic: E,
    mahsup_gun: ctx.mahsup,
    kapalidan_aciga_hak_kazanma: null,
    DSye_hak_kazanma: dsPencereTarihi,
    kurumdan_cikis: dsPencereTarihi,
    kosullu_saliverilme: ksTarihi,
    hak_ederek_tahliye: null,
    toplam_ceza_gun: null,
    ds_suresi_gun: T.gunFarki(dsPencereTarihi, ksTarihi),
    ks_sonrasi_denetim_gun: null,
  };
  return S;
}

// ---------------------------------------------------------------------------
// Özel infaz, başvuru yolları ve bilgi notları
// ---------------------------------------------------------------------------

function ozelInfazNotlari(kt, ctx) {
  const notlar = [];
  const { ilam, vaka } = ctx;
  if (ctx.ceza_turu !== 'sureli_hapis' || !ctx.ceza) return notlar;
  const r70 = kt.p('R070');
  if (!T.once(ctx.hesapTarihi, r70.yururluk)) {
    const az = (yil) => T.cezaKarsilastir(ctx.ceza, { yil, ay: 0, gun: 0 }, ctx.E) <= 0;
    const gh = r70.gece_hafta_sonu;
    const taksirleOldurme = ctx.kast === 'taksir' && maddeListesindeMi(ilam, [85]) === true;
    if (ctx.kast === 'taksir' ? az(gh.taksirli_azami_yil) && !taksirleOldurme : az(gh.kasitli_azami_yil)) {
      notlar.push({ baslik: 'Gece/hafta sonu infaz', metin: `Toplam ceza ${ctx.kast === 'taksir' ? gh.taksirli_azami_yil : gh.kasitli_azami_yil} yılı aşmadığından infaz hâkimi kararıyla hafta sonu veya gece infazı mümkün olabilir (5275 m.110/1; 110/9 istisnaları ayrıca).`, kural: 'R070' });
    }
    const k = r70.konutta;
    let azami = null;
    let kim = null;
    const yas = ctx.yasHesap;
    if (yas !== null && yas >= 80) [azami, kim] = [k['80_yasini_bitirmis_azami_yil'], '80 yaşını bitirmiş'];
    else if (yas !== null && yas >= 75) [azami, kim] = [k['75_yasini_bitirmis_azami_yil'], '75 yaşını bitirmiş'];
    else if (yas !== null && yas >= 70) [azami, kim] = [k['70_yasini_bitirmis_azami_yil'], '70 yaşını bitirmiş'];
    else if (vaka.cinsiyet === 'kadin' || (yas !== null && yas < 18) || (yas !== null && yas >= 65)) {
      [azami, kim] = [k.kadin_cocuk_65_yasini_bitirmis_azami_yil, vaka.cinsiyet === 'kadin' ? 'kadın' : yas < 18 ? 'çocuk' : '65 yaşını bitirmiş'];
    }
    if (azami !== null && az(azami)) {
      notlar.push({ baslik: 'Konutta infaz', metin: `${kim} hükümlüde toplam ceza ${azami} yılı aşmadığından infaz hâkimi kararıyla konutta infaz mümkün olabilir (5275 m.110/2; 110/9 istisnaları ayrıca).`, kural: 'R070' });
    }
    const r71 = kt.p('R071');
    if (vaka.cinsiyet === 'kadin' && az(r71.dogum_baglantili_toplam_ceza_azami_yil)) {
      notlar.push({ baslik: 'Doğum bağlantılı konutta infaz', metin: `Toplam ceza ${r71.dogum_baglantili_toplam_ceza_azami_yil} yılı aşmıyor; gebelik/doğum hâlinde konutta infaz olanağı ayrıca değerlendirilebilir (5275 m.110).`, kural: 'R071' });
    }
  }
  if (vaka.agir_hasta_yalniz_yasayamaz === true) {
    notlar.push({ baslik: 'Ağır hastalık', metin: 'Ağır hastalık/engellilik nedeniyle konutta infaz (5275 m.110/3) ve infazın ertelenmesi (m.16) rapor ve karar gerektirir; ceza miktarından otomatik sonuç çıkarılmaz.', kural: 'R071' });
  }
  if (ilam.teror_kanunu_kapsami === true || ilam.orgut_faaliyeti === true || ilam.orgut_kurma_yonetme === true) {
    const r75 = kt.p('R075');
    notlar.push({ baslik: '7595 sayılı Kanun', metin: `İnfaz ertelemesi, kanunda belirtilen MGK kararının Resmî Gazete'de yayımına ve kişisel şartlara bağlıdır; tetikleyicinin gerçekleştiği doğrulanmadı (${r75.tetikleyici_gerceklesti_mi === null ? 'bilinmiyor' : r75.tetikleyici_gerceklesti_mi}). Otomatik erteleme uygulanmaz (Q08).`, kural: 'R075' });
  }
  return notlar;
}

function rejimOzeti(kt, ctx) {
  if (!ctx.suc) return [];
  return kt.db.tarih_esikleri.map((t) => {
    const c = T.karsilastir(ctx.suc, t.tarih);
    return { esik_id: t.esik_id, tarih: t.tarih, anlam: t.anlam, konum: c < 0 ? 'once' : c > 0 ? 'sonra' : 'ayni_gun' };
  });
}

// ---------------------------------------------------------------------------
// Toplama (K32): farklı rejimlerdeki ilamlar tek oranla hesaplanmaz.
// ---------------------------------------------------------------------------

export function toplamaDegerlendir(kt, ilamlar) {
  if (!Array.isArray(ilamlar) || ilamlar.length < 2) return null;
  const g6 = kt.p('R050').suc_tarihi.lte;
  const asg = kt.p('R042').suc_tarihi.gte;
  const rejimler = ilamlar.map((i) => ({
    gecici6: !T.sonra(i.suc_tarihi, g6),
    onda_bir: !T.once(i.suc_tarihi, asg),
  }));
  const karma = rejimler.some((r) => r.gecici6 !== rejimler[0].gecici6 || r.onda_bir !== rejimler[0].onda_bir);
  return {
    durum: 'hukuki_inceleme_gerekli',
    karma_rejim: karma,
    tum_toplama_gecici6_uygula: false,
    tum_toplama_onda_bir_uygula: false,
    her_ilam_ayri_kayit: kt.p('R005').her_ilam_ayri_kayit,
    hata_kodlari: karma ? ['E007'] : [],
    engelleyici_konu_idleri: ['Q10'],
    mesaj: karma
      ? 'İlamlar farklı tarih rejimlerinde; geçici 6 ve onda bir şartı bütün toplama uygulanamaz. Her ilam kendi rejimiyle ayrı hesaplanmalı, toplama kararı infaz hâkimliğinden alınmalı (R005, R031).'
      : 'Birden çok ilamda toplama kararı ve 107/3-4 üst sınırları ayrıca kontrol edilmelidir (R005, R031).',
  };
}

// ---------------------------------------------------------------------------
// Ana giriş
// ---------------------------------------------------------------------------

export function hesapla(dbVeyaKt, vaka = {}) {
  const kt = dbVeyaKt instanceof KuralTabani ? dbVeyaKt : new KuralTabani(dbVeyaKt);
  const notlar = new Notlar();
  const ctx = baglamKur(kt, vaka, notlar);

  const cikti = {
    durum: null,
    paket_surumu: kt.surum,
    hesap_tarihi: ctx.hesapTarihi,
    hukuki_kabuller: [],
    eksik_veri: ctx.eksik,
    engelleyici_konu_idleri: [],
    hata_kodlari: [],
    rejim: rejimOzeti(kt, ctx),
    temel_oran: null,
    ds_penceresi: null,
    tekerrur: null,
    senaryolar: {},
    secili_senaryo: null,
    takvim: null,
    kurumda_kalacak_sure_gun: null,
    ozel_infaz_notlari: [],
    elenen_yollar_ve_nedenleri: [],
    notlar: [],
    hesap_izi: [],
    secilen_kural_idleri: [],
    kaynak_idleri: [],
    toplama: toplamaDegerlendir(kt, vaka.suclar_ve_ilamlar),
    sonuc_etiketi: kt.db.cikti_modeli.sonuc_etiketi,
  };

  // Tekerrür tespiti eksik veri durumunda da yapılabilir.
  const tek = tekerrurTespit(kt, { ...vaka, ilam: ctx.ilam });
  cikti.tekerrur = tek;

  if (ctx.eksik.length) {
    cikti.durum = 'eksik_veri';
    cikti.hata_kodlari = [...new Set(ctx.eksik.map((e) => e.kod))];
    return cikti;
  }

  if (ctx.ceza_turu === 'tazyik' || ctx.ceza_turu === 'diger') {
    cikti.durum = 'hukuki_inceleme_gerekli';
    notlar.ekle('inceleme', 'Q06', 'Tazyik hapsi ve özel kanun cezaları genel hapis hesabına sokulmaz; ayrı mevzuat incelemesi gerekir.', ['R032']);
    cikti.notlar = notlar.liste;
    cikti.engelleyici_konu_idleri = ['Q06'];
    return cikti;
  }

  genelVarsayimlar(kt, ctx, notlar);
  ctx.temel = ctx.ceza_turu === 'sureli_hapis' ? temelOranBelirle(kt, ctx, notlar) : null;
  cikti.temel_oran = ctx.temel && { oran: ctx.temel.oran, kural_id: ctx.temel.kural, neden: ctx.temel.neden, adaylar: ctx.temel.adaylar };
  const ds = dsPenceresiBelirle(kt, ctx, notlar);
  cikti.ds_penceresi = ds;
  ctx.gunAgirligi = gunAgirligiBelirle(kt, ctx, notlar);

  for (const { anahtar } of SENARYOLAR) {
    const S = ctx.ceza_turu === 'sureli_hapis' ? sureliSenaryo(kt, ctx, anahtar, tek, ds) : muebbetSenaryo(kt, ctx, anahtar, ds);
    const birlesik = [...notlar.liste, ...S.notlar.liste];
    const enYuksek = birlesik.reduce((m, n) => (SEVIYE_SIRASI[n.seviye] > SEVIYE_SIRASI[m] ? n.seviye : m), 'bilgi');
    S.durum = !S.uygulanabilir ? 'uygulanamaz' : S.hesaplanamadi ? 'hukuki_inceleme_gerekli' : enYuksek === 'inceleme' || enYuksek === 'eksik' ? 'hukuki_inceleme_gerekli' : 'varsayimli_senaryo';
    S.notlar = S.notlar.liste;
    S.kural_idleri = [...S.kural_idleri];
    cikti.senaryolar[anahtar] = S;
  }

  // Seçili senaryo: önce hükümdeki tekerrür, yoksa belgelerden belirlenen aday.
  const gecerli = ['yok', 'birinci', 'ikinci'];
  const hukum = ctx.ilam.hukumdeki_tekerrur;
  let secili = gecerli.includes(hukum) ? hukum : null;
  if (!secili && gecerli.includes(tek.belgelerden_aday_tespit)) {
    secili = tek.belgelerden_aday_tespit;
    notlar.ekle('varsayim', 'R014', `Hükümdeki tekerrür girilmedi; belgelerden belirlenen aday (${adayMetni(secili)}) gösterildi. İnfaz kesin hükme göre yapılır.`, ['R014']);
  }
  if (!secili && tek.belgelerden_aday_tespit === 'uygulanmaz') secili = 'yok';
  cikti.secili_senaryo = secili;

  for (const u of tek.uyarilar) {
    notlar.ekle(u.kod === 'E004' || u.kod === 'R016' ? 'inceleme' : 'varsayim', u.kod, u.mesaj, [u.kod.startsWith('R') ? u.kod : 'R014']);
  }

  const S = secili ? cikti.senaryolar[secili] : null;
  if (!secili) {
    cikti.durum = 'eksik_veri';
    cikti.eksik_veri.push({ kod: 'E002', alan: 'hukumdeki_tekerrur', mesaj: 'Tekerrür durumu belirlenmedi: hükümdeki tekerrürü seçin veya önceki mahkûmiyetleri girin. Üç senaryo karşılaştırmalı gösterilmektedir.' });
  } else if (!S.uygulanabilir) {
    cikti.durum = 'hukuki_inceleme_gerekli';
  } else {
    cikti.durum = S.durum;
    cikti.takvim = S.takvim;
    if (S.durum === 'varsayimli_senaryo') cikti.kurumda_kalacak_sure_gun = S.kurumda_kalis_gun;
  }
  if (notlar.liste.some((n) => n.seviye === 'inceleme') && cikti.durum === 'varsayimli_senaryo') {
    cikti.durum = 'hukuki_inceleme_gerekli';
  }

  cikti.ozel_infaz_notlari = ozelInfazNotlari(kt, ctx);
  cikti.elenen_yollar_ve_nedenleri = [
    ...ds.elenen,
    { yol: 'Geçici 10/2', neden: 'Suç tarihine değil, 31/07/2023 tarihindeki izin statüsüne bağlıdır; bu araçta hesaplanmaz.', kural: 'R054' },
  ];
  cikti.notlar = notlar.liste;

  const tumNotlar = [...notlar.liste, ...Object.values(cikti.senaryolar).flatMap((s) => s.notlar || [])];
  cikti.hukuki_kabuller = [...new Set(notlar.liste.filter((n) => n.seviye === 'varsayim').map((n) => n.mesaj))];
  // Seçili senaryo varsa yalnız onun engelleri; yoksa üç senaryonun tamamı.
  const ilgiliNotlar = S ? [...notlar.liste, ...S.notlar] : tumNotlar;
  const kodlar = (liste) => liste.flatMap((n) => [n.kod, ...(n.mesaj.match(/\b[QE]\d{2,3}\b/g) || [])]);
  const ayikla = (liste, re) => [...new Set(kodlar(liste).filter((k) => re.test(k)))].sort();
  cikti.engelleyici_konu_idleri = ayikla(ilgiliNotlar, /^Q\d+$/);
  cikti.hata_kodlari = ayikla(ilgiliNotlar, /^E\d+$/);
  cikti.tum_senaryolar_engelleyici_konu_idleri = ayikla(tumNotlar, /^Q\d+$/);

  const kuralIdleri = new Set(['R001', 'R002', 'R003', 'R006', 'R062']);
  if (ctx.temel) ctx.temel.adaylar.forEach((a) => kuralIdleri.add(a.kural));
  ds.adaylar.forEach((a) => kuralIdleri.add(a.kural));
  Object.values(cikti.senaryolar).forEach((s) => s.kural_idleri.forEach((k) => kuralIdleri.add(k)));
  tumNotlar.forEach((n) => n.kurallar.forEach((k) => /^R\d+$/.test(k) && kuralIdleri.add(k)));
  cikti.ozel_infaz_notlari.forEach((n) => kuralIdleri.add(n.kural));
  cikti.secilen_kural_idleri = [...kuralIdleri].filter((id) => kt.kurallar.has(id)).sort();
  cikti.kaynak_idleri = kt.kaynaklariTopla(cikti.secilen_kural_idleri).map((s) => s.kaynak_id);
  cikti.hesap_izi = Object.values(cikti.senaryolar).flatMap((s) => s.izler.map((i) => ({ senaryo: s.anahtar, ...i })));
  return cikti;
}

export { KuralTabani };
