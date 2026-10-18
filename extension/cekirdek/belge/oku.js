// Belge okuma giriş noktası: metin → belge türü → yapılandırılmış okuma sonucu.
//
// Sonuç biçimi (bütün türlerde aynı; okunamayan alan null):
//   {
//     tur: 'ictima_karari' | 'muddetname' | 'gerekceli_karar' | 'bilinmiyor',
//     tur_adi,
//     kisi: { ad, dogum_tarihi, kaynak } | null,
//     karar: { mahkeme, dosya_no, karar_no, karar_tarihi } | null,   // içtima kararı
//     ilamlar: [{ sira, mahkeme, mahkeme_kisa, karar_tarihi, esas_no, karar_no, infaz_no,
//                 ceza, ceza_turu, etiket, suc_tarihi, suc_adi, maddeler, kesinlesme_tarihi, kaynak }],
//     toplam: { ceza, ilamlar_toplami, uyusuyor, kaynak } | null,
//     infaz: { baslama, mahsuplar: [{ tur, gun | baslangic+bitis, kaynak }] } | null,
//     muddetname: { acik, cikis, ks, bitis } (müddetnamede yazan tarihler),
//     uyarilar: [string],
//   }
// Her okunan değer kaynağıyla (belgedeki satır) birlikte döner; arayüz bunu
// gösterir ve kullanıcı onaylamadan hesaba aktarmaz.

import { aramaKopyasi, normallestir } from './metin.js';
import { ICTIMA_IMZASI, ictimaOku } from './ictima.js';
import { ILAM_IMZASI, gerekceliKararOku, muddetnameOku } from './muddetname.js';

export const BELGE_TURLERI = {
  ictima_karari: 'Cezaların toplanması (içtima) kararı',
  muddetname: 'Müddetname',
  gerekceli_karar: 'Gerekçeli karar (ilam)',
  bilinmiyor: 'Tanınmayan belge',
};

export function belgeTuru(ara) {
  if (ICTIMA_IMZASI.test(ara) && /\d{1,2}\s*\)\s/.test(ara)) return 'ictima_karari';
  // Müddetname: başlık ya da en az iki infaz tarihi etiketi (KS, hak ederek tahliye, açığa/DS'ye ayrılma).
  const etiketSayisi = [/KOSULLU SALIVERILME TARIHI/, /HAK EDEREK TAHLIYE|BIHAKKIN TAHLIYE/, /ACIK (?:CEZA INFAZ )?KURUM\w* AYRIL/, /DENETIMLI SERBESTLIK\w*(?: \w+)? TARIHI/].filter((re) => re.test(ara)).length;
  if (/MUDDETNAME/.test(ara) || etiketSayisi >= 2) return 'muddetname';
  if (ILAM_IMZASI.test(ara)) return 'gerekceli_karar';
  return 'bilinmiyor';
}

const bos = (tur) => ({ tur, tur_adi: BELGE_TURLERI[tur], kisi: null, karar: null, ilamlar: [], toplam: null, infaz: null, muddetname: {}, muddetname_kaynak: {}, uyarilar: [] });

export function belgeOku(hamMetin) {
  const ozgun = normallestir(hamMetin);
  const ara = aramaKopyasi(ozgun);
  if (ozgun.length < 20) return { ...bos('bilinmiyor'), uyarilar: ['Metin çok kısa.'] };
  const tur = belgeTuru(ara);
  const sonuc = bos(tur);
  if (tur === 'ictima_karari') {
    const r = ictimaOku(ozgun, ara);
    Object.assign(sonuc, { kisi: r.kisi, karar: r.karar, ilamlar: r.ilamlar, toplam: r.toplam, uyarilar: r.uyarilar });
    if (!r.ilamlar.length) sonuc.uyarilar.push('İçtima kararında numaralı ilam satırı ("1) …") bulunamadı.');
  } else if (tur === 'muddetname') {
    const r = muddetnameOku(ozgun, ara);
    Object.assign(sonuc, { kisi: r.kisi, ilamlar: [{ sira: 1, ...r.ilam }], infaz: r.infaz, muddetname: r.muddetname, muddetname_kaynak: r.muddetname_kaynak });
    if (!Object.keys(r.muddetname).length) sonuc.uyarilar.push('Müddetnamedeki tarih alanları (koşullu salıverilme, hak ederek tahliye …) okunamadı.');
  } else if (tur === 'gerekceli_karar') {
    const r = gerekceliKararOku(ozgun, ara);
    Object.assign(sonuc, { kisi: r.kisi, ilamlar: [{ sira: 1, ...r.ilam }], uyarilar: r.uyarilar });
  } else {
    sonuc.uyarilar.push('Belge türü tanınamadı. İçtima kararı, müddetname veya gerekçeli karar metni yapıştırın.');
  }
  return sonuc;
}
