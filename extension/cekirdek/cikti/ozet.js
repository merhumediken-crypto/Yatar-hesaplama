// Panoya kopyalama ve dosyaya ekleme için düz metin özet.

import { trTarih, cezaMetni } from '../zaman/takvim.js';
import { adayMetni } from '../tekerrur/tespit.js';

export const DURUM_ETIKETI = {
  varsayimli_senaryo: 'Varsayımlı senaryo',
  hukuki_inceleme_gerekli: 'Hukuki inceleme gerekli',
  eksik_veri: 'Eksik veri',
  uygulanamaz: 'Uygulanamaz',
};

export function nitelik(S) {
  return S.en_cok ? 'en çok' : '';
}

export function ozetMetni(c) {
  if (!c) return '';
  const i = c.vaka?.suclar_ve_ilamlar?.[0];
  const mfb = i?.kanun_madde_fikra_bent;
  const madde = mfb?.madde ? ` · ${mfb.kanun === 5237 ? 'TCK' : `${mfb.kanun} s. K.`} m.${mfb.madde}${mfb.fikra ? '/' + mfb.fikra : ''}${mfb.bent ? '-' + mfb.bent : ''}` : '';
  const yok = c.senaryolar.yok;
  const s = [
    'İNFAZ ÖN DEĞERLENDİRMESİ (kesin tahliye hesabı değildir)',
    `Suç tarihi: ${trTarih(i?.suc_tarihi)} · Ceza: ${i?.hukumdeki_sonuc_ceza ? cezaMetni(i.hukumdeki_sonuc_ceza) : '—'}${madde}`,
    `İnfaza başlama: ${trTarih(yok?.takvim?.infaza_baslama)} · Mahsup: ${yok?.takvim?.mahsup_gun ?? 0} gün · Hesap tarihi: ${trTarih(c.hesap_tarihi)}`,
    `Tekerrür: hükümde ${adayMetni(c.tekerrur?.hukumde_uygulanan) || '—'}; belgelerden ${adayMetni(c.tekerrur?.belgelerden_aday_tespit)}`,
    `Genel durum: ${DURUM_ETIKETI[c.durum] || c.durum}`,
    '',
  ];
  for (const anahtar of ['yok', 'birinci', 'ikinci']) {
    const S = c.senaryolar[anahtar];
    if (!S) continue;
    if (!S.uygulanabilir || S.kurumda_kalis_gun === null) {
      s.push(`${S.baslik}: — (${S.neden || DURUM_ETIKETI[S.durum]})`);
      continue;
    }
    const n = nitelik(S);
    const yol = S.ds_yollari?.find((y) => y.id === S.secilen_ds_yolu);
    s.push(
      `${S.baslik}${c.secili_senaryo === anahtar ? ' [seçili]' : ''}: ${n ? n + ' ' : ''}${S.kurumda_kalis_gun} gün kurumda` +
        `${S.oran ? ` · KS oranı ${S.oran}` : ''}${yol ? ` · ${yol.ad} ${trTarih(S.takvim.DSye_hak_kazanma)}` : ' · DS yok'} · KS ${trTarih(S.takvim.kosullu_saliverilme)} · ${DURUM_ETIKETI[S.durum]}`,
    );
    if (S.acik_kurum?.yol === 'kapalidan') s.push(`   Açığa ayrılma: ${trTarih(S.acik_kurum.tarih)}`);
    for (const y of S.alternatif_yollar) s.push(`   Alternatif ${y.ad}: ${y.kurumda_kalis_gun} gün (hukuki inceleme)`);
  }
  s.push('');
  if (c.gerekli_kararlar?.length) s.push('Gerekli kararlar:', ...c.gerekli_kararlar.map((k) => `  - ${k.metin}`));
  if (c.engelleyici_konu_idleri.length) s.push(`Açık konular: ${c.engelleyici_konu_idleri.join(', ')}`);
  if (c.hata_kodlari.length) s.push(`Uyarı kodları: ${c.hata_kodlari.join(', ')}`);
  s.push(`Dayanak kurallar: ${c.secilen_kural_idleri.join(', ')}`);
  s.push(`Kural tabanı: ${c.paket_surumu} (SHA-256 ${String(c.veri_paketi_sha256).slice(0, 12)}…) · Hesap profili: ${c.hesap_profili_id}`);
  s.push(c.sonuc_etiketi);
  return s.join('\n');
}
