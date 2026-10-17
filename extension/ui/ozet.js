// Sonuç özeti: çekirdek çıktısından avukatın müvekkile söyleyeceği üç sayı
// (kapalı / açık / denetimli serbestlik), tarihli zaman çizelgesi ve paylaşım metni.
// Hukuki karar vermez; yalnız seçili senaryonun takvimini okur. DOM bilmez.

import { takvim as T } from '../cekirdek/index.js';
import { hesaplanabilir, kapsamDisi, KAPSAM_BASLANGICI } from './dosya.js';
import { gosterilenSenaryo, varsayimSatirlari } from './sorular.js';
import { maddeEtiketi, sucAdi } from './tck-maddeleri.js';

const tr = (s) => (s ? T.trTarih(s) : '—');
const fark = (a, b) => Math.max(0, T.gunFarki(a, b));
const gec = (a, b) => (T.once(a, b) ? b : a);

const BASLIK = { yok: 'Tekerrürsüz', birinci: '1. tekerrür', ikinci: '2. tekerrür' };

// Uzun süreler için yaklaşık yıl/ay karşılığı: 400 → "≈ 1 yıl 1 ay 5 gün".
export function sureYaklasik(gun) {
  return gun && gun >= 60 ? T.gunMetni(gun) : '';
}

// Kuralın dayandığı ilk madde (sonuç satırından mevzuata bağlantı için).
function maddeBul(kt, kural) {
  if (!kt?.kurallar.has(kural)) return null;
  return kt.kuralOzeti(kural).madde_idleri[0] || null;
}

function bagliKalem(kalemler, tarih) {
  return (kalemler || []).filter((k) => k.tarih === tarih).at(-1) || null;
}

// Kapalı ve açık cezaevinde geçen günler. Açığa geçiş tarihi kurumdan çıkıştan sonra
// ise (ör. geçici 6/1 ile kapalıdan DS) bütün süre kapalıda geçer.
export function kurumBolumleri(S) {
  const t = S.takvim;
  const giris = t.infaza_baslama;
  const cikis = t.kurumdan_cikis;
  if (!cikis || T.once(cikis, giris)) return { kapali: 0, acik: 0, acikTarih: null };
  const acikTarih = t.kapalidan_aciga_hak_kazanma ? gec(t.kapalidan_aciga_hak_kazanma, giris) : null;
  if (!acikTarih || !T.once(acikTarih, cikis)) return { kapali: fark(giris, cikis), acik: 0, acikTarih: null };
  return { kapali: fark(giris, acikTarih), acik: fark(acikTarih, cikis), acikTarih };
}

function nedenler(kt, S, bol) {
  const n = {};
  const a = S.acik_kurum;
  if (S.yol === 'para_hapis' || S.yol === 'cek_5_11') {
    n.kapali = { metin: 'Adli paradan çevrilen hapis doğrudan açık cezaevinde infaz edilir (5275 m.14/2-c).', madde: maddeBul(kt, 'R060') };
  } else if (a?.ds_donus) {
    n.kapali = { metin: a.dogrudan.neden, madde: maddeBul(kt, 'R040') };
  } else if (a?.yol === 'dogrudan') {
    n.kapali = { metin: 'Ceza doğrudan açık cezaevinde başlar (5275 m.14/2).', madde: maddeBul(kt, 'R060') };
  } else if (a?.yol === 'yasak') {
    n.kapali = { metin: a.yasaklar[0]?.neden || 'Açık cezaevine ayrılamaz.', madde: maddeBul(kt, a.yasaklar[0]?.kural || 'R087') };
  } else if (a?.yol === 'kapalidan') {
    const k = bagliKalem(a.kapali.kalemler, a.tarih);
    n.kapali = { metin: k ? `Açığa geçiş şartı: ${k.ad}.` : a.kapali.aciklama, madde: maddeBul(kt, k?.kural || 'R081') };
    if (bol.acik === 0 && bol.kapali > 0) n.kapali.metin += ' Açığa geçiş tarihinden önce denetimli serbestliğe çıkılıyor.';
  }
  const yol = S.ds_yollari?.find((y) => y.id === S.secilen_ds_yolu);
  if (yol) {
    const k = bagliKalem(yol.kalemler, yol.tarih);
    n.cikis = { metin: `${yol.ad}${k ? `: ${k.ad}` : ''}.`, madde: maddeBul(kt, yol.kural) };
  } else if (S.takvim?.kosullu_saliverilme) {
    n.cikis = { metin: 'Denetimli serbestlik yolu yok; çıkış koşullu salıverilme tarihinde.', madde: maddeBul(kt, 'R040') };
  }
  if (S.temel_oran) {
    const oran = S.oran ? String(S.oran) : String(S.temel_oran.oran);
    n.ks = { metin: `Koşullu salıverilme oranı ${oran}: ${S.ks_gun} gün.${S.ust_sinir_108_2?.uygulandi ? ' 108/2 sınırı uygulandı.' : ''}`, madde: maddeBul(kt, S.oran && S.anahtar !== 'yok' ? 'R027' : S.temel_oran.kaynak) };
  } else if (S.muebbet) {
    n.ks = { metin: `Koşullu salıverilme için ${S.muebbet.yil} yıl (${S.muebbet.ad}).`, madde: maddeBul(kt, S.muebbet.kural) };
  }
  return n;
}

function olaylar(d, S, bol) {
  const t = S.takvim;
  const liste = [];
  const mahsup = t.mahsup_gun ? ` · gözaltı/tutukluluk ${t.mahsup_gun} gün düşüldü` : '';
  const girisVarsayim = d.konum !== 'cezaevinde' && d.giris?.tur !== 'tarih';
  const dogrudanAcik = S.acik_kurum?.yol === 'dogrudan' || S.yol === 'para_hapis' || S.yol === 'cek_5_11';
  liste.push({
    tur: dogrudanAcik ? 'acik' : 'giris',
    tarih: t.infaza_baslama,
    baslik: dogrudanAcik ? 'Açık cezaevine giriş' : 'Kapalı cezaevine giriş',
    aciklama: `${girisVarsayim ? 'Bugün girdiği varsayıldı' : d.konum === 'cezaevinde' ? 'İnfaza başlama' : 'Varsayılan giriş'}${mahsup}`,
  });
  if (!dogrudanAcik && bol.acikTarih) {
    const g10 = S.acik_kurum?.kapali?.gecici10;
    liste.push({
      tur: 'acik',
      tarih: bol.acikTarih,
      baslik: 'Açık cezaevine geçiş',
      aciklama: g10 ? `Geçici 10/6 ile erken (normalde ${tr(S.acik_kurum.kapali.normal_tarih)}) · kurul kararıyla` : 'En erken; iyi hâl ve kurul kararıyla',
    });
  } else if (S.acik_kurum?.yol === 'yasak') {
    liste.push({ tur: 'yasak', tarih: null, baslik: 'Açık cezaevine geçemez', aciklama: 'Bütün süre kapalı cezaevinde' });
  }
  const ds = t.DSye_hak_kazanma && t.ds_suresi_gun > 0;
  if (t.kurumdan_cikis) {
    // Mahsup çıkış şartlarını girişten önce karşılamışsa çıkış giriş günüdür.
    const onceden = T.once(t.kurumdan_cikis, t.infaza_baslama);
    liste.push({
      tur: 'cikis',
      tarih: onceden ? t.infaza_baslama : t.kurumdan_cikis,
      onceden,
      baslik: ds ? 'Cezaevinden çıkış · denetimli serbestlik' : t.kosullu_saliverilme ? 'Cezaevinden çıkış · koşullu salıverilme' : 'Cezaevinden çıkış',
      aciklama: onceden ? 'Şartlar mahsupla girişte oluşmuş · iyi hâl ve talep şartıyla' : S.secilen_ds_yolu === 'gecici10_6' ? 'En yakın tahliye · geçici 10/6 (3 yıl erken) · iyi hâl ve talep şartıyla' : ds || t.kosullu_saliverilme ? 'En yakın tahliye · iyi hâl şartıyla' : 'Ceza bitimi',
      vurgu: true,
    });
  }
  if (ds && t.kosullu_saliverilme) {
    liste.push({ tur: 'ks', tarih: t.kosullu_saliverilme, baslik: 'Koşullu salıverilme', aciklama: 'Denetimli serbestlik biter' });
  }
  if (t.hak_ederek_tahliye && t.hak_ederek_tahliye !== t.kurumdan_cikis) {
    liste.push({ tur: 'bitis', tarih: t.hak_ederek_tahliye, baslik: 'Ceza bitişi', aciklama: 'Hak ederek tahliye' });
  } else if (!t.hak_ederek_tahliye && S.muebbet) {
    liste.push({ tur: 'bitis', tarih: null, baslik: 'Ceza bitişi', aciklama: 'Müebbet: koşullu salıverilmeden sonra denetim süresi' });
  }
  return liste;
}

// Engelleyici hukuki notlar: yalnız avukatın bilmesi gerekenler (inceleme seviyesi).
function dikkatNotlari(c, S) {
  const goster = (n) => n.seviye === 'inceleme' && n.kod !== 'GIRDI';
  const liste = [...(c.notlar || []), ...(S.notlar || [])].filter(goster).map((n) => n.mesaj);
  return [...new Set(liste)];
}

function karsilastirma(c, secili) {
  return ['yok', 'birinci', 'ikinci'].map((anahtar) => {
    const S = c.senaryolar[anahtar];
    const gecerli = S && S.uygulanabilir && !S.hesaplanamadi && S.kurumda_kalis_gun !== null && S.takvim;
    return {
      anahtar,
      baslik: BASLIK[anahtar],
      gun: gecerli ? S.kurumda_kalis_gun : null,
      cikis: gecerli ? gec(S.takvim.kurumdan_cikis, S.takvim.infaza_baslama) : null,
      en_cok: !!S?.en_cok,
      neden: gecerli ? null : S?.neden || 'Hesaplanamadı',
      secili: anahtar === secili,
    };
  });
}

// Ana giriş. `anahtar` verilmezse dosyanın tekerrür cevabına göre senaryo seçilir.
// `talepsiz`: aynı dosyanın hükümlü DS talep etmeden hesabı (yoksa gösterilmez).
export function sonucOzeti(kt, d, c, anahtar = null, talepsiz = null) {
  if (kapsamDisi(d)) {
    return { durum: 'kapsam_disi', mesaj: `${tr(KAPSAM_BASLANGICI)} öncesi suçlar bu araçta hesaplanmaz (765 sayılı TCK ile lehe kanun karşılaştırması gerekir).` };
  }
  if (!hesaplanabilir(d) || !c || !c.senaryolar?.yok) {
    return { durum: 'bos', mesaj: 'Suç tarihi ve ceza girildiğinde sonuç burada görünür.' };
  }
  const secili = anahtar || gosterilenSenaryo(d);
  const S = c.senaryolar[secili];
  const ortak = {
    senaryo: secili,
    baslik: BASLIK[secili],
    karsilastirma: karsilastirma(c, secili),
    varsayimlar: varsayimSatirlari(d),
    dikkat: [],
  };
  if (!S || !S.uygulanabilir || S.hesaplanamadi || !S.takvim || S.kurumda_kalis_gun === null) {
    return { ...ortak, durum: 'hesaplanamadi', mesaj: S?.neden || 'Bu senaryo hesaplanamadı.', dikkat: S ? dikkatNotlari(c, S) : [] };
  }
  const bol = kurumBolumleri(S);
  const t = S.takvim;
  return {
    ...ortak,
    durum: 'tamam',
    en_cok: S.en_cok,
    kapali: bol.kapali,
    acik: bol.acik,
    ds: t.DSye_hak_kazanma && t.kosullu_saliverilme ? fark(gec(t.kurumdan_cikis, t.infaza_baslama), t.kosullu_saliverilme) : 0,
    icerde: S.kurumda_kalis_gun,
    neden: nedenler(kt, S, bol),
    olaylar: olaylar(d, S, bol),
    dikkat: dikkatNotlari(c, S),
    adimlar: S.izler.map((i) => `${i.adim}: ${i.aciklama}`),
    talepsiz: talepsizOzet(S, talepsiz?.senaryolar?.[secili]),
    tarihler: {
      acik: S.acik_kurum?.yol === 'dogrudan' || S.yol === 'para_hapis' || S.yol === 'cek_5_11' ? t.infaza_baslama : bol.acikTarih,
      cikis: t.kurumdan_cikis && gec(t.kurumdan_cikis, t.infaza_baslama),
      ks: t.kosullu_saliverilme,
      bitis: t.hak_ederek_tahliye,
    },
  };
}

// [kimlik, giriş etiketi, tablo etiketi]
export const MUDDETNAME_KALEMLERI = [
  ['acik', 'Açık kuruma ayrılma', 'Açığa ayrılma'],
  ['cikis', 'Denetimli serbestliğe ayrılma', 'DS\'ye ayrılma'],
  ['ks', 'Koşullu salıverilme', 'Koşullu salıverilme'],
  ['bitis', 'Hak ederek tahliye', 'Bihakkın tahliye'],
];

// Müddetnamedeki tarihlerle hesabın karşılaştırması. fark > 0: müddetname daha geç.
export function muddetnameKarsilastir(o, md = {}) {
  if (o?.durum !== 'tamam') return [];
  return MUDDETNAME_KALEMLERI.map(([id, ad, kisa]) => {
    const hesap = o.tarihler[id] || null;
    const muddetname = md[id] || null;
    return { id, ad, kisa, hesap, muddetname, fark: hesap && muddetname ? T.gunFarki(hesap, muddetname) : null };
  });
}

// Hükümlü DS talep etmezse: çıkış koşullu salıverilmede (yoksa ceza bitiminde).
// Yalnız talepli sonuçtan farklıysa döner.
function talepsizOzet(S, T2) {
  if (!T2?.takvim?.kurumdan_cikis || T2.kurumda_kalis_gun === null || !S.takvim.DSye_hak_kazanma) return null;
  if (T2.takvim.kurumdan_cikis === S.takvim.kurumdan_cikis) return null;
  const bol = kurumBolumleri(T2);
  return { cikis: T2.takvim.kurumdan_cikis, icerde: T2.kurumda_kalis_gun, kapali: bol.kapali, acik: bol.acik, ks: !!T2.takvim.kosullu_saliverilme };
}

// Müvekkile gönderilebilecek düz metin.
export function paylasimMetni(d, o) {
  if (o.durum !== 'tamam') return o.mesaj || '';
  const suc = d.suc ? `${sucAdi(d.suc) || maddeEtiketi(d.suc)}` : null;
  const ceza = { muebbet: 'Müebbet hapis', agirlastirilmis_muebbet: 'Ağırlaştırılmış müebbet hapis' }[d.ceza_turu] || T.cezaMetni(d.ceza);
  const satirlar = [];
  satirlar.push(`${ceza}${suc ? ` · ${suc}` : ''} · suç tarihi ${tr(d.suc_tarihi)}${d.tekerrur && d.tekerrur !== 'yok' ? ` · ${BASLIK[d.tekerrur]}` : ''}`);
  const parca = [];
  if (o.kapali) parca.push(`${o.kapali} gün kapalı`);
  if (o.acik) parca.push(`${o.acik} gün açık cezaevinde`);
  satirlar.push(`${parca.length ? parca.join(', ') + ' kalır' : 'Cezaevinde kalmaz'}${o.ds ? `; sonra ${o.ds} gün denetimli serbestlik` : ''}.`);
  satirlar.push('');
  for (const e of o.olaylar) if (e.tarih) satirlar.push(`${tr(e.tarih)}  ${e.baslik}`);
  if (o.talepsiz) satirlar.push(`\nDenetimli serbestliği talep etmezse: ${tr(o.talepsiz.cikis)} tarihinde ${o.talepsiz.ks ? 'koşullu salıverilme ile' : 'ceza bitiminde'} çıkar (${o.talepsiz.icerde} gün cezaevinde).`);
  satirlar.push('');
  satirlar.push('Tarihler iyi hâl şartıyla en erken tarihlerdir; kurum ve hâkimlik kararlarına bağlıdır.');
  if (o.en_cok) satirlar.push('Bazı bilgiler bilinmediğinden aleyhe hesaplandı; süre daha kısa olabilir.');
  return satirlar.join('\n');
}
