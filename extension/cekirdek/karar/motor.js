// Karar düğümü motoru.
//
// Kural tabanındaki karar düğümleri (D001…D106) birbirinden bağımsız koşul +
// sonuç adayı kayıtlarıdır; "sıra numarası tek başına bir bütün infaz algoritması
// değildir" (karar_cozumleme_politikasi). Motor yalnız düğümleri değerlendirir ve
// gerekçesini döndürür. Düğümleri bir hesaba bağlamak hesap katmanının işidir.

import { izliDegerlendir } from '../dil/kosul.js';

// Varsayımlı senaryoda hâlâ belirsiz kalan bir düğüm, hükümlü aleyhine sonuç veren
// yönde çözülür ve sonuç "en çok" olarak işaretlenir. Kural tabanı belirsiz düğüm
// için sonuç üretmez (bilinmeyen_ustun_kural); bu tablo varsayımlı senaryonun
// hiçbir zaman kurumda kalışı olduğundan kısa göstermemesini sağlar.
//   true  → düğüm uygulanır sayılır (ör. daha ağır özel oran, daha dar açık kurum eşiği)
//   false → düğüm uygulanmaz sayılır (ör. erken DS yolu, doğrudan açık kurum)
//   null  → ihtiyat çözümü yapılmaz; belirsizlik sonuca taşınır
export const IHTIYAT_YONU = {
  ceza_yolu: null,
  KS_engeli: null,
  KS_oran_adayi: true,
  tekerrur_oran_adayi: true,
  DS_adayi: false,
  gecis_kapsami: false,
  asgari_kurum: true,
  acik_kurum: false,
  acik_asgari: null,
  acik_engeli: true,
  acik_ozel_esik: true,
  cek_karar_talebi: null,
  cek_gecis: null,
  tekerrur_onkosul: null,
  tekerrur_adayi: null,
};

export class KararMotoru {
  constructor(kt) {
    this.kt = kt;
  }

  degerlendir(dugumId, baglam) {
    const d = this.kt.dugum(dugumId);
    const r = izliDegerlendir(d.kosul, baglam, { seciciler: this.kt.seciciler });
    return {
      dugum_id: d.dugum_id,
      ad: d.ad,
      grup: d.grup,
      oncelik: d.oncelik,
      deger: r.deger,
      belirsiz_alanlar: r.belirsizAlanlar,
      veri_hatalari: r.veriHatalari,
      sonuc_adayi: d.sonuc_adayi,
      dayanak_kurallar: d.dayanak_kurallar,
      iz: r.iz,
    };
  }

  // İhtiyat yönüyle çözülmüş değer. Dönüş: { ...sonuc, cozulen, ihtiyatli }
  karar(dugumId, baglam) {
    const s = this.degerlendir(dugumId, baglam);
    if (s.deger !== null) return { ...s, cozulen: s.deger, ihtiyatli: false };
    const yon = IHTIYAT_YONU[s.grup];
    return { ...s, cozulen: yon ?? null, ihtiyatli: yon !== null && yon !== undefined };
  }

  grup(grupAdi, baglam) {
    return (this.kt.gruplar.get(grupAdi) || []).map((d) => this.karar(d.dugum_id, baglam));
  }

  // Tek önceki ilam kapsamı dışındaki bütün düğümler (rapor tablosu için).
  tumu(baglam, { haric = ['tekerrur_onkosul', 'tekerrur_adayi'] } = {}) {
    return this.kt.paket.karar_dugumleri.filter((d) => !haric.includes(d.grup)).map((d) => this.karar(d.dugum_id, baglam));
  }
}

// Gerekçe izinden okunur özet satırları (arayüz ve dışa aktarım için).
export function izMetni(iz, derinlik = 0, satirlar = []) {
  const girinti = '  '.repeat(derinlik);
  const d = iz.deger === true ? '✓' : iz.deger === false ? '✗' : '?';
  if (iz.op === 'and' || iz.op === 'or' || iz.op === 'not') {
    satirlar.push(`${girinti}${d} ${iz.op === 'and' ? 'HEPSİ' : iz.op === 'or' ? 'HERHANGİ BİRİ' : 'DEĞİL'}`);
    iz.alt.forEach((a) => izMetni(a, derinlik + 1, satirlar));
  } else if (iz.op === 'secici') {
    satirlar.push(`${girinti}${d} seçici ${iz.secici_id} (${iz.ad})`);
  } else if (iz.op === 'once_kesinlesme' || iz.op === 'alan_esit') {
    satirlar.push(`${girinti}${d} ${iz.sol} ${iz.op === 'once_kesinlesme' ? '<' : '='} ${iz.sag} [${JSON.stringify(iz.solDeger)} / ${JSON.stringify(iz.sagDeger)}]`);
  } else {
    satirlar.push(`${girinti}${d} ${iz.alan} ${iz.op} ${JSON.stringify(iz.beklenen)} [girdi: ${JSON.stringify(iz.gercek)}]`);
  }
  return satirlar;
}
