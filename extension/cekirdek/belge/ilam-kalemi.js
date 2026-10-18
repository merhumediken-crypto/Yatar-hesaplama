// Bir ilamı tanıtan metin parçasından alanların okunması. İçtima (toplama) kararındaki
// numaralı satırlar ve müddetname blokları aynı yapıyı kullanır:
//
//   "Diyarbakır 12. Asliye Ceza Mahkemesi'nin 12/07/2018 gün ve 2017/157 esas 2018/343
//    karar sayılı ilamı ile verilen 4 YIL 8 AY 7 GÜN HAPİS cezası (2020/2-4124)"

import { baslikHarfi, cezalar, kes, tarihler } from './metin.js';

// Arama kopyası (büyük, aksansız) üzerinde; il adı tek kelime, büyükşehirlerde ilçe/adliye eki olabilir.
const MAHKEME = /(?:(?:ISTANBUL|ANKARA|IZMIR)\s+)?[A-Z]+\s+\d{1,2}\s*\.\s*(?:ASLIYE CEZA|COCUK AGIR CEZA|AGIR CEZA|COCUK|SULH CEZA|ICRA CEZA|FIKRI VE SINAI HAKLAR CEZA)\s+(?:MAHKEMESI|HAKIMLIGI)/;
const DAIRE = /(?:YARGITAY|[A-Z]+\s+BOLGE ADLIYE MAHKEMESI)\s+\d{1,2}\s*\.\s*CEZA DAIRESI/;
// Satır içi yazım ("2017/157 esas 2018/343 karar"); numara ile kelime aynı satırda olmalı.
const ESAS = /(\d{4})[ \t]*\/[ \t]*(\d{1,6})[ \t]*(?:ESAS|E\b\.?)/;
const KARAR = /(\d{4})[ \t]*\/[ \t]*(\d{1,6})[ \t]*(?:KARAR|K\b\.?)/;
const ESAS_ETIKETLI = /ESAS(?:\s*NO)?\s*:?\s*(\d{4})\s*\/\s*(\d{1,6})/;
const KARAR_ETIKETLI = /KARAR(?:\s*NO)?\s*:?\s*(\d{4})\s*\/\s*(\d{1,6})/;
const INFAZ_NO = /\((\d{4}\s*\/\s*\d{1,3}\s*-\s*\d{1,7})\)/;

// Mahkeme adı (özgün yazımla, başlık harfli) ve kısa biçimi: "Diyarbakır 12. Asliye Ceza"
export function mahkemeAdi(ozgun, ara) {
  const m = MAHKEME.exec(ara) || DAIRE.exec(ara);
  if (!m) return null;
  const tam = baslikHarfi(ozgun.slice(m.index, m.index + m[0].length).replace(/\s+/g, ' ')).replace(/\s*\.\s*/, '. ');
  return { tam, kisa: tam.replace(/\s+(Mahkemesi|Hâkimliği|Hakimliği|Dairesi)$/u, '') };
}

// Ceza türü: adli paradan çevrilen, müebbet, ağırlaştırılmış müebbet, süreli hapis.
export function cezaTuru(ara) {
  if (/AGIRLASTIRILMIS\s+MUEBBET/.test(ara)) return 'agirlastirilmis_muebbet';
  if (/MUEBBET/.test(ara)) return 'muebbet';
  if (/ADLI\s+PARA/.test(ara) && /CEVRIL/.test(ara)) return 'adli_paradan_cevrilen_hapis';
  return 'sureli_hapis';
}

// Bir ilam parçası (özgün + arama kopyası, aynı uzunlukta) → ilam kaydı.
export function ilamKalemiOku(ozgun, ara, { sira = null } = {}) {
  const mahkeme = mahkemeAdi(ozgun, ara);
  // Etiketli belgede ("Esas No : …", "Karar No : …") etiket, satır içi yazımda sıra esastır.
  const etiketli = /ESAS\s*NO|KARAR\s*NO/.test(ara);
  const esas = etiketli ? ESAS_ETIKETLI.exec(ara) || ESAS.exec(ara) : ESAS.exec(ara) || ESAS_ETIKETLI.exec(ara);
  const karar = etiketli ? KARAR_ETIKETLI.exec(ara) || KARAR.exec(ara) : KARAR.exec(ara) || KARAR_ETIKETLI.exec(ara);
  const infaz = INFAZ_NO.exec(ara);
  const tur = cezaTuru(ara);
  // Hüküm tarihi: "… 12/07/2018 gün ve …" ya da mahkeme adından sonraki ilk tarih.
  const tumTarihler = tarihler(ozgun);
  const gun = /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(?:GUN|TARIH)/.exec(ara);
  const kararTarihi = gun ? tarihler(gun[1])[0]?.iso : tumTarihler[0]?.iso || null;
  // Ceza: "verilen … HAPİS" arasındaki miktar; yoksa "HAPİS" öncesindeki son miktar.
  const adaylar = cezalar(ara);
  const verilen = ara.search(/VERILEN|HUKMOLUNAN|CEZASI\s*:/);
  const hapis = ara.search(/HAPIS/);
  const ceza =
    adaylar.find((c) => (verilen < 0 || c.bas > verilen) && (hapis < 0 || c.bas < hapis)) ||
    (hapis >= 0 ? adaylar.filter((c) => c.bas < hapis).at(-1) : adaylar[0]) ||
    null;
  const esasNo = esas ? `${esas[1]}/${esas[2]}` : null;
  const kararNo = karar ? `${karar[1]}/${karar[2]}` : null;
  return {
    sira,
    mahkeme: mahkeme?.tam || null,
    mahkeme_kisa: mahkeme?.kisa || null,
    karar_tarihi: kararTarihi,
    esas_no: esasNo,
    karar_no: kararNo,
    infaz_no: infaz ? infaz[1].replace(/\s+/g, '') : null,
    ceza: ['muebbet', 'agirlastirilmis_muebbet'].includes(tur) ? null : ceza?.ceza || null,
    ceza_turu: tur,
    etiket: [mahkeme?.kisa, esasNo && `${esasNo} E.`].filter(Boolean).join(' ') || null,
    kaynak: kes(ozgun, 0, ozgun.length),
  };
}
