// Okunan belge (cekirdek/belge → belgeOku) → hesap dosyası.
//
// İki kullanım:
//   yeni       Belge yeni bir dosya başlatır (ör. içtima kararı: her ilam bir kayıt).
//   birlestir  Belge mevcut dosyayı tamamlar (ör. içtima kararından sonra gelen
//              müddetname veya gerekçeli karar). İlamlar infaz no ya da esas/karar
//              numarasıyla (gerekirse ceza miktarıyla) eşleştirilir; yalnız BOŞ alanlar
//              doldurulur, avukatın girdiği cevaplar değiştirilmez.
// Her aktarılan bilgi "değişiklik" satırı olarak döner; arayüz bunları gösterir.
// DOM bilmez; Node'da test edilir.

import { takvim as T } from '../cekirdek/index.js';
import { bosDosya, bosIlam, cezaVar, ilamAdi, mahsupYukle, tamDosya, MAHSUP_TURLERI } from './dosya.js';
import { sucAra, maddeEtiketi } from './tck-maddeleri.js';

const tr = (s) => (s ? T.trTarih(s) : '');
// İçtima kararlarındaki gibi bileşen bileşen toplam (yıl, ay, gün ayrı; 5275 m.99 yazımı).
const cezaToplami = (ilamlar) => ilamlar.reduce((t, il) => (cezaVar(il.ceza) ? { yil: t.yil + (il.ceza.yil || 0), ay: t.ay + (il.ceza.ay || 0), gun: t.gun + (il.ceza.gun || 0) } : t), { yil: 0, ay: 0, gun: 0 });
const cezaEsit = (a, b) => cezaVar(a) && cezaVar(b) && a.yil === b.yil && a.ay === b.ay && a.gun === b.gun;
const MAHSUP_ADI = Object.fromEntries(MAHSUP_TURLERI);

// Suç önerileri: belgede geçen özel hüküm maddeleri; yoksa suç adından katalog araması.
export function sucOnerileri(o) {
  const maddeler = (o.maddeler || []).map(({ kanun, madde, fikra, bent }) => ({ kanun, madde, fikra: fikra || null, bent: bent || null }));
  if (maddeler.length) return maddeler;
  if (!o.suc_adi) return [];
  return sucAra(o.suc_adi, 3).map((s) => ({ kanun: s.kanun, madde: s.madde, fikra: null, bent: null }));
}

// Tek ve kesin bir madde varsa doğrudan seçilir; birden çok aday (ör. 86/2 ve 86/3-e) sorulur.
const kesinSuc = (o) => (o.maddeler?.length === 1 ? sucOnerileri(o)[0] : null);

function mahsupKayitlari(liste) {
  const m = (liste || []).map(({ tur, gun, baslangic, bitis }) => (gun ? { tur, gun } : { tur, baslangic, bitis }));
  return m.length ? mahsupYukle(m) : null;
}

// Belgedeki ilam → dosya ilamı.
function ilamOlustur(o, belgeTuru) {
  const il = bosIlam({
    etiket: o.etiket || null,
    mahkeme: o.mahkeme || null,
    esas_no: o.esas_no || null,
    karar_no: o.karar_no || null,
    karar_tarihi: o.karar_tarihi || null,
    infaz_no: o.infaz_no || null,
    suc_adi: o.suc_adi || null,
    madde_onerileri: sucOnerileri(o),
    kaynak: o.kaynak || null,
    belge_turu: belgeTuru,
  });
  for (const k of Object.keys(il.meta)) if (il.meta[k] === null) delete il.meta[k];
  if (o.ceza_turu && o.ceza_turu !== 'sureli_hapis') il.ceza_turu = o.ceza_turu;
  if (cezaVar(o.ceza)) il.ceza = { ...o.ceza };
  if (o.suc_tarihi) il.suc_tarihi = o.suc_tarihi;
  il.suc = kesinSuc(o);
  return il;
}

// Mevcut ilamın boş alanlarını belgeden doldurur; yapılan değişiklikleri döndürür.
function doldur(il, o, ad, { sucTarihiAktar = true } = {}) {
  const degisen = [];
  const meta = il.meta;
  for (const k of ['etiket', 'mahkeme', 'esas_no', 'karar_no', 'karar_tarihi', 'infaz_no', 'suc_adi']) if (!meta[k] && o[k]) meta[k] = o[k];
  if (!il.ceza && cezaVar(o.ceza)) {
    il.ceza = { ...o.ceza };
    if (o.ceza_turu) il.ceza_turu = o.ceza_turu;
    degisen.push(`${ad}: ceza ${T.cezaMetni(o.ceza)}`);
  }
  if (sucTarihiAktar && !il.suc_tarihi && o.suc_tarihi) {
    il.suc_tarihi = o.suc_tarihi;
    il.bilinmiyor = il.bilinmiyor.filter((x) => x !== 'suc_tarihi');
    degisen.push(`${ad}: suç tarihi ${tr(o.suc_tarihi)}`);
  }
  if (!il.suc) {
    const s = kesinSuc(o);
    const oneriler = sucOnerileri(o);
    if (s) {
      il.suc = s;
      il.bilinmiyor = il.bilinmiyor.filter((x) => x !== 'suc');
      degisen.push(`${ad}: suç ${maddeEtiketi(s)}`);
    } else if (oneriler.length && !meta.madde_onerileri?.length) {
      meta.madde_onerileri = oneriler;
      degisen.push(`${ad}: suç önerisi ${oneriler.map(maddeEtiketi).join(', ')} (seçmeniz istenecek)`);
    }
  }
  return degisen;
}

// Belgedeki ilamın dosyadaki karşılıkları: infaz no, esas+karar no; birden çoksa ceza miktarı.
export function eslesenIlamlar(d, o) {
  let adaylar = d.ilamlar
    .map((il, i) => ({ il, i }))
    .filter(({ il }) => (o.infaz_no && il.meta.infaz_no === o.infaz_no) || (o.esas_no && il.meta.esas_no === o.esas_no && (!o.karar_no || !il.meta.karar_no || il.meta.karar_no === o.karar_no)));
  if (adaylar.length > 1 && o.infaz_no) {
    const tam = adaylar.filter(({ il }) => il.meta.infaz_no === o.infaz_no);
    if (tam.length) adaylar = tam;
  }
  if (adaylar.length > 1 && cezaVar(o.ceza)) {
    const ayni = adaylar.filter(({ il }) => cezaEsit(il.ceza, o.ceza));
    if (ayni.length) adaylar = ayni;
  }
  return adaylar.map(({ i }) => i);
}

const bosIlamMi = (il) => !il.suc_tarihi && !il.ceza && !il.suc && !il.meta?.etiket && !il.meta?.esas_no;

export function belgeyiAktar(mevcut, okuma, { mod = 'yeni' } = {}) {
  const d = mod === 'yeni' || !mevcut ? bosDosya() : structuredClone(tamDosya(mevcut));
  const degisiklikler = [];
  const uyarilar = [...(okuma.uyarilar || [])];
  const yeniBaslangic = mod === 'yeni' || (d.ilamlar.length === 1 && bosIlamMi(d.ilamlar[0]));

  // İlamlar
  const gelen = okuma.ilamlar || [];
  if (yeniBaslangic) {
    if (gelen.length) d.ilamlar = gelen.map((o) => ilamOlustur(o, okuma.tur));
    gelen.forEach((o, n) => {
      const parca = [o.ceza ? T.cezaMetni(o.ceza) : null, o.suc_tarihi ? `suç ${tr(o.suc_tarihi)}` : null, d.ilamlar[n].suc ? maddeEtiketi(d.ilamlar[n].suc) : null].filter(Boolean);
      degisiklikler.push(`${ilamAdi(d, n)}${parca.length ? ': ' + parca.join(' · ') : ''}`);
    });
  } else {
    for (const o of gelen) {
      const eslesen = eslesenIlamlar(d, o);
      if (eslesen.length === 1) {
        degisiklikler.push(...doldur(d.ilamlar[eslesen[0]], o, ilamAdi(d, eslesen[0])));
      } else if (eslesen.length > 1) {
        // Aynı hükümden birden çok ceza (ör. aynı esas/karar): suç tarihi ilamlar arasında farklı olabilir.
        eslesen.forEach((i) => degisiklikler.push(...doldur(d.ilamlar[i], o, ilamAdi(d, i), { sucTarihiAktar: false })));
        if (o.suc_tarihi) uyarilar.push(`${o.etiket || 'Belgedeki ilam'} birden çok ilamla eşleşti (${eslesen.map((i) => i + 1).join(', ')}. ilam); suç tarihi otomatik aktarılmadı.`);
      } else if (d.ilamlar.length === 1 && !d.ilamlar[0].meta?.esas_no) {
        // Elle girilmiş tek ilam: belge onu tamamlar.
        degisiklikler.push(...doldur(d.ilamlar[0], o, ilamAdi(d, 0)));
      } else {
        d.ilamlar.push(ilamOlustur(o, okuma.tur));
        degisiklikler.push(`${ilamAdi(d, d.ilamlar.length - 1)}: dosyada eşi bulunamadı, yeni ilam olarak eklendi`);
      }
    }
  }

  // Mahsuplar (müddetname): eşleşen veya tek ilama
  const mahsup = mahsupKayitlari(okuma.infaz?.mahsuplar);
  if (mahsup?.length) {
    const hedef = gelen.length ? (eslesenIlamlar(d, gelen[0]).length === 1 ? eslesenIlamlar(d, gelen[0])[0] : d.ilamlar.length === 1 ? 0 : null) : 0;
    if (hedef !== null && d.ilamlar[hedef].mahsup == null) {
      d.ilamlar[hedef].mahsup = mahsup;
      d.ilamlar[hedef].bilinmiyor = d.ilamlar[hedef].bilinmiyor.filter((x) => x !== 'mahsup');
      for (const m of mahsup) degisiklikler.push(`${ilamAdi(d, hedef)}: ${MAHSUP_ADI[m.tur]} ${m.gun ? `${m.gun} gün` : `${tr(m.baslangic)} – ${tr(m.bitis)}`}`);
    } else if (hedef === null) uyarilar.push('Müddetnamedeki gözaltı/tutukluluk kayıtları hangi ilama ait olduğu belirlenemediği için aktarılmadı.');
  }

  // Dosya düzeyi: doğum tarihi, infaza başlama, müddetname tarihleri, belge özeti
  if (okuma.kisi?.dogum_tarihi && !d.ek.dogum_tarihi) {
    d.ek.dogum_tarihi = okuma.kisi.dogum_tarihi;
    delete d.ek.yas;
    d.bilinmiyor = d.bilinmiyor.filter((x) => x !== 'yas' && x !== 'dogum_tarihi');
    degisiklikler.push(`Doğum tarihi ${tr(okuma.kisi.dogum_tarihi)}`);
  }
  if (okuma.infaz?.baslama && !(d.giris?.tur === 'tarih')) {
    d.konum = 'cezaevinde';
    d.giris = { tur: 'tarih', tarih: okuma.infaz.baslama };
    d.bilinmiyor = d.bilinmiyor.filter((x) => x !== 'giris');
    degisiklikler.push(`Cezaevine giriş ${tr(okuma.infaz.baslama)}`);
  }
  // Müddetname tarihleri yalnız müddetname bütün dosyaya aitse karşılaştırılır: dosyada tek
  // ilam varsa ya da müddetnamedeki ceza ilamların toplamına eşitse. Toplanan cezalarda tek
  // ilamın müddetnamesi (KS, tahliye) toplam hesapla karşılaştırılamaz.
  const md = Object.entries(okuma.muddetname || {}).filter(([k, v]) => v && !d.muddetname[k]);
  const mdCeza = okuma.tur === 'muddetname' ? okuma.ilamlar?.[0]?.ceza : null;
  const butunDosya = d.ilamlar.length === 1 || (cezaVar(mdCeza) && cezaEsit(mdCeza, cezaToplami(d.ilamlar)));
  if (md.length && butunDosya) {
    for (const [k, v] of md) d.muddetname[k] = v;
    degisiklikler.push(`Müddetname tarihleri karşılaştırmaya aktarıldı (${md.length})`);
  } else if (md.length) {
    const ad = gelen.length && eslesenIlamlar(d, gelen[0]).length === 1 ? ilamAdi(d, eslesenIlamlar(d, gelen[0])[0]) : 'tek bir ilam';
    uyarilar.push(`Müddetname yalnız ${ad} için düzenlenmiş${cezaVar(mdCeza) ? ` (${T.cezaMetni(mdCeza)})` : ''}; koşullu salıverilme ve tahliye tarihleri toplanan cezalarla karşılaştırılamayacağından karşılaştırma tablosuna aktarılmadı.`);
  }
  if (okuma.tur === 'ictima_karari' || !d.belge) {
    d.belge = { tur: okuma.tur, tur_adi: okuma.tur_adi, karar: okuma.karar || null, kisi_ad: okuma.kisi?.ad || null, toplam: okuma.toplam?.ceza || null, uyusuyor: okuma.toplam?.uyusuyor ?? null };
  }
  return { dosya: d, degisiklikler, uyarilar };
}
