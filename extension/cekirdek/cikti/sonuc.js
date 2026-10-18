// Ana giriş: vaka → çıktı modeli (kural_tabani.cikti_modeli).
//
// Bu modül hesap modüllerini birleştirir; kendisi hukuki kural içermez. Saf ve
// belirlenimcidir: aynı paket + aynı vaka + aynı hesap tarihi → aynı çıktı.

import { gunEkle, gunFarki, cezaEkle, yasHesapla, once, sonra, karsilastir, bugunIstanbul, trTarih, cezaKarsilastir } from '../zaman/takvim.js';
import { profilOlustur } from '../zaman/profil.js';
import { vakaNormallestir } from '../baglam/vaka.js';
import { kararBaglami, infazCezaTuru, varsayimlariUygula } from '../baglam/karar-baglami.js';
import { KararMotoru } from '../karar/motor.js';
import { Notlar, durumBelirle, kodlariTopla } from './notlar.js';
import { mahsupHesapla } from '../hesap/mahsup.js';
import { senaryoHesapla } from '../hesap/senaryo.js';
import { tekerrurTespit, adayMetni } from '../tekerrur/tespit.js';
import { cekDegerlendir } from '../cek/cek.js';
import { toplamaSenaryosu, toplamaOnDenetimi, ilamEtiketi } from '../toplama/toplama.js';

export const SENARYOLAR = [
  { anahtar: 'yok', baslik: 'Tekerrürsüz' },
  { anahtar: 'birinci', baslik: '1. Tekerrür (mükerrir)' },
  { anahtar: 'ikinci', baslik: '2. Tekerrür' },
];

const SURELI_TURLER = ['sureli_hapis', 'adli_paradan_cevrilen_hapis'];

// Bu sürümün hesaplamadığı ve sonuçta açıkça listelenen dallar.
export const DESTEKLENMEYEN_DALLAR = [
  'Müebbet içeren toplama (5275 m.107/3-a…d, 107/4) ve toplamada çocuk gün ağırlığı',
  'Firar, izin, erteleme ve başka tutuklama gibi infaz kesintileri (V06)',
  '01/06/2005 öncesi suçlarda 647/765 lehe kanun karşılaştırması (A02)',
  'Geçici 10/2 (31/07/2023 izin statüsü) yolu',
  '7595 sayılı Kanun özel erteleme yolu (A05)',
  'Disiplin cezası, iyi hâlin kaldırılması ve yeniden değerlendirme süreleri (R123-R125)',
  'Çek m.6 bedel + faiz tutarı (dönemsel faiz oranı tablosu pakette yok; A03)',
];

function ortamKur(kt, vaka, ilam, secenekler, notlar) {
  const bugun = secenekler.bugun || bugunIstanbul();
  const hesapTarihi = vaka.hesap_tarihi || bugun;
  if (!vaka.hesap_tarihi) notlar.ekle('bilgi', 'hesap_tarihi', `Hesap tarihi olarak ${trTarih(bugun)} kullanıldı; norm sürümleri bu tarihe göre seçildi.`, []);
  const baslama = vaka.infaza_baslama_tarihi || hesapTarihi;
  if (!vaka.infaza_baslama_tarihi) notlar.ekle('varsayim', 'infaza_baslama_tarihi', `İnfaza başlama tarihi girilmedi; hesap tarihi (${trTarih(hesapTarihi)}) başlangıç kabul edildi. Takvim tarihleri bu varsayıma göredir.`, ['R003']);
  const profil = profilOlustur(vaka.profil || {});
  const mahsup = mahsupHesapla(kt, vaka.mahsup_kayitlari, profil, notlar);
  const E = gunEkle(baslama, -mahsup.gun);
  const ceza = ilam.hukumdeki_sonuc_ceza;
  const bihakkin = ceza ? cezaEkle(E, ceza) : null;
  return {
    kt,
    vaka,
    ilam,
    profil,
    hesapTarihi,
    baslama,
    mahsup,
    E,
    ceza,
    bihakkin,
    toplamGun: bihakkin ? gunFarki(E, bihakkin) : null,
    sucYasi: vaka.dogum_tarihi && ilam.suc_tarihi ? yasHesapla(vaka.dogum_tarihi, ilam.suc_tarihi) : null,
    hesapYasi: vaka.dogum_tarihi ? yasHesapla(vaka.dogum_tarihi, hesapTarihi) : null,
  };
}

function eksikVeri(ilam, tur) {
  const eksik = [];
  if (!ilam) return [{ kod: 'E011', alan: 'suclar_ve_ilamlar', mesaj: 'İlam bilgisi yok.' }];
  if (!ilam.suc_tarihi) eksik.push({ kod: 'E001', alan: 'suc_tarihi', mesaj: 'Suç tarihi girilmedi veya geçersiz (YYYY-AA-GG).' });
  if ((tur === null || SURELI_TURLER.includes(tur)) && !ilam.hukumdeki_sonuc_ceza) {
    eksik.push({ kod: 'E001', alan: 'hukumdeki_sonuc_ceza', mesaj: 'Hükümdeki sonuç ceza (yıl/ay/gün) girilmedi.' });
  }
  return eksik;
}

function genelNotlar(kt, ortam, notlar) {
  const { ilam, vaka } = ortam;
  if (!ilam.kesinlesme_tarihi) notlar.ekle('varsayim', 'R002', 'Kesinleşme tarihi girilmedi; hükmün kesinleştiği varsayıldı. Kesinleşmemiş hüküm infaz edilemez.', ['R002']);
  else if (sonra(ilam.kesinlesme_tarihi, ortam.hesapTarihi)) notlar.ekle('inceleme', 'E011', 'Kesinleşme tarihi hesap tarihinden sonra; infaz edilebilir kesin hüküm yok.', ['R002']);
  notlar.ekle('varsayim', 'A01', `Hesap profili ${ortam.profil.id}: kesirli gün ${ortam.profil.gun_kusurati === 'yukari' ? 'yukarı' : 'aşağı'} yuvarlanır, yönetmelikteki "ay" ${ortam.profil.kurum_ayi === '30_gun' ? '30 gün' : 'takvim ayı'} sayılır. Profil gerçek müddetnamelerle kabul testinden geçmedi (A01).`, ['R003']);
  notlar.ekle('varsayim', 'V06', 'Başka ilam, tutuklama, disiplin cezası veya infaz kesintisi olmadığı varsayıldı; bir ilamın bitmesi kişinin kurumdan çıkabileceği anlamına gelmez (V06).', ['R005', 'R126']);
  if (once(ilam.suc_tarihi, kt.esik('T01'))) {
    notlar.ekle('inceleme', 'E010', '01/06/2005 öncesi suç: 647 ve 765 sayılı mülga kanunlarla lehe kanun karşılaştırması gerekir; sonuç 5275 rejimine göre gösterildi (A02, E014).', ['R001']);
  } else if (once(ilam.suc_tarihi, kt.esik('T05'))) {
    notlar.ekle('varsayim', 'R001', '15/04/2020 öncesi suç: 7242 ile gelen koşullu salıverilme oranlarının lehe olduğu kabul edildi (TCK 7/2-3; koşullu salıverilme ve tekerrür lehe kanun incelemesine tabidir).', ['R001']);
  }
  // V02: çevirme verisi çelişkisi
  if (ilam.infazdaki_ceza_turu === 'adli_paradan_cevrilen_hapis' && ilam.para_cezasindan_cevrilme === false) {
    notlar.ekle('inceleme', 'V02', 'İnfazdaki ceza türü "adli paradan çevrilen hapis" iken çevirme yok beyanı var; belge çelişkisi giderilmeden kesin sonuç verilmez (V02).', ['R044']);
  }
  if (ilam.kanun_madde_fikra_bent.kanun === 2937) {
    notlar.ekle(ilam.mit_2937_kapsami_dogrulandi === true ? 'bilgi' : 'varsayim', 'A03', '2937 sayılı Kanun suç maddeleri pakette bulunmuyor; 107/2 oran atfı hükümdeki kapsam doğrulamasına bağlıdır (A03).', ['R021']);
  }
  if (vaka.suclar_ve_ilamlar.length > 1) {
    notlar.ekle('inceleme', 'E007', 'Birden çok ilam: her ilam kendi rejimiyle ayrı hesaplanır, toplama kararı ve 107/3-4 üst sınırları ayrıca kontrol edilir. Bu sonuç yalnız ilk ilam içindir (A04).', ['R005', 'R031']);
  }
}

function ozelInfazNotlari(kt, ortam, baglam, derece) {
  const n = [];
  const { ilam, vaka } = ortam;
  const tur = baglam.ilam.ceza_turu;
  if (!SURELI_TURLER.includes(tur) || !ortam.ceza) return n;
  const az = (yil) => cezaKarsilastir(ortam.ceza, { yil, ay: 0, gun: 0 }, ortam.E) <= 0;
  const r70 = kt.p('R070');
  const taksir = baglam.ilam.kast_grubu === 'taksir';
  if (!once(ortam.hesapTarihi, r70.yururluk)) {
    const gh = r70.gece_hafta_sonu;
    const taksirleOldurme = taksir && ilam.kanun_madde_fikra_bent.kanun === 5237 && ilam.kanun_madde_fikra_bent.madde === '85';
    if (taksir ? az(gh.taksirli_azami_yil) && !taksirleOldurme : az(gh.kasitli_azami_yil)) {
      n.push({ baslik: 'Gece veya hafta sonu infaz', metin: `Toplam ceza ${taksir ? gh.taksirli_azami_yil : gh.kasitli_azami_yil} yılı aşmadığından infaz hâkimi kararıyla hafta sonu veya gece infazı mümkün olabilir (5275 m.110/1; 110/9 istisnaları ayrıca).`, kural: 'R070' });
    }
    const k = r70.konutta;
    const yas = ortam.hesapYasi;
    let azami = null;
    let kim = null;
    if (yas !== null && yas >= 80) [azami, kim] = [k['80_yasini_bitirmis_azami_yil'], '80 yaşını bitirmiş'];
    else if (yas !== null && yas >= 75) [azami, kim] = [k['75_yasini_bitirmis_azami_yil'], '75 yaşını bitirmiş'];
    else if (yas !== null && yas >= 70) [azami, kim] = [k['70_yasini_bitirmis_azami_yil'], '70 yaşını bitirmiş'];
    else if (vaka.cinsiyet === 'kadin' || (yas !== null && (yas < 18 || yas >= 65))) {
      [azami, kim] = [k.kadin_cocuk_65_yasini_bitirmis_azami_yil, vaka.cinsiyet === 'kadin' ? 'kadın' : yas < 18 ? 'çocuk' : '65 yaşını bitirmiş'];
    }
    if (azami !== null && az(azami)) n.push({ baslik: 'Konutta infaz', metin: `${kim} hükümlüde toplam ceza ${azami} yılı aşmadığından infaz hâkimi kararıyla konutta infaz mümkün olabilir (5275 m.110/2; yönetmelikteki eski eşik kanunu daraltmaz — N02).`, kural: 'R070' });
    const r71 = kt.p('R071');
    if (vaka.cinsiyet === 'kadin' && az(r71.dogum_baglantili_toplam_ceza_azami_yil)) {
      n.push({ baslik: 'Doğum bağlantılı konutta infaz', metin: `Toplam ceza ${r71.dogum_baglantili_toplam_ceza_azami_yil} yılı aşmıyor; gebelik/doğum hâlinde konutta infaz olanağı ayrıca değerlendirilebilir (5275 m.110).`, kural: 'R071' });
    }
  }
  const r119 = kt.p('R119');
  // R119 istisnaları: terör, örgüt faaliyeti, cinsel dokunulmazlık, mükerrirlere özgü rejim
  const istisna = baglam.ilam.teror === true || baglam.ilam.orgut_faaliyeti === true || baglam.ilam.cinsel_dokunulmazlik === true || derece === 'birinci' || derece === 'ikinci';
  if (!istisna && tur === 'sureli_hapis' && (taksir ? az(r119.taksirli_azami_yil) : az(r119.kasitli_azami_yil))) {
    n.push({ baslik: 'İstem üzerine infazın ertelenmesi', metin: `Toplam ceza ${taksir ? r119.taksirli_azami_yil : r119.kasitli_azami_yil} yılı aşmıyor; çağrı üzerine gelinmesi şartıyla her defasında en çok ${r119.her_defa_azami_yil} yıl, en fazla ${r119.en_fazla_kez} kez erteleme istenebilir (5275 m.17). Erteleme infazdan sayılmaz.`, kural: 'R119' });
  }
  if (vaka.cinsiyet === 'kadin') {
    const r120 = kt.p('R120');
    n.push({ baslik: 'Gebelik/doğum ve hasta çocuk ertelemesi', metin: `Gebe veya doğumdan sonra ${r120.gebe_ve_dogumdan_sonra_ay} ay erteleme (5275 m.16); toplam ${r120['16A_kadin_toplam_hapis_azami_yil']} yıla kadar hapiste 18 yaş altı ağır hasta çocuk için erteleme (m.16/A). Rapor ve karar gerekir.`, kural: 'R120' });
  }
  if (vaka.rapor_105A_3_b === true) {
    n.push({ baslik: 'Ağır hastalık', metin: 'Ağır hastalık/engellilik nedeniyle konutta infaz (5275 m.110/3) ve infazın ertelenmesi (m.16) rapor ve karar gerektirir; ceza miktarından otomatik sonuç çıkarılmaz.', kural: 'R071' });
  }
  if (baglam.ilam.teror === true || baglam.ilam.orgut_faaliyeti === true || baglam.ilam.orgut_kurma_yonetme === true) {
    n.push({ baslik: '7595 sayılı Kanun', metin: 'İnfaz ertelemesi, kanunda belirtilen MGK kararının Resmî Gazete\'de yayımına ve kişisel şartlara bağlıdır; tetikleyicinin gerçekleştiği doğrulanmadı. Otomatik erteleme uygulanmaz (A05).', kural: 'R075' });
  }
  return n;
}

function rejimOzeti(kt, ilam) {
  if (!ilam?.suc_tarihi) return [];
  const cek = ilam.kanun_madde_fikra_bent.kanun === 5941;
  return kt.paket.tarih_esikleri
    .filter((t) => cek || !['T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18'].includes(t.esik_id))
    .map((t) => {
      const c = karsilastir(ilam.suc_tarihi, t.tarih);
      return { esik_id: t.esik_id, tarih: t.tarih, anlam: t.anlam, konum: c < 0 ? 'once' : c > 0 ? 'sonra' : 'ayni_gun' };
    })
    .sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
}

export function toplamaDegerlendir(kt, ilamlar) {
  if (!Array.isArray(ilamlar) || ilamlar.length < 2) return null;
  const g6 = kt.p('R050').suc_tarihi.lte;
  const asg = kt.p('R042').suc_tarihi.gte;
  const rejimler = ilamlar.map((i) => ({ gecici6: !sonra(i.suc_tarihi, g6), onda_bir: !once(i.suc_tarihi, asg) }));
  const karma = rejimler.some((r) => r.gecici6 !== rejimler[0].gecici6 || r.onda_bir !== rejimler[0].onda_bir);
  return {
    durum: 'hukuki_inceleme_gerekli',
    karma_rejim: karma,
    tum_toplama_gecici6_uygula: false,
    tum_toplama_onda_bir_uygula: false,
    her_ilam_ayri_kayit: kt.p('R005').her_ilam_ayri_kayit,
    hata_kodlari: karma ? ['E007'] : [],
    mesaj: karma
      ? 'İlamlar farklı tarih rejimlerinde; geçici 6 ve onda bir şartı bütün toplama uygulanamaz. Her ilam kendi rejimiyle ayrı hesaplanmalı, toplama kararı infaz hâkimliğinden alınmalı (R005, R031).'
      : 'Birden çok ilamda toplama kararı ve 107/3-4 üst sınırları ayrıca kontrol edilmelidir (R005, R031).',
  };
}

// Birden çok ilam: toplama senaryosu tek senaryo ("birlesik") olarak çıktıya yazılır.
function toplamaCiktisi(kt, motor, vaka, cikti, secenekler, notlar) {
  const on = toplamaOnDenetimi(vaka.suclar_ve_ilamlar);
  if (on.eksik.length) {
    cikti.durum = 'eksik_veri';
    cikti.eksik_veri = on.eksik;
    cikti.hata_kodlari = ['E001'];
    return cikti;
  }
  if (on.engel) {
    cikti.durum = 'hukuki_inceleme_gerekli';
    cikti.notlar = [{ seviye: 'inceleme', kod: 'E007', mesaj: on.engel, kurallar: ['R005', 'R031'] }];
    return cikti;
  }
  let sonuc;
  try {
    sonuc = toplamaSenaryosu(kt, motor, vaka, secenekler, notlar);
  } catch (hata) {
    if (!(hata instanceof RangeError)) throw hata;
    cikti.durum = 'eksik_veri';
    cikti.eksik_veri.push({ kod: 'GIRDI', alan: 'sure', mesaj: 'Toplam ceza veya mahsup hesaplanabilir takvim aralığını aşıyor.' });
    return cikti;
  }
  const { S, ortak, toplamCeza } = sonuc;
  notlar.ekle('varsayim', 'A01', `Hesap profili ${ortak.profil.id}: kesirli gün ${ortak.profil.gun_kusurati === 'yukari' ? 'yukarı' : 'aşağı'} yuvarlanır, yönetmelikteki "ay" ${ortak.profil.kurum_ayi === '30_gun' ? '30 gün' : 'takvim ayı'} sayılır (A01).`, ['R003']);
  const varsayimNotlari = S.varsayimlar.map((v) => ({ seviye: 'varsayim', kod: v.kod || v.alan, mesaj: v.mesaj, kurallar: v.kurallar }));
  S.durum = S.durum || durumBelirle(notlar.liste, S.notlar.liste, varsayimNotlari);
  S.notlar = S.notlar.liste;
  S.kural_idleri = [...S.kural_idleri];
  cikti.hesap_tarihi = ortak.hesapTarihi;
  cikti.hesap_profili_id = ortak.profil.id;
  cikti.senaryolar = { birlesik: S };
  cikti.secili_senaryo = 'birlesik';
  cikti.durum = S.hesaplanamadi ? 'hukuki_inceleme_gerekli' : S.durum;
  cikti.takvim = S.takvim;
  cikti.varsayimlar = S.varsayimlar;
  cikti.belirsiz_kosullar = S.belirsiz_kosullar;
  cikti.DS_yollari = S.ds_yollari;
  cikti.acik_kurum_yollari = S.acik_kurum ? [S.acik_kurum] : [];
  cikti.gerekli_kararlar = S.gerekli_kararlar;
  if (cikti.durum === 'varsayimli_senaryo') cikti.kurumda_kalacak_sure_gun = S.kurumda_kalis_gun;
  const ilamlar = vaka.suclar_ve_ilamlar;
  const tumSonra = ilamlar.every((i) => i.suc_tarihi);
  cikti.toplama = {
    ilam_sayisi: ilamlar.length,
    toplam_ceza: toplamCeza,
    toplam_gun: ortak.toplamGun,
    ks_ham_gun: S.ks_ham_gun,
    ks_gun: S.ks_gun,
    ilamlar: (S.ilamlar || []).map((k) => ({ ilam_id: k.ilam_id, sira: k.sira, etiket: k.etiket, suc_tarihi: k.suc_tarihi, ceza: k.ceza, gun: k.gun, tekerrur: k.tekerrur, oran: k.oran, ks_ham_gun: k.ks_ham_gun, neden: k.neden, para_hapis: k.para_hapis, asgari_kurum_uygulanir: k.asgari_kurum_uygulanir, belirsiz_kosullar: k.belirsiz_kosullar })),
    rejim: tumSonra ? toplamaDegerlendir(kt, ilamlar) : null,
  };
  cikti.rejim = [];
  cikti.notlar = notlar.liste;
  const tumNotlar = [...notlar.liste, ...S.notlar];
  cikti.hukuki_kabuller = [...new Set([...notlar.liste.filter((n) => n.seviye === 'varsayim').map((n) => n.mesaj), ...S.varsayimlar.map((v) => v.mesaj)])];
  cikti.engelleyici_konu_idleri = kodlariTopla(tumNotlar.filter((n) => n.seviye === 'inceleme' || n.kod === 'A01'), ['A']);
  cikti.hata_kodlari = kodlariTopla(tumNotlar, ['E']);
  const kurallar = new Set(['R001', 'R002', 'R003', 'R005', 'R006', 'R062', 'R126', ...S.kural_idleri]);
  for (const n of tumNotlar) n.kurallar.forEach((k) => /^R\d+$/.test(k) && kurallar.add(k));
  cikti.secilen_kural_idleri = [...kurallar].filter((id) => kt.kurallar.has(id)).sort();
  cikti.uygulanan_madde_idleri = [...new Set(cikti.secilen_kural_idleri.flatMap((id) => kt.kural(id).madde_referanslari || []))];
  cikti.kural_kanit_idleri = cikti.secilen_kural_idleri.flatMap((id) => kt.kural(id).kanit_kimlikleri || []);
  cikti.kaynak_idleri = kt.kaynaklariTopla(cikti.secilen_kural_idleri).map((s) => s.kaynak_id);
  cikti.hesap_izi = S.izler.map((i) => ({ senaryo: 'birlesik', ...i }));
  return cikti;
}

export function hesapla(kt, girdi = {}, secenekler = {}) {
  const motor = new KararMotoru(kt);
  const { vaka, sorunlar } = vakaNormallestir(girdi);
  const notlar = new Notlar();
  for (const s of sorunlar) notlar.ekle('inceleme', 'GIRDI', `${s.alan}: ${s.mesaj}`, []);
  const ilam = vaka.suclar_ve_ilamlar[0] || null;
  const tur = ilam ? infazCezaTuru(ilam) : null;

  const cikti = {
    durum: null,
    paket_surumu: kt.surum,
    veri_paketi_sha256: kt.sha256,
    hesap_profili_id: null,
    hesap_tarihi: null,
    vaka,
    girdi_sorunlari: sorunlar,
    hukuki_kabuller: [],
    varsayimlar: [],
    eksik_veri: eksikVeri(ilam, tur),
    belirsiz_kosullar: [],
    engelleyici_konu_idleri: [],
    hata_kodlari: [],
    norm_cakismalari: [],
    rejim: rejimOzeti(kt, ilam),
    tekerrur: null,
    senaryolar: {},
    secili_senaryo: null,
    temel_oran: null,
    oran_adaylari: [],
    tekerrur_sonrasi_sure: null,
    DS_yollari: [],
    acik_kurum_yollari: [],
    takvim: null,
    kurumda_kalacak_sure_gun: null,
    gerekli_kararlar: [],
    desteklenmeyen_dallar: DESTEKLENMEYEN_DALLAR,
    karar_dugumu_sonuclari: [],
    cek_sonucu: null,
    ozel_infaz_notlari: [],
    elenen_yollar_ve_nedenleri: [],
    notlar: [],
    hesap_izi: [],
    secilen_kural_idleri: [],
    uygulanan_madde_idleri: [],
    kural_kanit_idleri: [],
    kaynak_idleri: [],
    toplama: null,
    sonuc_etiketi: kt.paket.cikti_modeli.sonuc_etiketi,
  };
  if (sorunlar.length || !ilam) {
    cikti.durum = 'eksik_veri';
    cikti.eksik_veri.push(...sorunlar.map((s) => ({ kod: s.kod, alan: s.alan, mesaj: s.mesaj })));
    cikti.notlar = notlar.liste;
    return cikti;
  }

  if (vaka.suclar_ve_ilamlar.some((i) => i.suc_tarihi && once(i.suc_tarihi, kt.esik('T01')))) {
    cikti.durum = 'hukuki_inceleme_gerekli';
    cikti.notlar = [{ seviye: 'inceleme', kod: 'E014', mesaj: '1 Haziran 2005 öncesi suçlar bu araçta hesaplanmaz.', kurallar: ['R001'] }];
    return cikti;
  }
  if (vaka.suclar_ve_ilamlar.length > 1) return toplamaCiktisi(kt, motor, vaka, cikti, secenekler, notlar);

  let ortam;
  try {
    ortam = ortamKur(kt, vaka, ilam, secenekler, notlar);
  } catch (hata) {
    cikti.durum = 'eksik_veri';
    cikti.girdi_sorunlari.push({ kod: 'GIRDI', alan: 'sure', mesaj: 'Ceza veya mahsup hesaplanabilir takvim aralığını aşıyor.' });
    cikti.eksik_veri.push(...cikti.girdi_sorunlari);
    return cikti;
  }
  cikti.hesap_tarihi = ortam.hesapTarihi;
  cikti.hesap_profili_id = ortam.profil.id;
  ortam.tekerrur = tekerrurTespit(kt, motor, vaka, ilam);
  cikti.tekerrur = ortam.tekerrur;

  if (cikti.eksik_veri.length) {
    cikti.durum = 'eksik_veri';
    cikti.hata_kodlari = [...new Set(cikti.eksik_veri.map((e) => e.kod))];
    cikti.notlar = notlar.liste;
    return cikti;
  }

  genelNotlar(kt, ortam, notlar);

  for (const { anahtar } of SENARYOLAR) {
    const S = senaryoHesapla(kt, motor, ortam, anahtar);
    const varsayimNotlari = S.varsayimlar.map((v) => ({ seviye: 'varsayim', kod: v.kod || v.alan, mesaj: v.mesaj, kurallar: v.kurallar }));
    S.durum = S.durum || durumBelirle(notlar.liste, S.notlar.liste, varsayimNotlari);
    S.notlar = S.notlar.liste;
    S.kural_idleri = [...S.kural_idleri];
    cikti.senaryolar[anahtar] = S;
  }

  // Seçili senaryo: önce hükümdeki tekerrür, yoksa belgelerden belirlenen aday.
  const gecerli = ['yok', 'birinci', 'ikinci'];
  const t = ortam.tekerrur;
  let secili = gecerli.includes(ilam.hukumdeki_tekerrur) ? ilam.hukumdeki_tekerrur : null;
  if (!secili && gecerli.includes(t.belgelerden_aday_tespit)) {
    secili = t.belgelerden_aday_tespit;
    notlar.ekle('varsayim', 'R014', `Hükümdeki tekerrür girilmedi; belgelerden belirlenen aday (${adayMetni(secili)}) gösterildi. İnfaz kesin hükme göre yapılır.`, ['R014']);
  }
  if (!secili && t.belgelerden_aday_tespit === 'uygulanmaz') secili = 'yok';
  cikti.secili_senaryo = secili;
  for (const u of t.uyarilar) notlar.ekle(u.seviye, u.kod, u.mesaj, [u.kod.startsWith('R') ? u.kod : 'R014']);

  const S = secili ? cikti.senaryolar[secili] : null;
  if (!S) {
    cikti.durum = 'eksik_veri';
    cikti.eksik_veri.push({ kod: 'E002', alan: 'hukumdeki_tekerrur', mesaj: 'Tekerrür durumu belirlenmedi: hükümdeki tekerrürü seçin veya önceki mahkûmiyetleri girin. Üç senaryo karşılaştırmalı gösterilmektedir.' });
  } else if (!S.uygulanabilir) {
    cikti.durum = 'hukuki_inceleme_gerekli';
  } else {
    const varsayimNotlari = S.varsayimlar.map((v) => ({ seviye: 'varsayim', kod: v.kod || v.alan, mesaj: v.mesaj, kurallar: v.kurallar }));
    cikti.durum = S.hesaplanamadi ? 'hukuki_inceleme_gerekli' : durumBelirle(notlar.liste, S.notlar, varsayimNotlari);
    cikti.takvim = S.takvim;
    if (cikti.durum === 'varsayimli_senaryo') cikti.kurumda_kalacak_sure_gun = S.kurumda_kalis_gun;
  }

  // Seçili (yoksa tekerrürsüz) senaryonun ayrıntıları çıktı modelinin üst alanlarına taşınır.
  const temsilci = S || cikti.senaryolar.yok;
  if (temsilci) {
    cikti.varsayimlar = temsilci.varsayimlar;
    cikti.belirsiz_kosullar = temsilci.belirsiz_kosullar;
    cikti.temel_oran = temsilci.temel_oran;
    cikti.oran_adaylari = temsilci.oran_adaylari;
    cikti.tekerrur_sonrasi_sure = temsilci.ks_ham_gun ? { oran: temsilci.oran, ham_gun: temsilci.ks_ham_gun, gun: temsilci.ks_gun, ust_sinir_108_2: temsilci.ust_sinir_108_2 } : null;
    cikti.DS_yollari = temsilci.ds_yollari;
    cikti.acik_kurum_yollari = temsilci.acik_kurum ? [temsilci.acik_kurum] : [];
    cikti.gerekli_kararlar = temsilci.gerekli_kararlar;
    cikti.karar_dugumu_sonuclari = temsilci.karar_dugumu_sonuclari;
  }

  const esasBaglam = kararBaglami(kt, ortam, { tekerrur: ilam.hukumdeki_tekerrur });
  cikti.cek_sonucu = cekDegerlendir(kt, motor, esasBaglam);
  cikti.ozel_infaz_notlari = ozelInfazNotlari(kt, ortam, varsayimlariUygula(esasBaglam).baglam, secili);
  cikti.elenen_yollar_ve_nedenleri = [
    ...Object.values(cikti.senaryolar).flatMap((s) => (s.ds_yollari || []).filter((y) => y.uygun === false || y.yarar_yok).map((y) => ({ senaryo: s.anahtar, yol: y.ad, neden: y.neden, kural: y.kural }))),
    { yol: 'Geçici 10/2', neden: 'Suç tarihine değil 31/07/2023 tarihindeki izin statüsüne bağlıdır; bu araçta hesaplanmaz.', kural: 'R054' },
  ];
  cikti.notlar = notlar.liste;

  const tumNotlar = [...notlar.liste, ...Object.values(cikti.senaryolar).flatMap((s) => s.notlar)];
  const ilgili = S ? [...notlar.liste, ...S.notlar] : tumNotlar;
  cikti.hukuki_kabuller = [...new Set([...notlar.liste.filter((n) => n.seviye === 'varsayim').map((n) => n.mesaj), ...(temsilci?.varsayimlar || []).map((v) => v.mesaj)])];
  cikti.engelleyici_konu_idleri = kodlariTopla(ilgili.filter((n) => n.seviye === 'inceleme' || n.kod === 'A01'), ['A']);
  cikti.hata_kodlari = kodlariTopla([...ilgili, ...(temsilci?.varsayimlar || []).map((v) => ({ kod: v.kod || '', mesaj: '' }))], ['E']);
  cikti.norm_cakismalari = kodlariTopla(tumNotlar, ['N']).map((id) => kt.normCakismalari.get(id)).filter(Boolean);

  const kurallar = new Set(['R001', 'R002', 'R003', 'R006', 'R062', 'R126']);
  for (const s of Object.values(cikti.senaryolar)) s.kural_idleri.forEach((k) => kurallar.add(k));
  for (const n of tumNotlar) n.kurallar.forEach((k) => /^R\d+$/.test(k) && kurallar.add(k));
  cikti.ozel_infaz_notlari.forEach((n) => kurallar.add(n.kural));
  if (cikti.cek_sonucu) cikti.cek_sonucu.kurallar.forEach((k) => kurallar.add(k));
  cikti.secilen_kural_idleri = [...kurallar].filter((id) => kt.kurallar.has(id)).sort();
  cikti.uygulanan_madde_idleri = [...new Set(cikti.secilen_kural_idleri.flatMap((id) => kt.kural(id).madde_referanslari || []))];
  cikti.kural_kanit_idleri = cikti.secilen_kural_idleri.flatMap((id) => kt.kural(id).kanit_kimlikleri || []);
  cikti.kaynak_idleri = kt.kaynaklariTopla(cikti.secilen_kural_idleri).map((s) => s.kaynak_id);
  cikti.hesap_izi = Object.values(cikti.senaryolar).flatMap((s) => s.izler.map((i) => ({ senaryo: s.anahtar, ...i })));
  return cikti;
}
