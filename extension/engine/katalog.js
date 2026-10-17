// Suça özgü seçiciler (kural_tabani.suclara_ozgu_seciciler) için üç değerli eşleştirme.
// Sonuç: true (kapsamda), false (kapsam dışı), null (bilinmiyor; uygunluk sayılmaz).
// Eşleştirme kuralı: "Madde numarası tam eşleştirilir; fıkra/bent boşsa maddenin tamamı,
// doluysa yalnız o alt kapsam. Bilinmeyen fıkra uygunluk sayılmaz."

export function ve(...xs) {
  if (xs.some((x) => x === false)) return false;
  if (xs.some((x) => x === null || x === undefined)) return null;
  return true;
}

export function veya(...xs) {
  if (xs.some((x) => x === true)) return true;
  if (xs.some((x) => x === null || x === undefined)) return null;
  return false;
}

export function normalMadde(m) {
  if (m === null || m === undefined) return null;
  const s = String(m).trim().replace(/^0+(?=\d)/, '').toUpperCase();
  return s === '' ? null : s;
}

function normalAlt(x) {
  if (x === null || x === undefined) return null;
  const s = String(x).trim().toLowerCase();
  return s === '' ? null : s;
}

function maddeNo(ilam) {
  const m = normalMadde(ilam?.kanun_madde_fikra_bent?.madde);
  const n = m === null ? NaN : parseInt(m, 10);
  return Number.isFinite(n) ? n : null;
}

function kanunu(ilam) {
  const k = ilam?.kanun_madde_fikra_bent?.kanun;
  return k === null || k === undefined || k === '' ? null : Number(k);
}

// TCK 2. Kitap 4. Kısım bölüm aralıkları (Millete ve Devlete Karşı Suçlar)
const TCK_K2_KISIM4_BOLUMLER = {
  1: [247, 266],
  2: [267, 298],
  3: [299, 301],
  4: [302, 308],
  5: [309, 316],
  6: [317, 325],
  7: [326, 339],
  8: [340, 342],
};

// TCK 2. Kitap 2. Kısım 6. Bölüm: Cinsel dokunulmazlığa karşı suçlar (m.102-105)
const CINSEL_DOKUNULMAZLIK = [102, 105];

function tckAraligi(ilam, [bas, bit]) {
  const kanun = kanunu(ilam);
  const n = maddeNo(ilam);
  if (kanun === null || n === null) return null;
  if (kanun !== 5237) return false;
  return n >= bas && n <= bit;
}

function maddeSecici(e, ilam) {
  const kanun = kanunu(ilam);
  const madde = normalMadde(ilam?.kanun_madde_fikra_bent?.madde);
  if (kanun === null || madde === null) return null;
  if (kanun !== Number(e.kanun)) return false;
  if (e.madde === undefined) {
    // Örn. 2937 "kanunun ceza hükümleri": otomatik eşleştirme yapılmaz.
    return e.otomatik_eslestirme === false ? null : true;
  }
  if (madde !== normalMadde(e.madde)) return false;
  const fikra = normalAlt(ilam.kanun_madde_fikra_bent.fikra);
  const bent = normalAlt(ilam.kanun_madde_fikra_bent.bent);
  if (e.fikra !== undefined) {
    if (fikra === null) return null;
    if (fikra !== normalAlt(e.fikra)) return false;
  }
  if (e.bent !== undefined) {
    if (bent === null) return null;
    if (bent !== normalAlt(e.bent)) return false;
  }
  if (Array.isArray(e.fikra_haric)) {
    if (fikra === null) return null;
    if (e.fikra_haric.map(normalAlt).includes(fikra)) return false;
  }
  return true;
}

export function seciciEtiketi(e) {
  if (e.madde !== undefined) {
    const ad = e.kanun === 5237 ? 'TCK' : `${e.kanun} s. Kanun`;
    let s = `${ad} m.${e.madde}`;
    if (e.fikra) s += `/${e.fikra}`;
    if (e.bent) s += `-${e.bent}`;
    if (e.fikra_haric) s += ` (${e.fikra_haric.join(', ')}. fıkra hariç)`;
    return s;
  }
  if (e.kanun !== undefined) return `${e.kanun} s. Kanun: ${e.kapsam || 'tamamı'}`;
  if (e.teror_kanunu_kapsami) return 'Terörle Mücadele Kanunu kapsamı';
  if (e.orgut_faaliyeti) return 'Örgüt faaliyeti çerçevesinde işlenen suç';
  if (e.orgut_kurmak_veya_yonetmek) return 'Örgüt kurmak veya yönetmek';
  if (e.orgut_kurmak_yonetmek_uyelik) return 'Örgüt kurmak, yönetmek veya üyelik';
  if (e.cinsel_dokunulmazliga_karsi_suc) return 'Cinsel dokunulmazlığa karşı suç (TCK 102-105)';
  if (e.tck_kitap) {
    const [b1] = TCK_K2_KISIM4_BOLUMLER[e.bolumler[0]];
    const [, b2] = TCK_K2_KISIM4_BOLUMLER[e.bolumler[e.bolumler.length - 1]];
    return `TCK ${e.tck_kitap}. Kitap ${e.kisim}. Kısım ${e.bolumler.join(', ')}. bölümler (m.${b1}-${b2})`;
  }
  if (e.suc_grubu === 'kasten_yaralama_ve_neticesi_sebebiyle_agirlasmis_yaralama')
    return 'Kasten yaralama / neticesi sebebiyle ağırlaşmış yaralama (üstsoy, altsoy, eş, kardeş veya savunmasız mağdur)';
  if (e.suc_grubu === 'oldurme') return 'Deprem/yapı yıkılması bağlantılı öldürme';
  if (e.hukumdeki_tekerrur) return 'Hükümde ikinci tekerrür';
  if (e.kosullu_saliverme_geri_alinmis_aynen_infaz) return 'Koşullu salıverilmesi geri alınıp aynen infaz';
  return JSON.stringify(e);
}

export function seciciEslesir(e, ilam, ctx = {}) {
  if (e.madde !== undefined || e.kanun !== undefined) return maddeSecici(e, ilam);
  if (e.teror_kanunu_kapsami) return ilam.teror_kanunu_kapsami ?? null;
  if (e.orgut_faaliyeti) return ilam.orgut_faaliyeti ?? null;
  if (e.orgut_kurmak_veya_yonetmek) return ilam.orgut_kurma_yonetme ?? null;
  if (e.orgut_kurmak_yonetmek_uyelik) return veya(ilam.orgut_kurma_yonetme ?? null, ilam.orgut_uyelik ?? null);
  if (e.cinsel_dokunulmazliga_karsi_suc) return tckAraligi(ilam, CINSEL_DOKUNULMAZLIK);
  if (e.tck_kitap === 2 && e.kisim === 4) {
    const sonuclar = e.bolumler.map((b) => tckAraligi(ilam, TCK_K2_KISIM4_BOLUMLER[b]));
    return veya(...sonuclar);
  }
  if (e.suc_grubu === 'kasten_yaralama_ve_neticesi_sebebiyle_agirlasmis_yaralama') {
    return ve(tckAraligi(ilam, [86, 87]), ilam.magdur_yakin_veya_savunmasiz ?? null);
  }
  if (e.suc_grubu === 'oldurme') {
    return ve(tckAraligi(ilam, [81, 85]), ilam.deprem_yapi_olumu_baglantisi ?? null);
  }
  if (e.hukumdeki_tekerrur) {
    if (ctx.tekerrur === undefined || ctx.tekerrur === null) return null;
    return ctx.tekerrur === e.hukumdeki_tekerrur;
  }
  if (e.kosullu_saliverme_geri_alinmis_aynen_infaz) return ilam.ks_geri_alindi ?? null;
  return null;
}

// Bir katalogdaki bütün girişleri sınar. Herhangi biri true ise true; değilse
// bilinmeyen varsa null; hepsi false ise false.
export function katalogEslesir(liste, ilam, ctx = {}) {
  const eslesenler = [];
  const belirsizler = [];
  for (const e of liste) {
    const r = seciciEslesir(e, ilam, ctx);
    if (r === true) eslesenler.push(seciciEtiketi(e));
    else if (r === null) belirsizler.push(seciciEtiketi(e));
  }
  const sonuc = eslesenler.length ? true : belirsizler.length ? null : false;
  return { sonuc, eslesenler, belirsizler };
}

export function maddeListesindeMi(ilam, maddeler) {
  const kanun = kanunu(ilam);
  const n = maddeNo(ilam);
  if (kanun === null || n === null) return null;
  return kanun === 5237 && maddeler.map(Number).includes(n);
}
