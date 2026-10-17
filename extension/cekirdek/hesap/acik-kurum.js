// Açık kurum (5275 m.14; Açık Ceza İnfaz Kurumlarına Ayrılma Yönetmeliği m.5, 6, 8).
//
// 105/A/1 denetimli serbestliği açık kurumda (veya çocuk eğitimevinde) bulunmayı
// gerektirir. Bu yüzden DS tarihi, açık kuruma geçişin hukuken mümkün olduğu
// tarihten önce olamaz:
//   - Doğrudan açık kurum (m.14/2-a,b; D030/D031, istisna SC08, ikinci tekerrür D034)
//   - Kapalıdan açığa ayrılma (Yönetmelik m.6/1-a: <10 yıl → 1 ay; ≥10 yıl → toplam
//     cezanın onda biri; KS'ye 7 yıl veya daha az; m.6/2 özel suç eşikleri D035/D036)
//   - Ayrılma yasakları (Yönetmelik m.8: ağırlaştırılmış müebbet, terör/örgüt suçları …)

import { Kesir } from '../zaman/rasyonel.js';
import { gunEkle, gunFarki, yilEkle, enGec, trTarih } from '../zaman/takvim.js';
import { kurumAyiEkle, yuvarla } from '../zaman/profil.js';
import { veya } from '../dil/kosul.js';

export function dogrudanAcik(motor, baglam) {
  const kasitli = motor.karar('D030', baglam);
  const taksirli = motor.karar('D031', baglam);
  const engel = motor.karar('D034', baglam);
  const uygun = engel.cozulen === true ? false : veya([kasitli.cozulen, taksirli.cozulen]);
  const dugum = taksirli.cozulen === true ? taksirli : kasitli;
  return {
    uygun,
    ihtiyatli: kasitli.ihtiyatli || taksirli.ihtiyatli || engel.ihtiyatli,
    dugumler: [kasitli, taksirli, engel],
    neden:
      engel.cozulen === true
        ? 'İkinci defa mükerrir kasıtlı suç hükümlüsü doğrudan açık kuruma alınamaz (5275 m.14/2-a; D034).'
        : uygun === true
          ? `${dugum.ad} (${dugum.dugum_id}): ceza doğrudan açık kurumda başlar.`
          : 'Doğrudan açık kurum şartları oluşmuyor (toplam ceza eşiği veya m.14/2-a istisnası).',
    norm_cakismasi: taksirli.cozulen === true ? taksirli.sonuc_adayi.norm_ifade_farki_kontrolu || null : null,
  };
}

// Açığa ayrılma yasakları (Yönetmelik m.8). Dönüş: yasak listesi.
export function acikYasaklari(kt, baglam) {
  const yasaklar = [];
  if (baglam.ilam.ceza_turu === 'agirlastirilmis_muebbet') {
    yasaklar.push({ neden: 'Ağırlaştırılmış müebbet hapis hükümlüleri açık kuruma ayrılamaz (Yönetmelik m.8/1-a).', kural: 'R087' });
  }
  const teror = baglam.ilam.teror === true;
  const orgut = veya([baglam.ilam.orgut_faaliyeti, baglam.ilam.orgut_kurma_yonetme_uyelik]) === true;
  if (teror || orgut) {
    yasaklar.push({ neden: 'Terör ve örgütlü suç hükümlüleri, m.6/2-c ve ç (etkin pişmanlık / örgütten ayrılma kurul tespiti) dışında açık kuruma ayrılamaz (Yönetmelik m.8/1-ç).', kural: 'R087' });
  }
  if (baglam.ilam.KS_geri_alinmis_aynen_infaz === true) {
    yasaklar.push({ neden: 'Koşullu salıverilmesi geri alınan cezanın tamamı kapalı kurumda infaz edilir (Yönetmelik m.8/2-a).', kural: 'R087' });
  }
  return yasaklar;
}

// Yönetmelik m.6 eşiklerinin parametreleri (kabul testleri ve arayüz için dışa açık).
export function acikEsikleri(kt) {
  const r81 = kt.p('R081');
  const r82 = kt.p('R082');
  return {
    kapaliAsgari: (onYildanAz) => (onYildanAz ? { ay: r81.ceza_10_yildan_az_asgari_ay } : { oran: Kesir.from(r81.ceza_10_yil_ve_uzeri_asgari_oran) }),
    genelKalanSaglandi: (kalanYil) => kalanYil <= r81.KSye_kalan_azami_yil, // "yedi yıl veya daha az"
    muebbetKalanSaglandi: (kalanYil) => kalanYil <= r82.muebbet_KSye_kalan_azami_yil,
    ozelKalanSaglandi: (dugumId, kalanYil) => {
      const kural = dugumId === 'D035' ? 'R083' : 'R084';
      return kalanYil < kt.p(kural).KSye_kalan_yil.lt; // "… yıldan az"
    },
    genelKalanYil: r81.KSye_kalan_azami_yil,
    muebbetKalanYil: r82.muebbet_KSye_kalan_azami_yil,
  };
}

// Kapalıdan açığa ayrılmanın en erken tarihi.
export function kapalidanAcikPlani(kt, motor, ortam, baglam, ksTarihi) {
  const { E, profil, vaka } = ortam;
  const kalemler = [];
  let ihtiyatli = false;
  const muebbet = baglam.ilam.ceza_turu === 'muebbet';

  if (muebbet) {
    const yil = kt.p('R082').muebbet_KSye_kalan_azami_yil;
    kalemler.push({ ad: `Müebbette KS'ye ${yil} yıl veya daha az kalması (Yönetmelik m.6/1-b)`, tarih: yilEkle(ksTarihi, -yil), kural: 'R082' });
  } else {
    const az = motor.karar('D032', baglam);
    const cok = motor.karar('D033', baglam);
    if (az.cozulen === true) {
      const ay = az.sonuc_adayi.kapali_asgari.ay;
      kalemler.push({ ad: `Toplam ceza 10 yıldan az: kurumda ${ay} ay (Yönetmelik m.6/1-a)`, tarih: kurumAyiEkle(profil, E, ay), kural: 'R081', dugum_id: 'D032' });
    } else if (cok.cozulen === true) {
      const toplam = gunFarki(E, ortam.bihakkin);
      const ham = new Kesir(toplam).carp(Kesir.from(cok.sonuc_adayi.kapali_asgari_oran));
      const gun = yuvarla(profil, ham);
      kalemler.push({ ad: `Toplam ceza 10 yıl veya fazla: cezanın onda biri ${ham.ondalik()} → ${gun} gün (Yönetmelik m.6/1-a)`, tarih: gunEkle(E, gun), kural: 'R081', dugum_id: 'D033' });
    }
    const yedi = kt.p('R081').KSye_kalan_azami_yil;
    kalemler.push({ ad: `KS'ye ${yedi} yıl veya daha az kalması (Yönetmelik m.6/1-a)`, tarih: yilEkle(ksTarihi, -yedi), kural: 'R081' });
    for (const [id, kural] of [['D035', 'R083'], ['D036', 'R084']]) {
      const k = motor.karar(id, baglam);
      if (k.cozulen === true) {
        const esik = kt.p(kural).KSye_kalan_yil.lt;
        kalemler.push({ ad: `${k.ad}: KS'ye ${esik} yıldan az kalması (Yönetmelik m.6/2; ${id})${k.ihtiyatli ? ' — bilgi eksik, ihtiyaten' : ''}`, tarih: gunEkle(yilEkle(ksTarihi, -esik), 1), kural, dugum_id: id });
        ihtiyatli ||= k.ihtiyatli;
      }
    }
    if (vaka.yuksek_guvenlik === true) {
      const r82 = kt.p('R082');
      const ucte = yuvarla(profil, new Kesir(gunFarki(E, ortam.bihakkin)).carp(Kesir.from(r82.yuksek_guvenlik_infaz_orani)));
      kalemler.push({ ad: 'Yüksek güvenlikli kurum: cezanın 1/3\'ü (Yönetmelik m.6/1-c)', tarih: gunEkle(E, ucte), kural: 'R082' });
      kalemler.push({ ad: `Yüksek güvenlikli kurum: KS'ye ${r82.yuksek_guvenlik_KSye_kalan_azami_yil} yıl veya daha az`, tarih: yilEkle(ksTarihi, -r82.yuksek_guvenlik_KSye_kalan_azami_yil), kural: 'R082' });
    }
  }
  const tarih = enGec(E, ...kalemler.map((k) => k.tarih));
  return { tarih, kalemler, ihtiyatli, aciklama: `En erken açığa ayrılma: ${trTarih(tarih)} (iyi hâl ve idare ve gözlem kurulu kararı gerekir).` };
}

export function acikKurumPlani(kt, motor, ortam, baglam, ksTarihi) {
  const yasaklar = acikYasaklari(kt, baglam);
  if (yasaklar.length) return { yol: 'yasak', tarih: null, yasaklar, dogrudan: null, kapali: null };
  const dogrudan = dogrudanAcik(motor, baglam);
  if (dogrudan.uygun === true) {
    return { yol: 'dogrudan', tarih: ortam.E, dogrudan, yasaklar: [], kapali: null, ihtiyatli: dogrudan.ihtiyatli };
  }
  const kapali = kapalidanAcikPlani(kt, motor, ortam, baglam, ksTarihi);
  return { yol: 'kapalidan', tarih: kapali.tarih, dogrudan, kapali, yasaklar: [], ihtiyatli: dogrudan.ihtiyatli || kapali.ihtiyatli };
}

// Açık kurum kararında infaz hâkimi onayı gereken gruplar (5275 m.14/4; R088).
export function infazHakimiOnayiGerekir(kt, baglam, ortam) {
  const nedenler = [];
  if (ortam.ceza && baglam.infaz.toplam_hapis_on_takvim_yilindan_az === false) nedenler.push('toplam ceza 10 yıl veya fazla');
  if (baglam.ilam.teror === true) nedenler.push('terör suçu');
  if (veya([baglam.ilam.orgut_faaliyeti, baglam.ilam.orgut_kurma_yonetme_uyelik]) === true) nedenler.push('örgüt suçu');
  if (baglam.ilam.kanun === 5237 && ['81', '82', '83'].includes(baglam.ilam.madde)) nedenler.push('kasten öldürme');
  if (baglam.ilam.cinsel_dokunulmazlik === true) nedenler.push('cinsel dokunulmazlığa karşı suç');
  if (baglam.ilam.kanun === 5237 && baglam.ilam.madde === '188') nedenler.push('uyuşturucu imal ve ticareti');
  return nedenler;
}
