// Denetimli serbestlik yolları. Her yol ayrı uygunluk ve tarih ile değerlendirilir;
// "bir yolun özel bekleme şartı bütün yollara yayılmaz" (uygulama_sirasi 9).
//
//   DS_105A_1     5275 m.105/A/1          KS'ye 1 yıl; açık kurum/çocuk eğitimevi şartı (D020)
//   DS_105A_3_a   5275 m.105/A/3-a        0-6 yaş çocuklu kadın: 2 yıl (D021)
//   DS_105A_3_b   5275 m.105/A/3-b        ağır hasta/engelli/kocama, ATK raporu: 3 yıl (D022)
//   DS_gecici6_1  5275 geçici 6/1, 6/3    30/03/2020 ve öncesi suç: 3 yıl; kapalıda da (D023)
//   DS_gecici6_2a 5275 geçici 6/2-a, 6/3  0-6 çocuklu kadın veya 70 yaş: 4 yıl (D027)
//   DS_gecici6_2b 5275 geçici 6/2-b, 6/3  65 yaş + rapor: azami süre sınırı yok (D027)
//   gecici10_6    5275 geçici 10/6        31/07/2023 ve öncesi suç: en az 3 ay açıkta → normal DS'den 3 yıl erken (D024, R132-R134)
// Asgari kurum süresi (D025, 105/A/1 son cümle) yalnız 105/A usulünün şartıdır.

import { yilEkle, enGec, enErken, once, sonra, trTarih } from '../zaman/takvim.js';
import { kurumAyiEkle } from '../zaman/profil.js';
import { kapiliBaglam } from '../baglam/karar-baglami.js';
import { degerlendir } from '../dil/kosul.js';

export function dsYollari(kt, motor, ortam, baglam, { ksTarihi, asgariTarihi, acik }) {
  const { E } = ortam;
  const yollar = [];
  const acikMumkun = acik.yol !== 'yasak';
  const kapiBaglami = (kapi) =>
    kapiliBaglam(baglam, acikMumkun
      ? { kurum: 'acik', [kapi]: true }
      : { kurum: 'kapali', aciga_ayrilma_sartlari_saglandi: false, iradesi_disinda_ayrilamama: false, [kapi]: true });

  const yol105 = (id, dugumId, kapi, ad, kural) => {
    const k = motor.karar(dugumId, kapiBaglami(kapi));
    const pencere = k.sonuc_adayi.pencere_yil;
    const kayit = { id, ad, dugum_id: dugumId, kural, pencere_yil: pencere, kurum_sarti: true, uygun: k.cozulen, ihtiyatli: k.ihtiyatli, belirsiz_alanlar: k.belirsiz_alanlar, tarih: null, kalemler: [], kapi_sonucu: k };
    if (k.cozulen !== true) {
      kayit.neden = !acikMumkun ? 'Açık kuruma ayrılma yasağı nedeniyle 105/A kapısı kapalı.' : k.cozulen === false ? 'Düğüm koşulları sağlanmıyor.' : 'Koşullar belirsiz.';
      return kayit;
    }
    kayit.kalemler.push({ ad: `KS'ye ${pencere} yıl veya daha az kalması`, tarih: yilEkle(ksTarihi, -pencere) });
    if (asgariTarihi) kayit.kalemler.push({ ad: '105/A asgari kurum süresi', tarih: asgariTarihi });
    kayit.kalemler.push({ ad: acik.yol === 'dogrudan' ? 'Doğrudan açık kurum' : 'Açık kuruma ayrılma', tarih: acik.tarih });
    kayit.tarih = enGec(E, ...kayit.kalemler.map((x) => x.tarih));
    return kayit;
  };

  yollar.push(yol105('DS_105A_1', 'D020', 'KSye_bir_takvim_yili_veya_az', 'Olağan denetimli serbestlik (105/A/1)', 'R040'));
  yollar.push(yol105('DS_105A_3_a', 'D021', 'KSye_iki_takvim_yili_veya_az', '0-6 yaş çocuklu kadın (105/A/3-a)', 'R041'));
  yollar.push(yol105('DS_105A_3_b', 'D022', 'KSye_uc_takvim_yili_veya_az', 'Ağır hastalık/engellilik/kocama raporu (105/A/3-b)', 'R041'));

  // Geçici 6 (30/03/2020 ve öncesi suçlar). Geçici 6/3: kapalı kurumda da uygulanır.
  const g61 = motor.karar('D023', baglam);
  const kayit61 = { id: 'DS_gecici6_1', ad: 'Geçici 6/1: 3 yıllık pencere', dugum_id: 'D023', kural: 'R050', pencere_yil: g61.sonuc_adayi.pencere_yil, kurum_sarti: false, uygun: g61.cozulen, ihtiyatli: g61.ihtiyatli, belirsiz_alanlar: g61.belirsiz_alanlar, tarih: null, kalemler: [] };
  if (g61.cozulen === true) {
    kayit61.kalemler.push({ ad: `KS'ye ${kayit61.pencere_yil} yıl veya daha az kalması`, tarih: yilEkle(ksTarihi, -kayit61.pencere_yil) });
    if (asgariTarihi) kayit61.kalemler.push({ ad: '105/A asgari kurum süresi', tarih: asgariTarihi });
    kayit61.tarih = enGec(E, ...kayit61.kalemler.map((x) => x.tarih));
  } else {
    kayit61.neden = once(kt.esik('T04'), ortam.ilam.suc_tarihi) ? 'Suç tarihi 30/03/2020 sonrası.' : g61.cozulen === false ? 'Geçici 6/1 istisna suçu (SC04).' : 'İstisna kapsamı belirsiz.';
  }
  yollar.push(kayit61);

  const g62 = motor.karar('D027', baglam);
  const r51 = kt.p('R051');
  const yas = ortam.hesapYasi;
  const kadinCocuk = baglam.kisi.kadin_hukumlu === true && baglam.kisi['0_6_yas_grubunda_cocugu_var'] === true;
  const yetmis = yas !== null && yas >= 70;
  const altmisbes = yas !== null && yas >= 65 && baglam.kisi['105A_3_b_raporu_dogrulandi'] === true;
  const kayit62a = { id: 'DS_gecici6_2a', ad: 'Geçici 6/2-a: 0-6 çocuklu kadın veya 70 yaş (4 yıl)', dugum_id: 'D027', kural: 'R051', pencere_yil: r51.sifir_alti_yas_cocuklu_kadin_veya_70_yasini_bitirmis_yil, kurum_sarti: false, uygun: g62.cozulen === true ? kadinCocuk || yetmis : g62.cozulen, ihtiyatli: g62.ihtiyatli, tarih: null, kalemler: [] };
  if (kayit62a.uygun === true) {
    kayit62a.kalemler.push({ ad: `KS'ye ${kayit62a.pencere_yil} yıl veya daha az kalması`, tarih: yilEkle(ksTarihi, -kayit62a.pencere_yil) });
    kayit62a.tarih = enGec(E, ...kayit62a.kalemler.map((x) => x.tarih));
  } else kayit62a.neden = g62.cozulen === true ? 'Kişisel şart (0-6 yaş çocuklu kadın / 70 yaş) yok veya bilinmiyor.' : 'Geçici 6/2 kapsamı dışında.';
  yollar.push(kayit62a);

  const kayit62b = { id: 'DS_gecici6_2b', ad: 'Geçici 6/2-b: 65 yaş, raporla hayatını yalnız idame ettiremeyen', dugum_id: 'D027', kural: 'R051', pencere_yil: null, kurum_sarti: false, uygun: g62.cozulen === true ? altmisbes : g62.cozulen, ihtiyatli: g62.ihtiyatli, tarih: null, kalemler: [] };
  if (kayit62b.uygun === true) {
    kayit62b.kalemler.push({ ad: 'Azami süre sınırı yok (geçici 6/2-b)', tarih: E });
    kayit62b.tarih = E;
  } else kayit62b.neden = g62.cozulen === true ? '65 yaş ve sağlık raporu şartı yok veya bilinmiyor.' : 'Geçici 6/2 kapsamı dışında.';
  yollar.push(kayit62b);

  // Geçici 10/6 (7571 m.27; R132-R134): max(yürürlük, açıkta en az 3 ay, normal DS tarihinden 3 yıl önce).
  // Açığa geçiş tarihi açık kurum planından gelir (geçici 10/6 erken açık dahil). Olağan yol daha
  // erkense o yol seçilir; 3 ay açık şartı olağan yola taşınmaz (R134).
  // Normal DS tarihi 105/A yollarından alınır; geçici 6 pencereleriyle otomatik toplama yapılmaz (R133).
  const normal = yollar.filter((y) => y.uygun === true && y.tarih && y.id.startsWith('DS_105A'));
  const enIyiNormal = normal.length ? enErken(...normal.map((y) => y.tarih)) : null;
  const gecici6 = yollar.some((y) => y.uygun === true && y.id.startsWith('DS_gecici6'));
  const g10 = motor.karar('D024', baglam);
  const r55 = kt.p('R055');
  const r56 = kt.p('R056');
  const kayit10 = { id: 'gecici10_6', ad: 'Geçici 10/6: 3 yıl erken denetimli serbestlik (en az 3 ay açık)', dugum_id: 'D024', kural: 'R056', pencere_yil: null, kurum_sarti: true, uygun: g10.cozulen, ihtiyatli: g10.ihtiyatli, belirsiz_alanlar: g10.belirsiz_alanlar, tarih: null, kalemler: [], notlar: [] };
  const tarihKapsami = !sonra(ortam.ilam.suc_tarihi, r55.suc_tarihi.lte);
  if (g10.cozulen !== true) {
    kayit10.neden = !tarihKapsami ? 'Suç tarihi 31/07/2023 sonrası.' : once(ortam.hesapTarihi, r55.yururluk) ? 'Hesap tarihi 25/12/2025 öncesi (güncel 10/6 yürürlükte değil).' : g10.cozulen === false ? 'Geçici 10/6 istisna suçu (SC06).' : 'İstisna kapsamı belirsiz.';
    if (tarihKapsami && once(ortam.hesapTarihi, r55.yururluk)) {
      kayit10.notlar.push({ seviye: 'inceleme', kod: 'A04', mesaj: 'Hesap tarihi 25/12/2025 öncesi: geçici 10/6 ilk sürümünün (7456) şartları ayrıca incelenmeli.', kurallar: ['R054', 'R058'] });
    } else if (tarihKapsami && g10.cozulen === false) {
      const ilkSurum = degerlendir({ op: 'secici', secici_id: 'SC07' }, baglam, { seciciler: kt.seciciler });
      if (ilkSurum === false) {
        kayit10.notlar.push({ seviye: 'inceleme', kod: 'A04', mesaj: 'Suç 2023 ilk sürümünde geçici 10/6 kapsamındaydı, 2025 istisnasıyla kapsam daraldı; önceki kararlar ve sürüm yönünden hukuki inceleme gerekir (R058).', kurallar: ['R058'] });
      }
    }
  } else if (!acikMumkun) {
    kayit10.uygun = false;
    kayit10.neden = 'Açık kuruma ayrılma yasağı: geçici 10/6 açık kurum şartı sağlanamaz.';
  } else if (!enIyiNormal) {
    kayit10.uygun = null;
    kayit10.neden = 'Erkene çekilecek bir DS yolu bulunamadı.';
  } else {
    const erken = r56.normal_DS_tarihinden_erken_yil;
    kayit10.kalemler.push({ ad: `Normal DS tarihinden (${trTarih(enIyiNormal)}) ${erken} yıl erken`, tarih: yilEkle(enIyiNormal, -erken) });
    kayit10.kalemler.push({ ad: `Açık cezaevinde en az ${r56.acik_kurum_asgari_ay} ay`, tarih: kurumAyiEkle(ortam.profil, acik.tarih, r56.acik_kurum_asgari_ay) });
    kayit10.kalemler.push({ ad: 'Geçici 10/6 yürürlüğü (25/12/2025)', tarih: r55.yururluk });
    kayit10.tarih = enGec(E, ...kayit10.kalemler.map((x) => x.tarih));
    if (gecici6) {
      kayit10.notlar.push({ seviye: 'inceleme', kod: 'R133', mesaj: 'Suç 30/03/2020 öncesi: geçici 10/6 normal 105/A tarihi üzerinden hesaplandı. Geçici 6 penceresiyle birlikte uygulanması (ör. 3 + 3 yıl) otomatik yapılmadı; uygulama ve karar yönünden incelenmeli (R133).', kurallar: ['R133', 'R050'] });
    }
    kayit10.notlar.push({ seviye: 'bilgi', kod: 'R132', mesaj: 'Geçici 10/6: hükümlünün talebi, açık kurumda fiilen en az 3 ay, iyi hâl ve kurum/hâkimlik kararı gerekir; koşullu salıverilme tarihi değişmez (R132, R133).', kurallar: ['R132', 'R133'], yalniz_secilince: true });
  }
  yollar.push(kayit10);

  // Hükümlü talep etmezse hiçbir DS yolu uygulanmaz: geçici 6 ve 10/6 da 105/A uygulamasının
  // pencereleridir ve talebe bağlıdır (R040, R132).
  if (baglam.infaz.DS_talebi_var === false) {
    for (const y of yollar) {
      if (y.uygun === false) continue;
      y.uygun = false;
      y.tarih = null;
      y.neden = 'Hükümlünün denetimli serbestlik talebi yok.';
      y.notlar = (y.notlar || []).filter((n) => n.seviye !== 'bilgi');
    }
  }

  // Her yolun tarihi KS tarihini aşamaz; aşıyorsa yol yarar sağlamaz.
  for (const y of yollar) {
    if (y.tarih && sonra(y.tarih, ksTarihi)) {
      y.yarar_yok = true;
      y.neden = `Tarih (${trTarih(y.tarih)}) koşullu salıverilme tarihinden sonra; yol yarar sağlamaz.`;
    }
  }
  return yollar;
}

export function enIyiDsYolu(yollar) {
  const aday = yollar.filter((y) => y.uygun === true && y.tarih && !y.yarar_yok);
  if (!aday.length) return null;
  return aday.reduce((a, b) => (once(b.tarih, a.tarih) ? b : a));
}
