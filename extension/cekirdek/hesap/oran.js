// Koşullu salıverilme oranı ve müebbet süreleri.
//
// Süreli hapiste oran adayları karar düğümlerinden gelir (D010-D014, D017; tekerrürde
// D015/D016). karar_cozumleme_politikasi:
//  - kanuni yasak (D018) önceliklidir,
//  - uygulanabilir özel oran adaylarından en ağırı seçilir ("daha ağır özel oran saklı"),
//  - genel 1/2 oranına ancak hiçbir özel aday uygulanabilir değilse dönülür,
//  - ilk tekerrürde 108/2 miktar sınırı oran adayından sonra ayrıca uygulanır.

import { Kesir } from '../zaman/rasyonel.js';
import { veya, degerlendir } from '../dil/kosul.js';

export function ksOraniBelirle(kt, motor, baglam, derece) {
  const adaylar = motor.grup('KS_oran_adayi', baglam);
  const uygun = adaylar.filter((a) => a.cozulen === true);
  const genel = { oran: kt.oran('R020'), kaynak: 'R020', dugum_id: null, neden: 'Genel oran: süreli hapiste iyi hâl şartıyla 1/2 (5275 m.107/2).' };
  let temel = genel;
  for (const a of uygun) {
    const o = Kesir.from(a.sonuc_adayi.oran);
    if (o.karsilastir(temel.oran) >= 0) temel = { oran: o, kaynak: a.dayanak_kurallar[0], dugum_id: a.dugum_id, neden: `${a.ad} (${a.dugum_id}): ${o}.`, ihtiyatli: a.ihtiyatli };
  }
  const sonuc = { temel, adaylar, oran: temel.oran, tekerrur: null };

  if (derece === 'birinci' || derece === 'ikinci') {
    const id = derece === 'birinci' ? 'D015' : 'D016';
    const t = motor.karar(id, baglam);
    if (t.cozulen === true) {
      const o = Kesir.from(t.sonuc_adayi.oran);
      sonuc.oran = Kesir.max(temel.oran, o);
      sonuc.tekerrur = { dugum: t, oran: o, ust_sinir_108_2: derece === 'birinci' };
    } else {
      sonuc.tekerrur = { dugum: t, oran: null, uygulanmadi: true };
    }
  }
  return sonuc;
}

// Müebbet koşullu salıverilme süreleri (5275 m.107/2, 107/4, 108/1, 108/3, 108/8-9; 3713 m.17).
export function muebbetSuresi(kt, baglam, derece, ilam) {
  const r30 = kt.p('R030');
  const agir = baglam.ilam.ceza_turu === 'agirlastirilmis_muebbet';
  const alan = agir ? 'agirlastirilmis_muebbet_yil' : 'muebbet_yil';
  const cocuk = baglam.kisi.suc_yasi !== null && baglam.kisi.suc_yasi < 18;
  const kat = [{ ad: 'Genel (5275 m.107/2)', yil: r30.genel[alan], kural: 'R030' }];
  if (!cocuk && veya([baglam.ilam.orgut_kurma_yonetme, baglam.ilam.orgut_faaliyeti]) === true) {
    kat.push({ ad: 'Örgüt suçu (5275 m.107/4)', yil: r30.orgut_107_4[alan], kural: 'R030' });
  }
  if (baglam.ilam.teror === true) {
    kat.push({ ad: 'Terör suçu (3713 m.17 → 5275 m.107/4, 108)', yil: r30.orgut_107_4[alan], kural: 'R116' });
  }
  if (derece === 'birinci' || derece === 'ikinci') {
    kat.push({ ad: derece === 'birinci' ? 'Tekerrür (5275 m.108/1)' : 'İkinci tekerrür (5275 m.108/3 → 108/1 süreleri)', yil: r30.tekerrur_108_1[alan], kural: derece === 'birinci' ? 'R030' : 'R028' });
  }
  if (ilam.cocuga_karsi_suc === true) kat.push({ ad: 'Çocuğa karşı suç (5275 m.108/8 → 108/1 süreleri)', yil: r30.tekerrur_108_1[alan], kural: 'R030' });
  // 108/9 (6545 ile 28/06/2014'te eklendi) müebbette 108/1 sürelerine atıf yapar; çocuklara uygulanmaz (108/10).
  const sc02 = degerlendir({ op: 'secici', secici_id: 'SC02' }, baglam, { seciciler: kt.seciciler });
  if (!cocuk && sc02 !== false && baglam.ilam.suc_tarihi >= kt.esik('T02')) {
    kat.push({ ad: `5275 m.108/9 kapsamı (108/1 süreleri)${sc02 === null ? ' — fıkra belirsiz, ihtiyaten' : ''}`, yil: r30.tekerrur_108_1[alan], kural: 'R030', ihtiyatli: sc02 === null });
  }
  return kat.reduce((a, b) => (b.yil > a.yil ? b : a));
}
