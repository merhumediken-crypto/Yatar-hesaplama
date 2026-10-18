// Müddetname (infaz süresi hesap belgesi) ve gerekçeli karar (ilam) okuyucuları.
//
// Müddetnamelerin biçimi infaz bürosuna ve UYAP sürümüne göre değişir (etiket: değer
// satırları veya tablo). Bu yüzden okuyucu biçime değil etiketlere dayanır: her alan
// için eş anlamlı etiket listesi aranır ve etiketten sonraki ilk tarih/değer alınır.
// Okunamayan alan boş kalır ve arayüzde sorulur; tahminle doldurulmaz.

import { cezalar, etiketliDeger, etiketliTarih, kes, satiri, tarihler } from './metin.js';
import { ilamKalemiOku } from './ilam-kalemi.js';
import { kisiOku } from './ictima.js';


export const ILAM_IMZASI = /CEZALANDIRILMASINA|HUKUM\s*:|SUC TARIHI|GEREKCELI KARAR/;

// Müddetname tarih alanları → arayüzdeki karşılaştırma kalemleri (ozet.js MUDDETNAME_KALEMLERI).
const TARIH_ALANLARI = {
  acik: 'ACIK (?:CEZA INFAZ )?KURUM(?:UNA|A) AYRIL\\w*(?: TARIHI)?|ACIGA AYRILMA(?: TARIHI)?',
  cikis: 'DENETIMLI SERBESTLIK\\w*(?: TEDBIRI)?(?: (?:ILE|ALTINDA))?(?: (?:YARARLANMA|AYRILMA|BASLAMA|TAHLIYE|INFAZ))?(?: TARIHI)?|D\\.?\\s?S\\.? TARIHI',
  ks: 'KOSULLU SALIVERILME(?: TARIHI)?|SARTLA TAHLIYE(?: TARIHI)?',
  bitis: 'HAK EDEREK TAHLIYE(?: TARIHI)?|BIHAKKIN TAHLIYE(?: TARIHI)?|CEZA BITIS(?: TARIHI)?',
};
const INFAZA_BASLAMA = 'INFAZA BASLAMA(?: TARIHI)?|INFAZA BASLADIGI TARIH|YAKALAMA TARIHI|YAKALANMA TARIHI|TESLIM TARIHI|CEZAEVINE GIRIS(?: TARIHI)?|KURUMA GIRIS(?: TARIHI)?';

// Gözaltı / tutukluluk / adli kontrol aralıkları: "Tutuklama 01/02/2017 - 15/06/2017",
// "01.02.2017 ile 15.06.2017 tarihleri arası tutuklu", "Gözaltı: 2 gün".
const MAHSUP_TURU = [
  ['gozalti', /GOZALTI/],
  ['konutu_terk_etmeme', /KONUT(?:U|UNU)? TERK|EV HAPSI/],
  ['denetimli_serbestlik', /DENETIMLI SERBESTLIK(?:TE)? GECEN|DS(?:'DE)? GECEN/],
  ['tutukluluk', /TUTUKL/],
];

function mahsuplar(ozgun, ara) {
  const sonuc = [];
  const satirlar = ara.split('\n');
  let konum = 0;
  for (const [n, satir] of satirlar.entries()) {
    const tur = MAHSUP_TURU.find(([, re]) => re.test(satir))?.[0];
    if (tur && !/KOSULLU SALIVERILME|HAK EDEREK|TAHLIYE TARIHI$/.test(satir)) {
      // Bir sonraki satır da aralığın devamı olabilir (tablo hücresi).
      const pencere = satir + ' ' + (satirlar[n + 1] || '');
      const t = tarihler(pencere);
      const gun = /(\d{1,5})\s*GUN/.exec(satir);
      const oz = satiri(ozgun, konum);
      if (t.length >= 2 && t[0].son <= satir.length + 1) sonuc.push({ tur, baslangic: t[0].iso, bitis: t[1].iso, kaynak: oz });
      else if (gun && !t.length) sonuc.push({ tur, gun: Number(gun[1]), kaynak: oz });
    }
    konum += satir.length + 1;
  }
  // Aynı aralık iki kez yazılmışsa bir kez alınır.
  const gorulen = new Set();
  return sonuc.filter((m) => {
    const k = `${m.tur}|${m.baslangic || ''}|${m.bitis || ''}|${m.gun || ''}`;
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return m.gun ? m.gun > 0 : m.bitis >= m.baslangic;
  });
}

// TCK özel hükümleri m.76'da başlar; 1-75 genel hükümlerdir (62 takdiri indirim, 53 hak yoksunluğu …).
const OZEL_HUKUM_BASLANGICI = 76;

// Suç adı ve TCK maddesi: "SUÇ : Hırsızlık", "5237 sayılı TCK'nın 142/1-b", "TCK 142/1-b md."
// Dönüş maddeler: yalnız özel hüküm maddeleri (suç tanımı), metindeki sırayla.
export function sucBilgisi(ozgun, ara) {
  const ad = etiketliDeger(ara, ozgun, 'SUC(?:U|UN ADI| ADI)?');
  const maddeler = [];
  const re = /(?:TCK|TURK CEZA KANUNU)(?:'?\s*(?:NUN|NIN|UN|IN))?\s*(?:MADDE\s*)?(\d{1,3}(?:\s*\/\s*\d{1,2})?(?:\s*-\s*[A-Z])?)/g;
  for (const m of ara.matchAll(re)) {
    const [madde, fikra = null, bent = null] = [/^\d{1,3}/.exec(m[1])[0], /\/\s*(\d{1,2})/.exec(m[1])?.[1], /-\s*([A-Z])$/.exec(m[1])?.[1]];
    const kayit = { kanun: 5237, madde, fikra: fikra || null, bent: bent ? ozgun.charAt(m.index + m[0].length - 1).toLocaleLowerCase('tr') : null, kaynak: satiri(ozgun, m.index) };
    if (Number(madde) < OZEL_HUKUM_BASLANGICI) continue;
    if (!maddeler.some((x) => x.madde === kayit.madde && x.fikra === kayit.fikra && x.bent === kayit.bent)) maddeler.push(kayit);
  }
  return { ad: ad ? ad.deger.replace(/\s*\(.*?\)\s*/g, ' ').trim() : null, ad_kaynak: ad?.kaynak || null, maddeler };
}

// Gerekçeli kararda sonuç ceza: "… SONUÇ OLARAK 2 YIL 6 AY HAPİS CEZASI İLE CEZALANDIRILMASINA"
function sonucCeza(ozgun, ara) {
  const sonuclar = [...ara.matchAll(/CEZALANDIRILMASINA/g)];
  for (const s of sonuclar.reverse()) {
    const once = ara.slice(Math.max(0, s.index - 140), s.index);
    const c = cezalar(once).at(-1);
    if (c) return { ceza: c.ceza, kaynak: satiri(ozgun, s.index) };
  }
  return null;
}

export function muddetnameOku(ozgun, ara) {
  const tarihlerBul = Object.fromEntries(Object.entries(TARIH_ALANLARI).map(([k, e]) => [k, etiketliTarih(ara, ozgun, e, { aralik: 30 })]));
  const ilam = ilamKalemiOku(ozgun, ara);
  const suc = sucBilgisi(ozgun, ara);
  const sucTarihi = etiketliTarih(ara, ozgun, 'SUC TARIHI', { aralik: 20 });
  const kesinlesme = etiketliTarih(ara, ozgun, 'KESINLES\\w*(?: TARIHI)?', { aralik: 20 });
  const baslama = etiketliTarih(ara, ozgun, INFAZA_BASLAMA, { aralik: 30 });
  const kararTarihi = etiketliTarih(ara, ozgun, 'KARAR TARIHI|HUKUM TARIHI', { aralik: 10 });
  const cezaSatiri = /(?:CEZASI|CEZA MIKTARI|HUKMOLUNAN CEZA|TOPLAM CEZA)\s*:?\s*([^\n]{0,60})/.exec(ara);
  const ceza = cezaSatiri ? cezalar(cezaSatiri[1])[0]?.ceza || null : null;
  return {
    kisi: kisiOku(ozgun, ara),
    ilam: { ...ilam, karar_tarihi: kararTarihi?.deger || null, ceza: ceza || ilam.ceza, suc_tarihi: sucTarihi?.deger || null, suc_tarihi_kaynak: sucTarihi?.kaynak || null, kesinlesme_tarihi: kesinlesme?.deger || null, suc_adi: suc.ad, maddeler: suc.maddeler },
    infaz: { baslama: baslama?.deger || null, baslama_kaynak: baslama?.kaynak || null, mahsuplar: mahsuplar(ozgun, ara) },
    muddetname: Object.fromEntries(Object.entries(tarihlerBul).filter(([, v]) => v).map(([k, v]) => [k, v.deger])),
    muddetname_kaynak: Object.fromEntries(Object.entries(tarihlerBul).filter(([, v]) => v).map(([k, v]) => [k, v.kaynak])),
    kaynak: kes(ozgun, 0, 160),
  };
}

export function gerekceliKararOku(ozgun, ara) {
  const ilam = ilamKalemiOku(ozgun, ara);
  const suc = sucBilgisi(ozgun, ara);
  const sucTarihi = etiketliTarih(ara, ozgun, 'SUC TARIHI|SUC TARIH(?:LERI)?', { aralik: 20 });
  const kararTarihi = etiketliTarih(ara, ozgun, 'KARAR TARIHI|HUKUM TARIHI', { aralik: 10 });
  const sonuc = sonucCeza(ozgun, ara);
  const uyarilar = [];
  if (!sonuc) uyarilar.push('Sonuç ceza "cezalandırılmasına" ifadesinden okunamadı; ceza miktarını kontrol edin.');
  if (suc.maddeler.length > 1) uyarilar.push(`Kararda birden çok suç maddesi geçiyor (${suc.maddeler.map((m) => `TCK ${m.madde}${m.fikra ? '/' + m.fikra : ''}${m.bent ? '-' + m.bent : ''}`).join(', ')}); uygulanan maddeyi seçin.`);
  return {
    kisi: kisiOku(ozgun, ara),
    ilam: { ...ilam, karar_tarihi: kararTarihi?.deger || ilam.karar_tarihi, ceza: sonuc?.ceza || null, ceza_kaynak: sonuc?.kaynak || null, suc_tarihi: sucTarihi?.deger || null, suc_tarihi_kaynak: sucTarihi?.kaynak || null, suc_adi: suc.ad, maddeler: suc.maddeler },
    uyarilar,
    kaynak: kes(ozgun, 0, 160),
  };
}
