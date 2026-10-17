// Usul süreleri: DS müdürlüğüne başvuru, infaz işlemine şikâyet ve infaz hâkimliği
// kararına itiraz. Resmî tatil takvimi pakette bulunmadığından yalnız hafta sonu
// kaydırması yapılır ve resmî tatil kontrolü ayrıca istenir.

import { gunEkle, enErken, haftaSonuSonrasi, haftaGunu, once, trTarih } from '../zaman/takvim.js';

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function sonGun(tarih) {
  const kaydirilmis = haftaSonuSonrasi(tarih);
  return { tarih: kaydirilmis, gun_adi: GUNLER[haftaGunu(kaydirilmis)], hafta_sonundan_kaydirildi: kaydirilmis !== tarih, ham_tarih: tarih };
}

// 5275 m.105/A/6-a ve DS Yönetmeliği m.79 (R090): kurumdan ayrılıştan sonra 5 gün içinde
// başvuru; süre ayrılışı izleyen gün başlar.
export function dsBasvuruSuresi(kt, ayrilis) {
  const p = kt.p('R090');
  const ilk = gunEkle(ayrilis, 1);
  const son = sonGun(gunEkle(ilk, p.sure_gun - 1));
  return {
    kural: 'R090',
    ilk_sayilan_gun: ilk,
    son_gun: son,
    aciklama: `Ayrılış ${trTarih(ayrilis)} → süre ${trTarih(ilk)} günü başlar; ${p.sure_gun}. gün ${trTarih(son.ham_tarih)}${son.hafta_sonundan_kaydirildi ? `, hafta sonu nedeniyle ${trTarih(son.tarih)} ${son.gun_adi} mesai bitimi` : ''}. Resmî tatiller ayrıca kontrol edilmeli. 6-7. gündeki mazeret infaz hâkimince incelenir.`,
  };
}

// 4675 m.5 (R098): öğrenmeden itibaren 15 gün ve her hâlde işlemden itibaren 30 gün.
export function sikayetSuresi(kt, { ogrenme, islem }) {
  const p = kt.p('R098');
  const a = ogrenme ? gunEkle(ogrenme, p.ogrenmeden_gun) : null;
  const b = islem ? gunEkle(islem, p.islemden_azami_gun) : null;
  const son = a || b ? sonGun(enErken(a, b)) : null;
  return {
    kural: 'R098',
    son_gun: son,
    aciklama: son ? `Öğrenmeden ${p.ogrenmeden_gun} gün${a ? ` (${trTarih(a)})` : ''} ve işlemden her hâlde ${p.islemden_azami_gun} gün${b ? ` (${trTarih(b)})` : ''}; hangisi önce dolarsa: ${trTarih(son.tarih)}. Başvuru infazı kendiliğinden durdurmaz.` : 'Öğrenme veya işlem tarihi gerekir.',
  };
}

// 4675 m.6 (R099, R128): itiraz süresi; 01/06/2024 ve sonrasında verilen kararlarda tebliğden iki hafta.
export function itirazSuresi(kt, { teblig, karar_tarihi = null }) {
  const p = kt.p('R099');
  const esik = kt.esik('T20');
  if (karar_tarihi && once(karar_tarihi, esik)) {
    return { kural: 'R128', son_gun: null, inceleme: true, aciklama: `Karar ${trTarih(karar_tarihi)} tarihli: 01/06/2024 öncesi kararlarda değişiklikten önceki hükümler uygulanır (7499 geçici m.1); süre bu pakette hesaplanmaz.` };
  }
  const son = sonGun(gunEkle(teblig, p.sure_hafta * 7));
  return {
    kural: 'R099',
    sure_hafta: p.sure_hafta,
    son_gun: son,
    aciklama: `Tebliğ ${trTarih(teblig)} → ${p.sure_hafta} hafta: ${trTarih(son.tarih)} ${son.gun_adi}${son.hafta_sonundan_kaydirildi ? ' (hafta sonundan kaydırıldı)' : ''}. Merci: ${p.mercii}.${karar_tarihi ? '' : ' Karar tarihi 01/06/2024 ve sonrası varsayıldı.'}`,
  };
}
