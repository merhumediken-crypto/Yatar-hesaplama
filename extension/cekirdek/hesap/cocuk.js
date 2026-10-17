// Çocukta kurum günü ağırlığı (yalnız koşullu salıverilme süresine uygulanır).
//  - 30/03/2020 ve öncesi suç: 15 yaş altı her gün 3, 18 yaş altı her gün 2 gün (5275 geçici m.6/4; R052)
//  - 18/08/2026 ve sonrası suç: 15 yaş altı her gün 2 gün; m.81-83, 102-103, 188, 220 hariç (5275 m.107/5; R053, SC09)
//  - Aradaki dönem: o tarihteki 107/5 sürümü pakette doğrulanmadığından ağırlık uygulanmaz ve inceleme istenir.

import { degerlendir } from '../dil/kosul.js';
import { once, sonra, gunEkle, yasHesapla } from '../zaman/takvim.js';

export function gunAgirligiBelirle(kt, ortam, baglam, notlar) {
  const yas = ortam.sucYasi;
  if (yas === null || yas >= 18) return null;
  if (yasHesapla(ortam.vaka.dogum_tarihi, ortam.E) >= 18) return null;
  const r52 = kt.p('R052');
  const r53 = kt.p('R053');
  if (!sonra(ortam.ilam.suc_tarihi, r52.suc_tarihi.lte)) {
    return {
      kural: 'R052',
      ad: 'Geçici 6/4: 15 yaş altı her gün 3 gün, 18 yaş altı her gün 2 gün',
      agirlik: (y) => (y < 15 ? r52.yas_15_alti_gun_agirligi : y < 18 ? r52.yas_15_dahil_18_alti_gun_agirligi : 1),
    };
  }
  if (!once(ortam.ilam.suc_tarihi, r53.yururluk) && !once(ortam.hesapTarihi, r53.yururluk)) {
    const istisna = degerlendir({ op: 'secici', secici_id: 'SC09' }, baglam, { seciciler: kt.seciciler });
    if (istisna === true) {
      notlar.ekle('bilgi', 'R053', '107/5 (2026) gün ağırlığı bu suçta uygulanmaz (SC09 istisnası).', ['R053']);
      return null;
    }
    if (istisna === null) {
      notlar.ekle('inceleme', 'R053', '107/5 (2026) istisna kapsamı belirlenemedi; gün ağırlığı uygulanmadı.', ['R053']);
      return null;
    }
    return {
      kural: 'R053',
      ad: '5275 m.107/5 (18/08/2026): 15 yaş altı her gün 2 gün',
      agirlik: (y) => (y < 15 ? r53.yas_15_alti_gun_agirligi : 1),
    };
  }
  notlar.ekle('inceleme', 'E010', '31/03/2020 – 17/08/2026 arası suçta çocuk gün sayımı (107/5) sürümü pakette doğrulanmadı; gün ağırlığı uygulanmadı. 2026 sürümü eski suça aleyhe otomatik uygulanamaz.', ['R053']);
  return null;
}

// Etkin başlangıçtan itibaren her takvim gününü o günkü yaşa göre ağırlıklandırıp
// hedef ağırlıklı güne ulaşılan tarihi döndürür.
export function agirlikliTarih(E, hedef, dogum, agirlik) {
  let toplam = 0;
  let d = 0;
  while (toplam < hedef && d < 60000) {
    toplam += agirlik(yasHesapla(dogum, gunEkle(E, d)));
    d++;
  }
  return gunEkle(E, d);
}

export function agirlikliGunToplami(parcalar, agirlik) {
  return parcalar.reduce((t, p) => t + p.gun * agirlik(p.yas), 0);
}
