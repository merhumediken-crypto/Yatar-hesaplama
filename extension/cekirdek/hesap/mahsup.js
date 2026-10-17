// Mahsup (TCK 63; CMK 109/6; R004).
//  - Gözaltı ve tutuklulukta geçen her gün bir gün sayılır.
//  - Konutu terk etmeme adli kontrolünde geçen her iki gün bir gün sayılır (CMK 109/6, 7331).
//  - Bu ilamın infazı sırasında denetimli serbestlikte geçen süre infazdan sayılır; DS'den geri
//    gönderilen hükümlü açık kurumda devam eder, KS tarihi değişmez (5275 m.105/A/6-7).
//  - Aynı takvim günü iki kez sayılamaz (V08); aralıklar verilmişse çakışma denetlenir.

import { Kesir } from '../zaman/rasyonel.js';
import { gunFarki, gunNo, trTarih } from '../zaman/takvim.js';
import { yuvarla } from '../zaman/profil.js';

const ORANLAR = {
  gozalti: { oran: new Kesir(1), etiket: 'Gözaltı', kural: 'R004' },
  tutukluluk: { oran: new Kesir(1), etiket: 'Tutukluluk', kural: 'R004' },
  konutu_terk_etmeme: { oran: new Kesir(1, 2), etiket: 'Konutu terk etmeme (2 gün = 1 gün)', kural: 'R004' },
  denetimli_serbestlik: { oran: new Kesir(1), etiket: 'Denetimli serbestlikte geçen süre', kural: 'R040' },
  diger: { oran: new Kesir(1), etiket: 'Diğer özgürlük kısıtlaması', kural: 'R004' },
};

export function mahsupHesapla(kt, kayitlar, profil, notlar) {
  if (!kayitlar) {
    notlar.ekle('varsayim', 'mahsup', 'Mahsup kaydı girilmedi; mahsup yok kabul edildi.', ['R004']);
    return { gun: 0, ham: new Kesir(0), kalemler: [] };
  }
  const p = kt.p('R004');
  const kalemler = [];
  let ham = new Kesir(0);
  const araliklar = [];
  for (const k of kayitlar) {
    let gun = k.gun;
    if (gun === null && k.baslangic && k.bitis) {
      gun = gunFarki(k.baslangic, k.bitis) + 1;
      araliklar.push({ ...k, bas: gunNo(k.baslangic), bit: gunNo(k.bitis) });
      notlar.ekle('varsayim', 'A01', `${k.kayit_id}: ${trTarih(k.baslangic)}–${trTarih(k.bitis)} aralığında başlangıç ve bitiş günleri dahil sayıldı (A01).`, ['R004']);
    }
    if (gun === null || gun < 0) continue;
    const t = ORANLAR[k.tur] || ORANLAR.diger;
    const oran = k.tur === 'konutu_terk_etmeme' && p.konutu_terk_etmeme_iki_gun_bir_gun ? new Kesir(1, 2) : t.oran;
    const kabul = new Kesir(gun).carp(oran);
    ham = ham.topla(kabul);
    kalemler.push({ kayit_id: k.kayit_id, tur: k.tur, etiket: t.etiket, gun, oran, kabul, kaynak_karar: k.kaynak_karar });
    if (k.tur === 'denetimli_serbestlik') notlar.ekle('bilgi', 'R040', `${k.kayit_id}: denetimli serbestlikte geçen ${gun} gün infazdan sayıldı. DS'den geri gönderilen hükümlü açık kurumda devam eder; koşullu salıverilme tarihi değişmez (5275 m.105/A/6-7).`, ['R040']);
    if (k.tur === 'diger') notlar.ekle('inceleme', 'E006', `${k.kayit_id}: "diğer" türündeki özgürlük kısıtlamasının mahsubu dayanak kararla doğrulanmalı.`, ['R004']);
  }
  // V08: aynı gün iki kez sayılamaz
  araliklar.sort((a, b) => a.bas - b.bas);
  for (let i = 1; i < araliklar.length; i++) {
    if (araliklar[i].bas <= araliklar[i - 1].bit) {
      notlar.ekle('inceleme', 'E006', `Mahsup aralıkları çakışıyor (${araliklar[i - 1].kayit_id} ve ${araliklar[i].kayit_id}); aynı gün iki kez sayılamaz (V08).`, ['R004']);
    }
  }
  const gun = yuvarla(profil, ham);
  if (!ham.tamMi()) notlar.ekle('varsayim', 'A01', `Mahsup ${ham.ondalik()} gün → ${gun} gün (${profil.gun_kusurati === 'yukari' ? 'yukarı' : 'aşağı'} yuvarlama; A01).`, ['R004', 'R003']);
  if (gun > 0 && profil.mahsup_kurumda_gecmis_sayilir) {
    notlar.ekle('varsayim', 'A01', `${gun} gün mahsup, kurumda geçmiş gün olarak hem koşullu salıverilme hem asgari kurum ve açığa ayrılma sürelerine sayıldı; tüm kombinasyonlar A01 kabul testine tabidir.`, ['R004', 'R042']);
  }
  return { gun, ham, kalemler };
}
