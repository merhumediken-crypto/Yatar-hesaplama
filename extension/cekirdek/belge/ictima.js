// İnfaz hâkimliğinin cezaların toplanması (içtima) kararı — 5275 m.99, 101/2.
//
// Beklenen yapı (UYAP "Evrak Görüntüleme" çıktısı):
//   T.C. / <İL> / <n>. İNFAZ HÂKİMLİĞİ / DOSYA NO : … / KARAR NO : …
//   SANIK|HÜKÜMLÜ : AD SOYAD, … gg/aa/yyyy … doğumlu …
//   KARAR TARİHİ : gg/aa/yyyy
//   GEREĞİ DÜŞÜNÜLDÜ : Hükümlü hakkında;
//   1) <Mahkeme>'nin <tarih> gün ve <esas> esas <karar> karar sayılı ilamı ile verilen <ceza> HAPİS cezası (<infaz no>),
//   2) …
//   … <toplam> HAPİS CEZASI OLARAK İÇTİMASINA,

import { baslikHarfi, cezalar, etiketliDeger, etiketliTarih, kes, satiri, tarihler } from './metin.js';
import { ilamKalemiOku } from './ilam-kalemi.js';

export const ICTIMA_IMZASI = /ICTIMA|TOPLANMASINA KARAR|101\s*\/\s*2\s*MADDESI/;

// Karar başlığı: mahkeme (T.C.'den DOSYA NO'ya kadar olan satırlar), dosya/karar no, tarihler.
function baslik(ozgun, ara) {
  const tc = ara.search(/T\s*\.\s*C\s*\./);
  const dosya = ara.search(/DOSYA NO/);
  let mahkeme = null;
  if (dosya > 0) {
    // Özgün ve arama kopyası aynı uzunlukta: satırlar paralel bölünür.
    const bolge = (x) => x.slice(tc >= 0 ? tc : 0, dosya).split('\n').map((y) => y.trim());
    const oz = bolge(ozgun);
    const ar = bolge(ara);
    const i = ar.findIndex((y) => /HAKIMLIGI|MAHKEMESI/.test(y));
    if (i >= 0) {
      // Mahkeme adının il kısmı çoğunlukla bir önceki satırdadır ("DİYARBAKIR" / "1. İNFAZ HÂKİMLİĞİ").
      const il = i > 0 && ar[i - 1] && !/^T\s*\.\s*C/.test(ar[i - 1]) ? oz[i - 1] : '';
      mahkeme = baslikHarfi([il, oz[i]].filter(Boolean).join(' ')).replace(/\s*\.\s*/, '. ');
    }
  }
  const no = (etiket) => {
    const m = new RegExp(`${etiket}\\s*:\\s*(\\d{4}\\s*/\\s*\\d+)`).exec(ara);
    return m ? m[1].replace(/\s+/g, '') : null;
  };
  return {
    mahkeme,
    dosya_no: no('DOSYA NO'),
    karar_no: no('KARAR NO'),
    karar_tarihi: etiketliTarih(ara, ozgun, 'KARAR TARIHI', { aralik: 10 })?.deger || null,
    basvuru_tarihi: etiketliTarih(ara, ozgun, 'BASVURU TARIHI', { aralik: 10 })?.deger || null,
  };
}

// Hükümlü satırı: ad soyad ve doğum tarihi (TC kimlik no okunmaz).
export function kisiOku(ozgun, ara) {
  const d = etiketliDeger(ara, ozgun, 'SANIK|HUKUMLU|HUKUMLUNUN ADI SOYADI|ADI SOYADI|HUKUMLUNUN');
  if (!d) return null;
  const ad = d.deger.split(',')[0].trim();
  const dogumlu = /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+[^,\n]{0,40}?DOGUMLU/.exec(ara);
  const dogum = dogumlu ? tarihler(dogumlu[1])[0]?.iso : etiketliTarih(ara, ozgun, 'DOGUM TARIHI', { aralik: 20 })?.deger || null;
  return { ad: /\d/.test(ad) ? null : baslikHarfi(ad), dogum_tarihi: dogum || null, kaynak: d.kaynak };
}

// Numaralı ilam satırları: "1) …", "2) …" (yalnız ")" işareti; "12. Asliye" ile karışmaz).
function kalemler(ozgun, ara) {
  const bas = Math.max(0, ara.search(/GEREGI DUSUNULDU|HUKUMLU HAKKINDA/));
  const sonAday = ara.slice(bas).search(/ILAMLARININ|ICTIMASINA|TOPLANMASINA/);
  const son = sonAday >= 0 ? bas + sonAday : ara.length;
  const isaretler = [...ara.slice(bas, son).matchAll(/(?:^|[\s,;:])(\d{1,2})\s*\)\s+/g)].map((m) => ({ no: Number(m[1]), bas: bas + m.index + m[0].length, isaret: bas + m.index }));
  // Sıralı numaraları al (1, 2, 3 …); metin içindeki rastgele "3) " eşleşmeleri elenir.
  const sirali = [];
  for (const m of isaretler) if (m.no === sirali.length + 1) sirali.push(m);
  return sirali.map((m, i) => {
    const bitis = i + 1 < sirali.length ? sirali[i + 1].isaret : son;
    return ilamKalemiOku(ozgun.slice(m.bas, bitis), ara.slice(m.bas, bitis), { sira: m.no });
  });
}

function toplamOku(ozgun, ara) {
  const m = /HAPIS CEZASI OLARAK (?:ICTIMASINA|TOPLANMASINA)/.exec(ara);
  if (!m) return null;
  const once = cezalar(ara.slice(Math.max(0, m.index - 60), m.index));
  const c = once.at(-1);
  return c ? { ceza: c.ceza, kaynak: satiri(ozgun, m.index) } : null;
}

export function ictimaOku(ozgun, ara) {
  const ilamlar = kalemler(ozgun, ara);
  const toplam = toplamOku(ozgun, ara);
  const uyarilar = [];
  if (toplam && ilamlar.length) {
    const t = ilamlar.reduce((a, i) => ({ yil: a.yil + (i.ceza?.yil || 0), ay: a.ay + (i.ceza?.ay || 0), gun: a.gun + (i.ceza?.gun || 0) }), { yil: 0, ay: 0, gun: 0 });
    toplam.ilamlar_toplami = t;
    toplam.uyusuyor = t.yil === toplam.ceza.yil && t.ay === toplam.ceza.ay && t.gun === toplam.ceza.gun;
    if (!toplam.uyusuyor) uyarilar.push('Okunan ilam cezalarının toplamı karardaki toplamla uyuşmuyor; ilam satırlarını kontrol edin.');
  }
  ilamlar.forEach((i) => {
    if (!i.ceza && !['muebbet', 'agirlastirilmis_muebbet'].includes(i.ceza_turu)) uyarilar.push(`${i.sira}. ilamın cezası okunamadı.`);
    if (!i.karar_tarihi) uyarilar.push(`${i.sira}. ilamın hüküm tarihi okunamadı.`);
  });
  return { karar: baslik(ozgun, ara), kisi: kisiOku(ozgun, ara), ilamlar, toplam, uyarilar, kaynak: kes(ozgun, 0, 160) };
}
