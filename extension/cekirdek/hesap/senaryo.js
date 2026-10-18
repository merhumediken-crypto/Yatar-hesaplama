// Tek senaryo hesabı (tekerrürsüz / birinci / ikinci tekerrür).
//
// Akış (kural_tabani.uygulama_sirasi ile aynı sıra):
//   1. Belgeli bağlam + olağan varsayımlar
//   2. Ceza yolu: özel ceza, çocuk adli parası, para-hapis (D001-D005)
//   3. KS engelleri: özel yasak (D018), geri alma (107/13)
//   4. KS süresi: oran adayları + tekerrür + 108/2, veya müebbet süreleri
//   5. Çocukta gün ağırlığı
//   6. Açık kurum planı (doğrudan / kapalıdan / yasak)
//   7. Asgari kurum süresi (D025) ve DS yolları
//   8. Takvim, gerekli kararlar ve durum

import { Kesir } from '../zaman/rasyonel.js';
import { cezaEkle, gunEkle, gunFarki, yilEkle, enErken, once, sonra, trTarih, cezaMetni, subat29Kirpilir } from '../zaman/takvim.js';
import { yuvarla } from '../zaman/profil.js';
import { kararBaglami, varsayimlariUygula } from '../baglam/karar-baglami.js';
import { Notlar, durumBelirle } from '../cikti/notlar.js';
import { ksOraniBelirle, muebbetSuresi } from './oran.js';
import { acikKurumPlani, infazHakimiOnayiGerekir } from './acik-kurum.js';
import { dsYollari, enIyiDsYolu } from './ds.js';
import { gunAgirligiBelirle, agirlikliTarih } from './cocuk.js';

const BASLIKLAR = { yok: 'Tekerrürsüz', birinci: '1. Tekerrür (mükerrir)', ikinci: '2. Tekerrür', birlesik: 'Toplanan cezalar' };

export class SenaryoKaydi {
  constructor(derece) {
    this.anahtar = derece;
    this.baslik = BASLIKLAR[derece];
    this.uygulanabilir = true;
    this.hesaplanamadi = false;
    this.neden = null;
    this.durum = null;
    this.yol = null;
    this.oran = null;
    this.temel_oran = null;
    this.oran_adaylari = [];
    this.ks_ham_gun = null;
    this.ks_gun = null;
    this.ust_sinir_108_2 = null;
    this.muebbet = null;
    this.asgari_kurum = null;
    this.acik_kurum = null;
    this.ds_yollari = [];
    this.secilen_ds_yolu = null;
    this.kurumda_kalis_gun = null;
    this.toplam_infaz_gun = null;
    this.en_cok = false;
    this.takvim = null;
    this.varsayimlar = [];
    this.belirsiz_kosullar = [];
    this.gerekli_kararlar = [];
    this.karar_dugumu_sonuclari = [];
    this.izler = [];
    this.notlar = new Notlar();
    this.kural_idleri = new Set();
  }

  iz(adim, aciklama, kurallar = []) {
    this.izler.push({ adim, aciklama, kurallar });
    kurallar.forEach((k) => this.kural_idleri.add(k));
  }

  karar(metin, kural) {
    if (!this.gerekli_kararlar.some((k) => k.metin === metin)) this.gerekli_kararlar.push({ metin, kural });
  }
}

// Sonuca katkı veren düğümün dayanak kurallarını kaydeder; ihtiyaten çözülmüşse
// sonuç "en çok" olarak işaretlenir.
export function dugumKaydi(S, sonuc, { ihtiyatEtkili = true } = {}) {
  sonuc.dayanak_kurallar.forEach((k) => S.kural_idleri.add(k));
  if (ihtiyatEtkili && sonuc.ihtiyatli) S.en_cok = true;
}

function senaryoHesaplaIc(kt, motor, ortam, derece) {
  const S = new SenaryoKaydi(derece);
  const { ilam, vaka, E, profil } = ortam;

  if (derece !== 'yok' && ortam.sucYasi !== null && ortam.sucYasi < 18) {
    S.uygulanabilir = false;
    S.neden = 'Suç 18 yaşından önce işlenmiş; tekerrür hükümleri uygulanmaz (TCK 58/5).';
    S.kural_idleri.add('R013');
    return bitir(S);
  }

  // 1. Bağlam
  const belgeli = kararBaglami(kt, ortam, { tekerrur: derece });
  const { baglam, uygulanan } = varsayimlariUygula(belgeli);
  S.varsayimlar = uygulanan;
  const tum = motor.tumu(baglam);
  const belgeliTum = motor.tumu(belgeli);
  // Gerekçe tablosu: her düğümün belgeli ve varsayımlı değeri ile koşul izi.
  S.karar_dugumu_sonuclari = tum.map((d, i) => ({ ...d, belgeli_deger: belgeliTum[i].deger, belgeli_belirsiz_alanlar: belgeliTum[i].belirsiz_alanlar }));
  S.belirsiz_kosullar = belirsizKosullar(belgeli, belgeliTum);
  const kd = (id) => {
    const s = motor.karar(id, baglam);
    dugumKaydi(S, s);
    return s;
  };

  // 2. Ceza yolu
  const tur = baglam.ilam.ceza_turu;
  if (kd('D005').cozulen === true) {
    S.hesaplanamadi = true;
    S.yol = 'ozel_ceza';
    S.neden = 'Tazyik, disiplin veya zorlama hapsi genel hapis oranlarıyla hesaplanmaz; ayrı mevzuat incelemesi gerekir (D005).';
    S.notlar.ekle('inceleme', 'E014', S.neden, ['R032', 'R080']);
    return bitir(S);
  }
  if (tur === 'adli_para') {
    const c = kd('D004');
    S.uygulanabilir = false;
    S.yol = 'adli_para';
    S.neden = c.cozulen === true
      ? 'Çocuk hakkında hükmedilen adli para cezası hapse çevrilemez; 5275 m.106/11 uyarınca tahsil edilir (D004).'
      : 'Adli para cezasında kurumda kalış hesabı yapılmaz; ödenmeyip hapse çevrilmişse ceza türü "adli paradan çevrilen hapis" seçilmelidir (E011).';
    return bitir(S);
  }

  const bihakkin = cezaHesabi(S, ortam);
  if (kd('D001').cozulen === true) return paraHapis(S, kt, motor, ortam, baglam, kd, bihakkin);

  // 3. KS engelleri
  if (kd('D018').cozulen === true) {
    const k = belgeli._kanuni_ks_yasagi;
    S.yol = 'ks_yasagi';
    S.iz('Koşullu salıverilme yasağı', k ? k.neden : 'Doğrulanmış özel koşullu salıverilme yasağı (D018).', [k?.kural || 'R032']);
    S.notlar.ekle('inceleme', 'R116', 'Özel koşullu salıverilme yasağı bulunan cezada olağan DS hesabı kurulmaz.', ['R032', 'R116']);
    if (tur === 'agirlastirilmis_muebbet' || tur === 'muebbet') {
      S.hesaplanamadi = true;
      S.neden = 'Koşullu salıverilme hükümleri uygulanmaz; ceza hayat boyu devam eder.';
      return bitir(S);
    }
    return takvimiKur(S, ortam, { ksTarihi: null, cikis: bihakkin, bihakkin, dsYok: true });
  }
  if (baglam.ilam.KS_geri_alinmis_aynen_infaz === true) {
    S.yol = 'geri_alma';
    S.iz('Geri alma', 'Bu hükümde koşullu salıverilme geri alınmış: aynı hükümde yeniden KS verilmez; geri alma kararındaki süre aynen infaz edilir (5275 m.107/13).', ['R074']);
    S.notlar.ekle('inceleme', 'R074', 'Geri alma kararında takdir edilen aynen infaz süresi esas alınmalıdır.', ['R074']);
    return takvimiKur(S, ortam, { ksTarihi: null, cikis: bihakkin, bihakkin, dsYok: true });
  }

  // 4. KS süresi
  let ksTarihi;
  let ksHam;
  if (tur === 'sureli_hapis') {
    S.yol = 'sureli_hapis';
    if (derece === 'ikinci' && once(ortam.hesapTarihi, kt.p('R028').yururluk)) {
      S.iz('İkinci tekerrür (eski 108/3)', 'Hesap tarihi 04/06/2025 öncesi: ikinci tekerrürde koşullu salıverilme yasağı (tarihsel sürüm).', ['R029']);
      S.notlar.ekle('inceleme', 'E010', 'Eski 108/3 salıverilme yasağı tarihsel sürümdür; lehe 7550 değerlendirmesi gerekir.', ['R029']);
      return takvimiKur(S, ortam, { ksTarihi: null, cikis: bihakkin, bihakkin, dsYok: true });
    }
    const o = ksOraniBelirle(kt, motor, baglam, derece);
    o.adaylar.filter((a) => a.cozulen === true).forEach((a) => dugumKaydi(S, a, { ihtiyatEtkili: false }));
    if (o.temel.ihtiyatli) S.en_cok = true;
    S.oran_adaylari = o.adaylar.map((a) => ({ dugum_id: a.dugum_id, ad: a.ad, oran: a.sonuc_adayi.oran, deger: a.deger, cozulen: a.cozulen, ihtiyatli: a.ihtiyatli }));
    S.temel_oran = { oran: o.temel.oran, kaynak: o.temel.kaynak, dugum_id: o.temel.dugum_id, neden: o.temel.neden };
    S.kural_idleri.add(o.temel.kaynak);
    const T = ortam.toplamGun;
    ksHam = new Kesir(T).carp(o.temel.oran);
    S.iz('Temel oran', `${o.temel.neden} → ${T} × ${o.temel.oran} = ${ksHam.ondalik()} gün.`, [o.temel.kaynak]);
    if (o.temel.ihtiyatli) S.notlar.ekle('varsayim', 'E001', `${o.temel.neden.replace(/\.$/, '')} — fıkra/bent veya kapsam bilgisi eksik olduğundan daha ağır oran ihtiyaten uygulandı; sonuç "en çok" değerdir.`, [o.temel.kaynak]);

    if (o.tekerrur) {
      dugumKaydi(S, o.tekerrur.dugum);
      if (o.tekerrur.oran) {
        const temelKs = ksHam;
        let ham = new Kesir(T).carp(o.oran);
        S.iz(derece === 'birinci' ? 'Birinci tekerrür' : 'İkinci tekerrür', `max(temel ${o.temel.oran}, ${o.tekerrur.oran}) = ${o.oran} → ${ham.ondalik()} gün (${derece === 'birinci' ? '5275 m.108/1-d' : '5275 m.108/3, 7550 m.14; 108/2 sınırı uygulanmaz'}).`, o.tekerrur.dugum.dayanak_kurallar);
        if (derece === 'birinci') {
          const C = vaka.tekerrure_esas_en_agir_ceza || ortam.tekerrur?.tekerrure_esas_en_agir_ceza || null;
          if (C) {
            const cGun = gunFarki(E, cezaEkle(E, C));
            const ust = temelKs.topla(cGun);
            S.ust_sinir_108_2 = { ceza: C, gun: cGun, ust_sinir: ust, uygulandi: ham.karsilastir(ust) > 0 };
            if (S.ust_sinir_108_2.uygulandi) ham = ust;
            S.iz('108/2 üst sınırı', `Tekerrür nedeniyle eklenen süre, tekerrüre esas en ağır cezayı (${cezaMetni(C)} = ${cGun} gün) aşamaz: üst sınır ${temelKs.ondalik()} + ${cGun} = ${ust.ondalik()} gün; ${S.ust_sinir_108_2.uygulandi ? 'uygulandı' : 'aşılmadı'}.`, ['R027']);
          } else {
            S.en_cok = true;
            S.notlar.ekle('varsayim', 'R027', 'Tekerrüre esas en ağır önceki ceza girilmedi; 108/2 üst sınırı uygulanamadı. Sonuç "en çok" değerdir; gerçek süre daha kısa olabilir.', ['R027']);
          }
        } else if (o.tekerrur.dugum.sonuc_adayi.lehe_surum_ve_karar_kontrolu) {
          if (once(ilam.suc_tarihi, kt.p('R028').yururluk)) {
            S.notlar.ekle('inceleme', 'E010', 'Suç 04/06/2025 öncesi: eski 108/3 koşullu salıverilme yasağı yerine 7550 ile gelen 3/4 oranının lehe kanun olarak uygulanması incelenmeli (D016, R029).', ['R028', 'R029']);
          } else {
            S.notlar.ekle('inceleme', 'D016', 'İkinci tekerrür sonuç adayı lehe sürüm ve hükümde ikinci tekerrürün belirtildiği kararın denetimini şart koşar (D016; 5275 m.108/3 son cümle).', ['R028', 'R014']);
          }
        }
        ksHam = ham;
        S.notlar.ekle('bilgi', 'R073', 'Mükerrirlere özgü infaz rejimi: cezanın infazı tamamlandıktan sonra en az 1 yıl denetim süresi; infaz hâkimi kararıyla en çok 5 yıla kadar uzatılabilir (5275 m.108/4-6).', ['R073']);
      } else {
        S.uygulanabilir = false;
        S.neden = `${o.tekerrur.dugum.ad} düğümü bu dosyada uygulanamıyor.`;
        return bitir(S);
      }
    }
    S.oran = o.oran;
    S.ks_ham_gun = ksHam;
    S.ks_gun = yuvarla(profil, ksHam);
    ksTarihi = gunEkle(E, S.ks_gun);
  } else if (tur === 'muebbet' || tur === 'agirlastirilmis_muebbet') {
    S.yol = tur;
    if (ortam.sucYasi !== null && ortam.sucYasi < 18) {
      S.hesaplanamadi = true;
      S.neden = 'Çocuk hükümlüde müebbet sonuç ceza ve KS süreleri bu pakette modellenmedi (TCK 31).';
      S.notlar.ekle('inceleme', 'R030', S.neden, ['R030']);
      return bitir(S);
    }
    const m = muebbetSuresi(kt, baglam, derece, ilam);
    S.muebbet = m;
    S.kural_idleri.add(m.kural);
    if (m.ihtiyatli) S.en_cok = true;
    ksTarihi = yilEkle(E, m.yil);
    S.iz('Müebbet koşullu salıverilme', `${tur === 'agirlastirilmis_muebbet' ? 'Ağırlaştırılmış müebbet' : 'Müebbet'} — ${m.ad}: ${m.yil} yıl → ${trTarih(ksTarihi)}.`, [m.kural, 'R030']);
    S.notlar.ekle('inceleme', 'R030', 'Müebbet hesapları özel dosya incelemesi gerektirir; kanuni süre kategorileri kullanıldı.', ['R030']);
  } else {
    S.hesaplanamadi = true;
    S.neden = 'Bu ceza türü için genel hapis hesabı yapılmaz.';
    return bitir(S);
  }

  // 5. Çocukta gün ağırlığı
  const agirlik = gunAgirligiBelirle(kt, ortam, baglam, S.notlar);
  if (agirlik && S.ks_gun !== null) {
    ksTarihi = agirlikliTarih(E, S.ks_gun, vaka.dogum_tarihi, agirlik.agirlik);
    S.iz('Çocukta gün ağırlığı', `${agirlik.ad}: ${S.ks_gun} ağırlıklı güne ${gunFarki(E, ksTarihi)} takvim gününde ulaşılır (yalnız KS süresine uygulanır).`, [agirlik.kural]);
  }
  if (S.ks_ham_gun) S.iz('Koşullu salıverilme', `${S.ks_ham_gun.ondalik()} → ${S.ks_gun} gün; tarih ${trTarih(ksTarihi)}.`, ['R003']);

  // 6. Açık kurum
  const acik = acikKurumPlani(kt, motor, ortam, baglam, ksTarihi);
  S.acik_kurum = acik;
  if (acik.dogrudan) acik.dogrudan.dugumler.forEach((d) => dugumKaydi(S, d));
  if (acik.yol === 'yasak') {
    acik.yasaklar.forEach((y) => S.iz('Açık kurum yasağı', y.neden, [y.kural]));
  } else if (acik.yol === 'dogrudan') {
    S.iz('Açık kurum', acik.dogrudan.neden, ['R060', 'R080']);
    if (acik.dogrudan.norm_cakismasi) S.notlar.ekle('bilgi', acik.dogrudan.norm_cakismasi, kt.normCakismalari.get(acik.dogrudan.norm_cakismasi)?.tespit || '', ['R080']);
  } else {
    S.iz('Açık kurum', acik.dogrudan.neden, ['R060']);
    acik.kapali.kalemler.forEach((k) => S.iz('Kapalıdan açığa', `${k.ad} → ${trTarih(k.tarih)}`, [k.kural]));
    S.iz('Açığa ayrılma tarihi', acik.kapali.aciklama, ['R081']);
    const onay = infazHakimiOnayiGerekir(kt, baglam, ortam);
    S.karar(`İdare ve gözlem kurulunun açık kuruma ayırma kararı (5275 m.14/3, m.89)${onay.length ? `; infaz hâkimi onayı gerekir: ${onay.join(', ')} (m.14/4)` : ''}`, 'R088');
    if (acik.kapali.ihtiyatli) S.en_cok = true;
  }

  // 7. Asgari kurum süresi ve DS yolları
  const asg = kd('D025');
  let asgariTarihi = null;
  if (asg.cozulen === true) {
    const kurumKs = S.ks_ham_gun && !agirlik ? S.ks_ham_gun : new Kesir(gunFarki(E, ksTarihi));
    const onda = Kesir.from(asg.sonuc_adayi.oran);
    const ham = Kesir.max(asg.sonuc_adayi.asgari_gun, kurumKs.carp(onda));
    const gun = yuvarla(profil, ham);
    asgariTarihi = gunEkle(E, gun);
    S.asgari_kurum = { uygulanir: true, ham, gun, tarih: asgariTarihi };
    S.iz('Asgari kurum süresi', `max(${asg.sonuc_adayi.asgari_gun} gün, ${kurumKs.ondalik()} × ${onda} = ${kurumKs.carp(onda).ondalik()}) = ${ham.ondalik()} → ${gun} gün (5275 m.105/A/1 son cümle; yalnız DS yolunun şartı).`, ['R042']);
  } else {
    S.asgari_kurum = { uygulanir: false };
    kd('D026');
    S.iz('Asgari kurum süresi', 'Suç 04/06/2025 öncesi: onda bir / 5 gün şartı uygulanmaz.', ['R042']);
  }

  const yollar = dsYollari(kt, motor, ortam, baglam, { ksTarihi, asgariTarihi, acik });
  // DS kapı düğümleri (D020-D022) aday tarihte "KS'ye … yıl veya az kaldı" kabulüyle değerlendirilir;
  // gerekçe tablosunda bu değerlendirme gösterilir.
  for (const y of yollar) {
    if (!y.kapi_sonucu) continue;
    const i = S.karar_dugumu_sonuclari.findIndex((d) => d.dugum_id === y.dugum_id);
    if (i >= 0) S.karar_dugumu_sonuclari[i] = { ...S.karar_dugumu_sonuclari[i], ...y.kapi_sonucu, aday_tarihte: true };
    delete y.kapi_sonucu;
  }
  return dsSecVeTakvimKur(S, ortam, { yollar, ksTarihi, bihakkin: tur === 'sureli_hapis' ? bihakkin : null, acik });
}

// DS yollarından en erken uygun olanı seçer, gerekli kararları ve takvimi kurar.
// Tek ilam senaryosu ve toplama (toplama/toplama.js) aynı adımı kullanır.
export function dsSecVeTakvimKur(S, ortam, { yollar, ksTarihi, bihakkin, acik }) {
  S.ds_yollari = yollar;
  for (const y of yollar) {
    if (y.uygun === true || y.ihtiyatli) S.kural_idleri.add(y.kural);
  }
  // Geçici 10/6 dahil bütün yollar karşılaştırılır; en erken uygun yol seçilir (R056, R134).
  const enIyi = enIyiDsYolu(yollar);
  S.secilen_ds_yolu = enIyi ? enIyi.id : null;
  for (const y of yollar) for (const n of y.notlar || []) if (!n.yalniz_secilince || y === enIyi) S.notlar.ekle(n.seviye, n.kod, n.mesaj, n.kurallar);
  if (enIyi?.id === 'gecici10_6') S.kural_idleri.add('R055').add('R132').add('R133').add('R134');
  if (acik.kapali?.gecici10) S.kural_idleri.add('R130').add('R131');

  let cikis = ksTarihi;
  if (enIyi) {
    enIyi.kalemler.forEach((k) => S.iz(enIyi.ad, `${k.ad} → ${trTarih(k.tarih)}`, [enIyi.kural]));
    cikis = enErken(enIyi.tarih, ksTarihi);
    S.iz('Sonuç', `En erken uygun yol: ${enIyi.ad} → ${trTarih(cikis)}.`, ['R043']);
    S.karar(`İyi hâl kararı, hükümlünün talebi ve infaz hâkiminin DS kararı (${enIyi.ad})`, enIyi.kural);
    if (enIyi.ihtiyatli) S.en_cok = true;
  } else {
    const neden = acik.yol === 'yasak' ? 'açık kuruma ayrılma yasağı nedeniyle 105/A yolu kapalı' : 'uygun DS yolu yok';
    S.iz('Sonuç', `Denetimli serbestlik yolu yok (${neden}); çıkış koşullu salıverilme tarihinde.`, ['R043']);
    if (acik.yol === 'yasak') S.notlar.ekle('inceleme', 'E005', 'Açık kuruma ayrılma yasağı bulunan dosyada 105/A/2 (iradesi dışında açığa ayrılamama) ve özel yollar ayrıca incelenmeli.', ['R087', 'R040']);
  }
  S.karar('İyi hâl ve infaz hâkiminin koşullu salıverilme kararı (5275 m.107/1, 107/11)', 'R062');

  return takvimiKur(S, ortam, { ksTarihi, cikis, bihakkin, dsTarihi: enIyi ? enIyi.tarih : null });
}

// Ceza süresinin takvime işlenmesi (yıl resmî takvim, ay 30 gün; TCK 61/6).
function cezaHesabi(S, ortam) {
  if (!ortam.ceza) return null;
  const bihakkin = cezaEkle(ortam.E, ortam.ceza);
  S.iz('Ceza süresi', `${cezaMetni(ortam.ceza)}: ${trTarih(ortam.E)} etkin başlangıçtan takvimle ${ortam.toplamGun} gün (yıl resmî takvim, ay 30 gün; TCK 61/6).`, ['R003']);
  if (subat29Kirpilir(ortam.E, ortam.ceza.yil)) S.notlar.ekle('bilgi', 'R003', '29 Şubat başlangıcında yıl eklemesi 28 Şubat\'a çekildi.', ['R003']);
  return bihakkin;
}

function paraHapis(S, kt, motor, ortam, baglam, kd, bihakkin) {
  S.yol = kd('D002').cozulen === true ? 'cek_5_11' : 'para_hapis';
  const r103 = kt.p('R103');
  let cikis = bihakkin;
  if (ortam.ceza && sonra(bihakkin, yilEkle(ortam.E, r103.tek_hukum_azami_yil))) {
    cikis = yilEkle(ortam.E, r103.tek_hukum_azami_yil);
    S.iz('106/7 üst sınırı', `Adli para yerine çektirilecek hapis tek hükümde ${r103.tek_hukum_azami_yil} yılı geçemez; hapisle karşılanmayan bakiye 106/11 uyarınca tahsil edilir.`, ['R103']);
  }
  S.iz('Adli paradan çevrilen hapis', 'Koşullu salıverilme ve 105/A denetimli serbestlik uygulanmaz (5275 m.106/9, 105/A/4); kalan günlerin para karşılığı ödenirse infaz sona erer (106/8). Ceza doğrudan açık kurumda infaz edilir (m.14/2-c).', ['R044', 'R102', 'R105']);
  if (S.yol === 'cek_5_11') S.iz('Çek m.5/11', 'Karşılıksız çek adli parası kamuya yararlı iş aşaması olmadan doğrudan hapse çevrilir (5941 m.5/11).', ['R101']);
  const odeme = kd('D045');
  if (odeme.cozulen === true) {
    S.iz('Ödeme', 'Kalan infaz günlerinin karşılığının tam ödendiği doğrulandı: 106/8 sonuçları incelenir; başka ilam/tutuklama ayrıca kontrol edilir. Çek borcu kendiliğinden sona ermez.', ['R105']);
    S.karar('Ödeme sonrası Cumhuriyet başsavcılığının salıverme işlemi (5275 m.106/8)', 'R105');
  }
  S.notlar.ekle('inceleme', 'E012', 'Para-gün ilişkisi ilam ve çevirme kararından doğrulanmalı; toplam tutar sabit bir TL/gün oranıyla bölünerek süre üretilmez (R122).', ['R122', 'R102']);
  if (ortam.vaka.rapor_105A_3_b === true) S.notlar.ekle('bilgi', 'R071', 'Ağır hastalık raporu: normal DS uygulanmaz; 5275 m.110/3 konutta infaz olanağı ayrıca incelenebilir.', ['R071', 'R102']);
  S.uygulanabilir = S.anahtar === 'yok';
  if (!S.uygulanabilir) S.neden = 'Adli paradan çevrilen hapiste tekerrür koşullu salıverilme hesabını değiştirmez.';
  return takvimiKur(S, ortam, { ksTarihi: null, cikis, bihakkin, dsYok: true, dogrudanAcik: true });
}

function takvimiKur(S, ortam, { ksTarihi, cikis, bihakkin, dsTarihi = null, dsYok = false, dogrudanAcik = false }) {
  // Mahsupla daha önce tamamlanan eşikler bu giriş için geçmiş bir fizikî çıkış
  // oluşturmaz. Faz 3'ün sıfır kalan gün davranışını çekirdek/ekran arasında tutarlı tut.
  const ksSure = ksTarihi ? gunFarki(ortam.E, ksTarihi) : null;
  const tabanaCek = (tarih) => tarih && once(tarih, ortam.baslama) ? ortam.baslama : tarih;
  cikis = tabanaCek(cikis);
  ksTarihi = tabanaCek(ksTarihi);
  dsTarihi = tabanaCek(dsTarihi);
  bihakkin = tabanaCek(bihakkin);
  S.kurumda_kalis_gun = cikis ? Math.max(0, gunFarki(ortam.baslama, cikis)) : null;
  S.toplam_infaz_gun = cikis ? Math.max(0, gunFarki(ortam.E, cikis)) : null;
  S.takvim = {
    infaza_baslama: ortam.baslama,
    etkin_baslangic: ortam.E,
    mahsup_gun: ortam.mahsup.gun,
    kapalidan_aciga_hak_kazanma: dogrudanAcik ? ortam.E : S.acik_kurum?.tarih ?? null,
    DSye_hak_kazanma: dsYok ? null : dsTarihi,
    kurumdan_cikis: cikis,
    kosullu_saliverilme: ksTarihi,
    hak_ederek_tahliye: bihakkin,
    // 5275 m.107/6: denetim süresi KS için kurumda geçirilmesi gereken süre kadardır; süreli hapiste hak ederek tahliyeyi geçemez.
    karar_sonrasi_denetim_bitis: ksTarihi && bihakkin ? enErken(gunEkle(ksTarihi, ksSure), bihakkin) : null,
    toplam_ceza_gun: ortam.toplamGun,
    ds_suresi_gun: !dsYok && dsTarihi && ksTarihi ? Math.max(0, gunFarki(cikis, ksTarihi)) : 0,
  };
  return bitir(S);
}

export function bitir(S) {
  S.durum = !S.uygulanabilir ? 'uygulanamaz' : S.hesaplanamadi ? 'hukuki_inceleme_gerekli' : null;
  return S;
}

// Belgeli bağlamda belirsiz kalan ve kullanıcının girebileceği alanlar. Zaman
// çizelgesinden türetilen infaz kapıları ve dosyayla ilgisiz düğüm grupları hariç.
const TURETILEN_ALAN = /^(infaz\.(KSye_|aciga_ayrilma|iradesi_disinda|kurum$)|g10\.|hesap\.)/;
export function belirsizKosullar(belgeli, sonuclar) {
  const cek = belgeli.ilam.kanun === 5941;
  const adliPara = belgeli.ilam.ceza_turu === 'adli_para';
  const alanlar = sonuclar
    .filter((d) => d.deger === null)
    .filter((d) => (cek || !d.grup.startsWith('cek_')) && (adliPara || d.dugum_id !== 'D004'))
    .flatMap((d) => d.belirsiz_alanlar)
    .filter((a) => !TURETILEN_ALAN.test(a));
  return [...new Set(alanlar)];
}

export function senaryoHesapla(kt, motor, ortam, derece) {
  try {
    return senaryoHesaplaIc(kt, motor, ortam, derece);
  } catch (hata) {
    if (!(hata instanceof RangeError)) throw hata;
    const S = new SenaryoKaydi(derece);
    S.hesaplanamadi = true;
    S.neden = 'Girilen süre hesaplanabilir sınırı aşıyor; kesilmiş veya yaklaşık bir çıkış tarihi üretilmedi.';
    S.notlar.ekle('inceleme', 'E006', S.neden, ['R003']);
    return bitir(S);
  }
}

export { durumBelirle };
