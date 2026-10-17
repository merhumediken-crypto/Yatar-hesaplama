// Hesap profili. Kural tabanı (A01) kesirli gün sırası, ay yöntemi ve mahsup
// etkileşimini gerçek müddetnamelerle kabul testine bırakır; "bir sonuca ulaşmak
// için yuvarlama sırası icat edilmez". Bu nedenle bu seçimler kodun içine gömülmez,
// adı ve kimliği olan bir profilde toplanır ve her çıktıyla birlikte saklanır.

import { Kesir } from './rasyonel.js';
import { gunEkle, takvimAyiEkle } from './takvim.js';

export const PROFIL_SECENEKLERI = {
  gun_kusurati: {
    asagi: 'Aşağı (TCK 61/6: gün artığı infaz edilmez)',
    yukari: 'Yukarı',
  },
  kurum_ayi: {
    '30_gun': '30 gün (TCK 61/6 ay tanımı)',
    takvim_ayi: 'Takvim ayı',
  },
};

const VARSAYILAN = {
  gun_kusurati: 'asagi',
  kurum_ayi: '30_gun',
  // Gözaltı/tutuklulukta geçen ve mahsup edilen günler, KS'ye kadar kurumda
  // geçirilmesi gereken süreye ve 105/A asgari kurum süresine sayılır.
  mahsup_kurumda_gecmis_sayilir: true,
};

export function profilOlustur(ayar = {}) {
  const p = { ...VARSAYILAN };
  for (const anahtar of Object.keys(PROFIL_SECENEKLERI)) {
    if (ayar[anahtar] && ayar[anahtar] in PROFIL_SECENEKLERI[anahtar]) p[anahtar] = ayar[anahtar];
  }
  if (typeof ayar.mahsup_kurumda_gecmis_sayilir === 'boolean') p.mahsup_kurumda_gecmis_sayilir = ayar.mahsup_kurumda_gecmis_sayilir;
  return Object.freeze({
    ...p,
    id: `A01-taslak/${p.gun_kusurati}/${p.kurum_ayi === '30_gun' ? 'ay30' : 'takvimay'}${p.mahsup_kurumda_gecmis_sayilir ? '' : '/mahsupsuz'}`,
    kabul_testi_yapildi: false,
    acik_konu: 'A01',
  });
}

export const VARSAYILAN_PROFIL = profilOlustur();

export function yuvarla(profil, kesir) {
  return Kesir.from(kesir).yuvarla(profil.gun_kusurati);
}

// Yönetmelikteki "kurumda geçen ay" gibi süreler için profil yöntemi.
export function kurumAyiEkle(profil, tarih, ay) {
  return profil.kurum_ayi === 'takvim_ayi' ? takvimAyiEkle(tarih, ay) : gunEkle(tarih, ay * 30);
}
