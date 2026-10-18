// Birden çok ilamın toplanarak infazı (5275 m.99, 101/2, 107/3-4; R005, R031).
//
// İlke (R005): her ilam kendi rejimini korur; toplam ceza tek bir suç tarihiyle
// hesaplanmaz. Bu yüzden hesap iki katmanlıdır:
//
//   1. İlam katmanı — her ilam kendi karar bağlamıyla (suç tarihi, madde, tekerrür)
//      değerlendirilir: KS oranı (D010-D017), 108/2 sınırı, ceza yolu engelleri,
//      asgari kurum süresinin uygulanıp uygulanmadığı (D025), çocuk durumu.
//      İlamın KS payı = kendi ceza günü × kendi oranı.
//   2. Toplam katmanı — tek bir infaz takvimi kurulur:
//      · KS süresi = Σ paylar; 107/3-e (28 yıl) veya 107/4-e / 108/1-c (32 yıl) tavanı
//      · hak ederek tahliye = toplam ceza (yıl/ay/gün bileşenleri; içtima kararındaki gibi)
//      · açık kurum: her ilamın planı toplam ceza ve toplam KS tarihiyle kurulur;
//        yasak varsa yasak, değilse en kısıtlayıcı ilamın tarihi (Yönetmelik m.6/3)
//      · DS yolları: bir yol ancak bütün ilamlar için uygunsa toplama uygulanır;
//        yalnız bazı ilamlar için uygunsa "karma rejim" inceleme notu üretilir
//      · asgari kurum: yalnız 04/06/2025 ve sonrası suç ilamlarının KS payının onda biri
//
// Bu modül çıktı modelini tek ilam hesabıyla aynı biçimde (senaryo kaydı) üretir;
// arayüz ve gerekçe katmanı iki yolu aynı şekilde gösterir.

import { Kesir } from '../zaman/rasyonel.js';
import { cezaEkle, gunEkle, gunFarki, yilEkle, enGec, once, trTarih, cezaMetni, yasHesapla, bugunIstanbul } from '../zaman/takvim.js';
import { profilOlustur, yuvarla } from '../zaman/profil.js';
import { kararBaglami, varsayimlariUygula } from '../baglam/karar-baglami.js';
import { mahsupHesapla } from '../hesap/mahsup.js';
import { ksOraniBelirle } from '../hesap/oran.js';
import { acikKurumPlani, gecici10ErkenAcik, infazHakimiOnayiGerekir } from '../hesap/acik-kurum.js';
import { dsYollari } from '../hesap/ds.js';
import { gunAgirligiBelirle } from '../hesap/cocuk.js';
import { Notlar } from '../cikti/notlar.js';
import { SenaryoKaydi, dugumKaydi, bitir, dsSecVeTakvimKur, belirsizKosullar } from '../hesap/senaryo.js';

const SURELI = ['sureli_hapis', 'adli_paradan_cevrilen_hapis'];
const MUEBBET = ['muebbet', 'agirlastirilmis_muebbet'];

export const ilamEtiketi = (ilam, i) => ilam.etiket || `${i + 1}. ilam`;

// İlamların yıl/ay/gün bileşenleri ayrı ayrı toplanır (içtima kararındaki "11 yıl 25 ay 37 gün").
export function cezalariTopla(cezalar) {
  return cezalar.reduce((t, c) => ({ yil: t.yil + (c?.yil || 0), ay: t.ay + (c?.ay || 0), gun: t.gun + (c?.gun || 0) }), { yil: 0, ay: 0, gun: 0 });
}

// Toplamada hesaba engel olan veya eksik bilgiler. Dönüş: { eksik: [...], engel: string|null }
export function toplamaOnDenetimi(ilamlar) {
  const eksik = [];
  ilamlar.forEach((i, n) => {
    const ad = ilamEtiketi(i, n);
    if (!i.suc_tarihi) eksik.push({ kod: 'E001', alan: `suclar_ve_ilamlar[${n}].suc_tarihi`, mesaj: `${ad}: suç tarihi girilmedi.` });
    const tur = i.infazdaki_ceza_turu || i.hukumdeki_ceza_turu || 'sureli_hapis';
    if ((SURELI.includes(tur) || tur === 'adli_para') && !i.hukumdeki_sonuc_ceza) eksik.push({ kod: 'E001', alan: `suclar_ve_ilamlar[${n}].hukumdeki_sonuc_ceza`, mesaj: `${ad}: ceza miktarı girilmedi.` });
  });
  const muebbet = ilamlar.find((i) => MUEBBET.includes(i.hukumdeki_ceza_turu));
  const engel = muebbet ? 'Müebbet hapis içeren toplamada koşullu salıverilme süreleri 5275 m.107/3-a…d ve 107/4 ile ayrıca belirlenir; bu araçta birleşik hesap yapılmaz.' : null;
  return { eksik, engel };
}

// Kleene "ve": bir yol bütün ilamlar için uygunsa uygundur.
function hepsi(degerler) {
  if (degerler.includes(false)) return false;
  if (degerler.includes(null) || degerler.includes(undefined)) return null;
  return true;
}

function tekillestir(liste, anahtar) {
  const gorulen = new Set();
  return liste.filter((x) => {
    const k = anahtar(x);
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// İlam katmanı
// ---------------------------------------------------------------------------

function ilamDegerlendir(kt, motor, ortak, ilam, n, S, vaka) {
  const etiket = ilamEtiketi(ilam, n);
  const ortam = { ...ortak, ilam, sucYasi: vaka.dogum_tarihi && ilam.suc_tarihi ? yasHesapla(vaka.dogum_tarihi, ilam.suc_tarihi) : null, tekerrur: null };
  const derece = ['birinci', 'ikinci'].includes(ilam.hukumdeki_tekerrur) ? ilam.hukumdeki_tekerrur : 'yok';
  if (!['yok', 'birinci', 'ikinci'].includes(ilam.hukumdeki_tekerrur)) {
    S.notlar.ekle('varsayim', 'R014', `${etiket}: hükümdeki tekerrür belirtilmedi; tekerrürsüz kabul edildi.`, ['R014']);
  }
  const belgeli = kararBaglami(kt, ortam, { tekerrur: derece });
  const { baglam, uygulanan } = varsayimlariUygula(belgeli);
  const kd = (id) => {
    const s = motor.karar(id, baglam);
    dugumKaydi(S, s);
    return s;
  };
  const kayit = {
    ilam_id: ilam.ilam_id,
    sira: n + 1,
    etiket,
    suc_tarihi: ilam.suc_tarihi,
    karar_tarihi: ilam.karar_tarihi,
    madde: ilam.kanun_madde_fikra_bent,
    ceza: ilam.hukumdeki_sonuc_ceza,
    tekerrur: derece,
    gun: gunFarki(ortak.E, cezaEkle(ortak.E, ilam.hukumdeki_sonuc_ceza)),
    oran: null,
    temel_oran: null,
    ks_ham_gun: null,
    asgari_kurum_uygulanir: false,
    para_hapis: false,
    orgut: baglam.ilam.orgut_kurma_yonetme === true || baglam.ilam.orgut_faaliyeti === true,
    varsayimlar: uygulanan,
    belirsiz_kosullar: belirsizKosullar(belgeli, motor.tumu(belgeli)),
    neden: null,
    engel: null,
    ortam,
    baglam,
  };

  const tur = baglam.ilam.ceza_turu;
  if (kd('D005').cozulen === true) {
    kayit.engel = `${etiket}: tazyik, disiplin veya zorlama hapsi genel hapis oranlarıyla toplanamaz (D005).`;
    return kayit;
  }
  if (tur === 'adli_para') {
    kayit.engel = `${etiket}: hapse çevrilmemiş adli para cezası toplamaya girmez; çevrilmişse ceza türü "adli paradan çevrilen hapis" seçilmelidir (5275 m.99/1).`;
    return kayit;
  }
  if (kd('D018').cozulen === true || baglam.ilam.KS_geri_alinmis_aynen_infaz === true) {
    kayit.engel = `${etiket}: koşullu salıverilme yasağı veya geri alma var; bu ilamla birleşik KS hesabı yapılmaz (5275 m.107/13, 107/16).`;
    return kayit;
  }

  const T = new Kesir(kayit.gun);
  if (kd('D001').cozulen === true) {
    // 5275 m.106/9: adli paradan çevrilen hapiste KS uygulanmaz; payı cezanın tamamıdır.
    kayit.para_hapis = true;
    kayit.oran = new Kesir(1);
    kayit.ks_ham_gun = T;
    kayit.neden = 'Adli paradan çevrilen hapis: koşullu salıverilme uygulanmaz, ceza aynen çekilir (5275 m.106/9).';
    S.iz(etiket, `${cezaMetni(kayit.ceza)} = ${kayit.gun} gün × 1 = ${kayit.gun} gün (${kayit.neden})`, ['R102']);
    S.notlar.ekle('inceleme', 'R102', `${etiket}: adli paradan çevrilen hapis toplamaya aynen çekilecek süre olarak katıldı; 105/A/4 nedeniyle DS yolları kapanır. Toplama kararındaki sıra ve ödeme durumu kontrol edilmeli.`, ['R102', 'R044']);
    return kayit;
  }

  const o = ksOraniBelirle(kt, motor, baglam, derece);
  o.adaylar.filter((a) => a.cozulen === true).forEach((a) => dugumKaydi(S, a, { ihtiyatEtkili: false }));
  if (o.temel.ihtiyatli) {
    S.en_cok = true;
    S.notlar.ekle('varsayim', 'E001', `${etiket}: fıkra/bent veya kapsam bilgisi eksik; daha ağır oran ihtiyaten uygulandı ("en çok").`, [o.temel.kaynak]);
  }
  S.kural_idleri.add(o.temel.kaynak);
  kayit.temel_oran = { oran: o.temel.oran, kaynak: o.temel.kaynak, dugum_id: o.temel.dugum_id, neden: o.temel.neden };
  let ham = T.carp(o.oran);
  let neden = o.temel.neden.replace(/\s*\(D\d+\)/g, '');
  if (o.tekerrur) {
    dugumKaydi(S, o.tekerrur.dugum);
    if (!o.tekerrur.oran) {
      kayit.engel = `${etiket}: ${o.tekerrur.dugum.ad} düğümü uygulanamıyor; toplama hesabı yapılmadı.`;
      return kayit;
    }
    neden = `${derece === 'birinci' ? '1. tekerrür' : '2. tekerrür'}: max(${o.temel.oran}, ${o.tekerrur.oran}) = ${o.oran}`;
    if (derece === 'birinci') {
      const C = ilam.tekerrure_esas_en_agir_ceza || null;
      if (C) {
        const cGun = gunFarki(ortak.E, cezaEkle(ortak.E, C));
        const ust = T.carp(o.temel.oran).topla(cGun);
        if (ham.karsilastir(ust) > 0) {
          ham = ust;
          neden += `; 108/2 sınırı uygulandı (önceki ceza ${cezaMetni(C)})`;
        }
        S.kural_idleri.add('R027');
      } else {
        S.en_cok = true;
        S.notlar.ekle('varsayim', 'R027', `${etiket}: tekerrüre esas önceki ceza girilmedi; 108/2 sınırı uygulanamadı ("en çok").`, ['R027']);
      }
    }
    S.kural_idleri.add(derece === 'birinci' ? 'R027' : 'R028');
  }
  kayit.oran = o.oran;
  kayit.ks_ham_gun = ham;
  kayit.neden = neden;

  // Çocukta gün ağırlığı ilam payına değil toplam takvime uygulanır; toplamada modellenmedi.
  const yerelNotlar = new Notlar();
  if (gunAgirligiBelirle(kt, ortam, baglam, yerelNotlar)) {
    S.en_cok = true;
    S.notlar.ekle('inceleme', 'R052', `${etiket}: çocukta kurum günü ağırlığı toplamada uygulanmadı; gerçek KS tarihi daha erken olabilir ("en çok").`, ['R052', 'R053']);
  }
  kayit.asgari_kurum_uygulanir = kd('D025').cozulen === true;
  S.iz(etiket, `${cezaMetni(kayit.ceza)} = ${kayit.gun} gün × ${kayit.oran} = ${ham.ondalik(2)} gün (${neden}).`, [o.temel.kaynak]);
  return kayit;
}

// ---------------------------------------------------------------------------
// Toplam katmanı
// ---------------------------------------------------------------------------

// 5275 m.107/3-e (28 yıl), 107/4-e örgüt ve 108/1-c tekerrür (32 yıl) tavanı.
function ksTavani(kt, kayitlar, S, E) {
  const r31 = kt.p('R031');
  const ozel = kayitlar.filter((k) => k.orgut || k.tekerrur !== 'yok');
  const yil = ozel.length ? Math.max(r31['107_4'].coklu_sureli_en_fazla, r31['108_1_c_coklu_sureli_en_fazla_yil']) : r31['107_3'].coklu_sureli_en_fazla;
  const gun = gunFarki(E, yilEkle(E, yil));
  return { yil, gun, karma: ozel.length > 0 && ozel.length < kayitlar.length, kural: 'R031' };
}

function birlesikAcik(kt, motor, planlar, kayitlar, ortak) {
  const yasaklar = planlar.flatMap((p, i) => (p.yol === 'yasak' ? p.yasaklar.map((y) => ({ ...y, neden: `${kayitlar[i].etiket}: ${y.neden}` })) : []));
  if (yasaklar.length) return { yol: 'yasak', tarih: null, yasaklar, dogrudan: null, kapali: null };
  if (planlar.every((p) => p.yol === 'dogrudan')) {
    const donus = planlar.find((p) => p.ds_donus);
    return donus || { ...planlar[0], ihtiyatli: planlar.some((p) => p.ihtiyatli) };
  }
  // Yönetmelik m.6/3: KS'ye en az süre kalmasını arayan (en kısıtlayıcı) ilamın tarihi esas.
  const kapalilar = planlar.map((p, i) => ({ p, i })).filter((x) => x.p.yol === 'kapalidan');
  const normal = enGec(...kapalilar.map((x) => x.p.kapali.normal_tarih));
  const kalemler = tekillestir(
    kapalilar.flatMap(({ p, i }) =>
      p.kapali.kalemler
        .filter((k) => !['R130', 'R131'].includes(k.kural))
        .map((k) => (k.dugum_id === 'D035' || k.dugum_id === 'D036' ? { ...k, ad: `${kayitlar[i].etiket}: ${k.ad}` } : k)),
    ),
    (k) => `${k.ad}|${k.tarih}`,
  );
  // Geçici 10/6 erken açık ancak bütün ilamlar kapsamdaysa (karma rejimde otomatik uygulanmaz).
  const g10Kapsam = kayitlar.every((k) => motor.karar('D024', k.baglam).cozulen === true);
  const erken = g10Kapsam ? gecici10ErkenAcik(kt, motor, kayitlar[0].ortam, kayitlar[0].baglam, normal) : null;
  const g10 = erken && once(erken.tarih, normal) ? erken : null;
  const tarih = g10 ? g10.tarih : normal;
  if (g10) kalemler.push(...g10.kalemler);
  const ihtiyatli = kapalilar.some(({ p }) => p.ihtiyatli);
  return {
    yol: 'kapalidan',
    tarih,
    dogrudan: kapalilar[0].p.dogrudan,
    yasaklar: [],
    ihtiyatli,
    kapali: {
      tarih,
      normal_tarih: normal,
      gecici10: g10,
      kalemler,
      ihtiyatli,
      aciklama: `En erken açığa ayrılma: ${trTarih(tarih)}${g10 ? ` (geçici 10/6; normal tarih ${trTarih(normal)})` : ''}; toplamada en kısıtlayıcı ilamın şartı esas alındı (Yönetmelik m.6/3).`,
    },
    karma_g10: !g10Kapsam && kayitlar.some((k) => motor.karar('D024', k.baglam).cozulen === true),
  };
}

function birlesikYollar(listeler, kayitlar, S) {
  return listeler[0].map((ilk, j) => {
    const yollar = listeler.map((l) => l[j]);
    const uygun = hepsi(yollar.map((y) => y.uygun));
    // Ortak tarih en geç ilamın tarihidir; kalemler ve geçici 10/6 dayanağı o ilamdan gelir.
    const bagli = uygun === true ? yollar.find((x) => x.tarih === enGec(...yollar.map((z) => z.tarih))) || ilk : null;
    // Toplamaya uygulanmayan yolun, yalnız bazı ilamlarda uygun olduğu için üretilmiş notları taşınmaz;
    // dayanağa bağlı not (R133: geçici 6 + 10/6) yalnız belirleyici ilamdan alınır.
    const notKaynagi = uygun === true ? yollar : yollar.filter((x) => x.uygun !== true);
    const notlar = notKaynagi.flatMap((x) => (x.notlar || []).filter((n) => n.kod !== 'R133' || x === bagli));
    const y = { ...ilk, uygun, ihtiyatli: yollar.some((x) => x.ihtiyatli), yarar_yok: yollar.some((x) => x.yarar_yok), notlar: tekillestir(notlar, (n) => n.mesaj) };
    delete y.kapi_sonucu;
    if (uygun === true) {
      y.tarih = bagli.tarih;
      y.kalemler = bagli.kalemler || ilk.kalemler;
      if ('dayanak_yol' in bagli) Object.assign(y, { dayanak_yol: bagli.dayanak_yol, toplam_pencere_yil: bagli.toplam_pencere_yil });
    } else {
      const engel = yollar.findIndex((x) => x.uygun === false);
      const belirsiz = yollar.findIndex((x) => x.uygun !== true && x.uygun !== false);
      const k = engel >= 0 ? engel : belirsiz;
      y.tarih = null;
      y.kalemler = [];
      y.neden = k >= 0 ? `${kayitlar[k].etiket}: ${yollar[k].neden || 'koşullar sağlanmıyor'}` : ilk.neden;
      const uygunOlan = yollar.filter((x) => x.uygun === true).length;
      if (uygunOlan > 0 && ['DS_gecici6_1', 'DS_gecici6_2a', 'DS_gecici6_2b', 'gecici10_6'].includes(y.id)) {
        y.karma = true;
        S.notlar.ekle('inceleme', 'E007', `Karma rejim: "${y.ad}" yalnız bazı ilamlar için uygun olduğundan bütün toplama uygulanmadı. Her ilam kendi rejimini korur; bu yolun ilam bazında uygulanması infaz hâkimliği kararına bağlıdır (R005).`, ['R005', y.kural]);
      }
    }
    for (const x of yollar) delete x.kapi_sonucu;
    return y;
  });
}

// Ana giriş: normalleştirilmiş vaka (≥ 2 ilam) → toplama senaryosu ve özeti.
export function toplamaSenaryosu(kt, motor, vaka, secenekler, notlar) {
  const ilamlar = vaka.suclar_ve_ilamlar;
  const bugun = secenekler.bugun || bugunIstanbul();
  const hesapTarihi = vaka.hesap_tarihi || bugun;
  const baslama = vaka.infaza_baslama_tarihi || hesapTarihi;
  if (!vaka.infaza_baslama_tarihi) notlar.ekle('varsayim', 'infaza_baslama_tarihi', `İnfaza başlama tarihi girilmedi; hesap tarihi (${trTarih(hesapTarihi)}) başlangıç kabul edildi.`, ['R003']);
  const profil = profilOlustur(vaka.profil || {});
  const mahsup = mahsupHesapla(kt, vaka.mahsup_kayitlari, profil, notlar);
  const E = gunEkle(baslama, -mahsup.gun);
  const toplamCeza = cezalariTopla(ilamlar.map((i) => i.hukumdeki_sonuc_ceza));
  const bihakkin = cezaEkle(E, toplamCeza);
  const ortak = {
    kt,
    vaka,
    profil,
    hesapTarihi,
    baslama,
    mahsup,
    E,
    ceza: toplamCeza,
    bihakkin,
    toplamGun: gunFarki(E, bihakkin),
    hesapYasi: vaka.dogum_tarihi ? yasHesapla(vaka.dogum_tarihi, hesapTarihi) : null,
  };

  const S = new SenaryoKaydi('birlesik');
  S.yol = 'toplama';
  S.iz('Toplama', `${ilamlar.length} ilam: ${ilamlar.map((i) => cezaMetni(i.hukumdeki_sonuc_ceza)).join(' + ')} = ${cezaMetni(toplamCeza)}; ${trTarih(E)} etkin başlangıçtan ${ortak.toplamGun} gün (5275 m.99/1; yıl resmî takvim, ay 30 gün).`, ['R005', 'R003']);

  // 1. İlam katmanı
  const kayitlar = ilamlar.map((ilam, n) => ilamDegerlendir(kt, motor, ortak, ilam, n, S, vaka));
  S.ilamlar = kayitlar;
  S.varsayimlar = tekillestir(kayitlar.flatMap((k) => k.varsayimlar), (v) => `${v.alan}|${v.mesaj}`);
  S.belirsiz_kosullar = [...new Set(kayitlar.flatMap((k) => k.belirsiz_kosullar))];
  const engel = kayitlar.find((k) => k.engel);
  if (engel) {
    S.hesaplanamadi = true;
    S.neden = engel.engel;
    S.notlar.ekle('inceleme', 'E007', engel.engel, ['R005']);
    return { S: bitir(S), ortak, toplamCeza };
  }

  // 2. KS süresi
  let ksHam = kayitlar.reduce((t, k) => t.topla(k.ks_ham_gun), new Kesir(0));
  const tavan = ksTavani(kt, kayitlar, S, E);
  S.iz('KS paylarının toplamı', `${kayitlar.map((k) => k.ks_ham_gun.ondalik(2)).join(' + ')} = ${ksHam.ondalik(2)} gün.`, ['R005']);
  if (ksHam.karsilastir(new Kesir(tavan.gun)) > 0) {
    ksHam = new Kesir(tavan.gun);
    S.iz('107/3-4 tavanı', `Birden fazla süreli hapiste koşullu salıverilme için kurumda geçirilecek süre en fazla ${tavan.yil} yıldır (${tavan.gun} gün); tavan uygulandı.`, [tavan.kural]);
    if (tavan.karma) {
      S.en_cok = true;
      S.notlar.ekle('inceleme', 'R031', `Toplamada örgüt/tekerrür kapsamındaki ve dışındaki ilamlar birlikte: karma rejimde tek tavan otomatik seçilmez; ${tavan.yil} yıl (aleyhe) kullanıldı.`, ['R031']);
    }
  }
  S.kural_idleri.add('R005').add('R031');
  S.ks_ham_gun = ksHam;
  S.ks_gun = yuvarla(profil, ksHam);
  const ksTarihi = gunEkle(E, S.ks_gun);
  S.temel_oran = { oran: null, kaynak: 'R005', dugum_id: null, neden: 'Her ilamın kendi oranıyla bulunan KS paylarının toplamı.' };
  S.iz('Koşullu salıverilme', `${ksHam.ondalik(2)} → ${S.ks_gun} gün; tarih ${trTarih(ksTarihi)}.`, ['R003']);

  // 3. Açık kurum (toplam ceza ve toplam KS tarihiyle, ilam başına plan → birleşik plan)
  const planlar = kayitlar.map((k) => acikKurumPlani(kt, motor, k.ortam, k.baglam, ksTarihi));
  const acik = birlesikAcik(kt, motor, planlar, kayitlar, ortak);
  S.acik_kurum = acik;
  if (acik.yol === 'yasak') acik.yasaklar.forEach((y) => S.iz('Açık kurum yasağı', y.neden, [y.kural]));
  else if (acik.yol === 'dogrudan') S.iz('Açık kurum', acik.dogrudan.neden, ['R060']);
  else {
    acik.kapali.kalemler.forEach((k) => S.iz('Kapalıdan açığa', `${k.ad} → ${trTarih(k.tarih)}`, [k.kural]));
    S.iz('Açığa ayrılma tarihi', acik.kapali.aciklama, ['R081']);
    const onay = [...new Set(kayitlar.flatMap((k) => infazHakimiOnayiGerekir(kt, k.baglam, k.ortam)))];
    S.karar(`İdare ve gözlem kurulunun açık kuruma ayırma kararı (5275 m.14/3, m.89)${onay.length ? `; infaz hâkimi onayı gerekir: ${onay.join(', ')} (m.14/4)` : ''}`, 'R088');
    if (acik.ihtiyatli) S.en_cok = true;
    if (acik.karma_g10) S.notlar.ekle('inceleme', 'E007', 'Karma rejim: geçici 10/6 erken açığa ayrılma yalnız bazı ilamlar için uygun; bütün toplama uygulanmadı (R005).', ['R005', 'R131']);
  }

  // 4. Asgari kurum süresi (yalnız 04/06/2025 ve sonrası suç ilamlarının payı)
  const asgariIlamlar = kayitlar.filter((k) => k.asgari_kurum_uygulanir);
  let asgariTarihi = null;
  if (asgariIlamlar.length) {
    const r42 = kt.p('R042');
    const onda = Kesir.from(r42.ksye_kadar_kurum_suresi_asgari_orani);
    const pay = asgariIlamlar.reduce((t, k) => t.topla(k.ks_ham_gun), new Kesir(0)).carp(onda);
    const ham = Kesir.max(r42.asgari_gun, pay);
    const gun = yuvarla(profil, ham);
    asgariTarihi = gunEkle(E, gun);
    S.asgari_kurum = { uygulanir: true, ham, gun, tarih: asgariTarihi };
    S.iz('Asgari kurum süresi', `04/06/2025 ve sonrası suç ilamlarının KS payı × 1/10 = ${pay.ondalik(2)}; en az ${r42.asgari_gun} gün → ${gun} gün (5275 m.105/A/1).`, ['R042']);
    if (asgariIlamlar.length < kayitlar.length) S.notlar.ekle('inceleme', 'R042', 'Karma rejim: onda bir asgari kurum şartı yalnız 04/06/2025 ve sonrası suç ilamlarının payına uygulandı; uygulama infaz kararıyla doğrulanmalı.', ['R042', 'R005']);
  } else {
    S.asgari_kurum = { uygulanir: false };
  }

  // 5. DS yolları: her ilamın kapısıyla, toplam takvimde
  const listeler = kayitlar.map((k) => dsYollari(kt, motor, k.ortam, k.baglam, { ksTarihi, asgariTarihi, acik }));
  const yollar = birlesikYollar(listeler, kayitlar, S);
  for (const y of yollar) if (y.uygun === true || y.ihtiyatli) S.kural_idleri.add(y.kural);

  const sonuc = dsSecVeTakvimKur(S, ortak, { yollar, ksTarihi, bihakkin, acik });
  S.notlar.ekle('bilgi', 'R005', `Toplama kararındaki ${ilamlar.length} ilam birlikte hesaplandı; her ilamın KS oranı kendi suç tarihi, maddesi ve tekerrür durumuna göre belirlendi. Gün sayıları aynı etkin başlangıçtan ayrı ayrı hesaplandı (A01).`, ['R005', 'R003']);
  return { S: sonuc, ortak, toplamCeza };
}
