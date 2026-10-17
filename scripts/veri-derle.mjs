#!/usr/bin/env node
// Veri derleme hattı: kaynak kural tabanını doğrular ve eklentinin çalışma
// paketlerine böler.
//
//   kaynak/kural_tabani.json  (tek doğruluk kaynağı, ~5 MB)
//        │  doğrula: kimlik tekilliği, çapraz atıflar, koşul ifadeleri,
//        │           alan sözlüğü, tam metin ve kanıt SHA-256 özetleri
//        ▼
//   extension/veri/paket.json        çalışma zamanı çekirdeği (tam metinler hariç)
//   extension/veri/metin/U01..U13    kanun/yönetmelik başına madde dizini, dipnot,
//                                    değişiklik işaretleri ve kanıt metinleri (tembel yüklenir)
//
// Kullanım:  node scripts/veri-derle.mjs            derler ve yazar
//            node scripts/veri-derle.mjs --kontrol  yazılı paketlerin güncel olduğunu denetler

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ifadeyiDogrula } from '../extension/cekirdek/dil/kosul.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KAYNAK_YOLU = path.join(KOK, 'kaynak', 'kural_tabani.json');
export const HEDEF_DIZIN = path.join(KOK, 'extension', 'veri');

const sha256 = (veri) => crypto.createHash('sha256').update(veri).digest('hex');

// Çalışma paketine giren bölümler. Tam metinler, mantık testleri ve kabul
// senaryoları yalnız derleme/test aşamasında kullanılır.
const PAKET_BOLUMLERI = [
  'paket', 'surum_gecmisi', 'dogrulama_sozlugu', 'kaynaklar', 'mevzuat_envanteri', 'tarih_esikleri',
  'girdi_modeli', 'kurallar', 'uygulama_sirasi', 'hesap_politikasi', 'gorseldeki_iddia_incelemesi',
  'cikti_modeli', 'dogrulama_raporu', 'vaka_json_semasi', 'cek_modulu', 'norm_cakismalari',
  'onceki_eksiklerin_kapanis_kaydi', 'acik_konular', 'tamlik_beyani', 'kural_dili',
  'karar_ifadesi_json_semasi', 'makine_secicileri', 'karar_dugumleri', 'karar_cozumleme_politikasi',
  'karar_alani_sozlugu', 'baglam_uyarlama', 'vaka_anlamsal_denetimleri', 'ceza_ve_odeme_modeli',
  'olay_ve_sure_modeli', 'kural_kanitlari', 'kaynak_guncelleme_sozlesmesi',
];

const SIRA_SOZCUKLERI = ['BİRİNCİ', 'İKİNCİ', 'ÜÇÜNCÜ', 'DÖRDÜNCÜ', 'BEŞİNCİ', 'ALTINCI', 'YEDİNCİ', 'SEKİZİNCİ', 'DOKUZUNCU', 'ONUNCU'];

// ---------------------------------------------------------------------------
// Doğrulama
// ---------------------------------------------------------------------------

function tekil(hatalar, liste, alan, ad) {
  const gorulen = new Set();
  for (const x of liste) {
    const id = x[alan];
    if (gorulen.has(id)) hatalar.push(`${ad}: yinelenen kimlik ${id}`);
    gorulen.add(id);
  }
  return gorulen;
}

function atif(hatalar, kume, idler, kim) {
  for (const id of idler || []) if (!kume.has(id)) hatalar.push(`${kim}: tanımsız atıf ${id}`);
}

// Unicode kod noktası aralığı (kaynak Python ile üretildiği için kod noktası sayar).
function kodNoktasiDilimi(metin, bas, bit) {
  return /[\uD800-\uDFFF]/.test(metin) ? Array.from(metin).slice(bas, bit).join('') : metin.slice(bas, bit);
}

export function dogrula(kt) {
  const hatalar = [];
  const kurallar = tekil(hatalar, kt.kurallar, 'kural_id', 'kurallar');
  const kaynaklar = tekil(hatalar, kt.kaynaklar, 'kaynak_id', 'kaynaklar');
  const dugumler = tekil(hatalar, kt.karar_dugumleri, 'dugum_id', 'karar_dugumleri');
  const seciciIdleri = tekil(hatalar, kt.makine_secicileri, 'secici_id', 'makine_secicileri');
  const kanitlar = tekil(hatalar, kt.kural_kanitlari, 'kanit_id', 'kural_kanitlari');
  tekil(hatalar, kt.tarih_esikleri, 'esik_id', 'tarih_esikleri');
  tekil(hatalar, kt.acik_konular, 'konu_id', 'acik_konular');
  tekil(hatalar, kt.kabul_senaryolari, 'senaryo_id', 'kabul_senaryolari');
  tekil(hatalar, kt.karar_mantigi_testleri.testler, 'test_id', 'karar_mantigi_testleri');
  tekil(hatalar, kt.karar_alani_sozlugu, 'alan', 'karar_alani_sozlugu');

  const maddeler = new Map();
  for (const m of kt.mevzuat_tam_metinleri) {
    if (sha256(m.tam_metin) !== m.metin_sha256) hatalar.push(`${m.kaynak_id}: tam metin SHA-256 uyuşmuyor`);
    if (!kaynaklar.has(m.kaynak_id)) hatalar.push(`${m.kaynak_id}: kaynaklar listesinde yok`);
    for (const a of m.madde_dizini) maddeler.set(a.madde_id, { madde: a, metin: m });
  }

  for (const r of kt.kurallar) {
    atif(hatalar, kaynaklar, r.kaynak_idleri, r.kural_id);
    atif(hatalar, dugumler, r.karar_dugumu_idleri, r.kural_id);
    atif(hatalar, kanitlar, r.kanit_kimlikleri, r.kural_id);
    atif(hatalar, maddeler, r.madde_referanslari, r.kural_id);
  }
  for (const d of kt.karar_dugumleri) atif(hatalar, kurallar, d.dayanak_kurallar, d.dugum_id);
  for (const s of kt.makine_secicileri) atif(hatalar, kurallar, s.dayanak_kurallar, s.secici_id);

  // Koşul ifadeleri: yapı + alan sözlüğü + seçici varlığı
  const alanlar = new Set(kt.karar_alani_sozlugu.map((a) => a.alan));
  const seciciler = new Map(kt.makine_secicileri.map((s) => [s.secici_id, s]));
  for (const s of kt.makine_secicileri) hatalar.push(...ifadeyiDogrula(s.kosul, { alanlar, seciciler }, s.secici_id));
  for (const d of kt.karar_dugumleri) hatalar.push(...ifadeyiDogrula(d.kosul, { alanlar, seciciler }, d.dugum_id));

  // Kanıtlar: kaynak metin aralığı ve özet
  for (const k of kt.kural_kanitlari) {
    if (!kurallar.has(k.kural_id)) hatalar.push(`${k.kanit_id}: tanımsız kural`);
    const m = maddeler.get(k.madde_id);
    if (!m) {
      hatalar.push(`${k.kanit_id}: tanımsız madde ${k.madde_id}`);
      continue;
    }
    const dilim = kodNoktasiDilimi(m.metin.tam_metin, k.tam_metinde_baslangic_unicode_karakter, k.tam_metinde_bitis_haric_unicode_karakter);
    if (sha256(dilim) !== k.madde_metin_sha256) hatalar.push(`${k.kanit_id}: kanıt metni SHA-256 uyuşmuyor`);
    if (m.metin.orijinal_dosya_sha256 !== k.kaynak_dosya_sha256) hatalar.push(`${k.kanit_id}: kaynak dosya özeti uyuşmuyor`);
  }
  return hatalar;
}

// ---------------------------------------------------------------------------
// Türetilen veri: TCK kitap / kısım / bölüm yapısı (SC04-SC07 seçicileri için)
// ---------------------------------------------------------------------------

export function tckYapisiCikar(tck) {
  const metin = tck.tam_metin;
  const baslik = /^[\t  ]*([A-ZÇĞİÖŞÜ]+)\s+(KİTAP|KISIM|BÖLÜM)[\t  ]*$/gm;
  const olaylar = [];
  for (let m; (m = baslik.exec(metin)); ) {
    const sira = SIRA_SOZCUKLERI.indexOf(m[1]) + 1;
    if (sira > 0) olaylar.push({ konum: m.index, tur: m[2], sira });
  }
  const yapi = {};
  let arama = 0;
  for (const a of tck.madde_dizini) {
    if (!/^\d+(\/[A-Z])?$/.test(a.madde_no)) continue;
    const parca = a.metin.slice(0, 60);
    const konum = metin.indexOf(parca, arama);
    if (konum < 0) continue;
    arama = konum;
    let kitap = null;
    let kisim = null;
    let bolum = null;
    for (const o of olaylar) {
      if (o.konum > konum) break;
      if (o.tur === 'KİTAP') [kitap, kisim, bolum] = [o.sira, null, null];
      else if (o.tur === 'KISIM') [kisim, bolum] = [o.sira, null];
      else bolum = o.sira;
    }
    yapi[a.madde_no] = [kitap, kisim, bolum];
  }
  return yapi;
}

// ---------------------------------------------------------------------------
// Bölme
// ---------------------------------------------------------------------------

function baslikTemizle(b) {
  if (!b) return null;
  const s = b.replace(/\[DIPNOT:[^\]]*\]/g, '').trim();
  return s.length > 140 || /^(Madde|Geçici Madde|[a-zçğıöşü]\))/i.test(s) ? null : s;
}

function metinDosyasi(m, kt, isaretler) {
  const kanitlar = {};
  for (const k of kt.kural_kanitlari.filter((x) => x.kaynak_id === m.kaynak_id)) {
    kanitlar[k.kanit_id] = {
      kural_id: k.kural_id,
      madde_id: k.madde_id,
      sha256: k.madde_metin_sha256,
      metin: kodNoktasiDilimi(m.tam_metin, k.tam_metinde_baslangic_unicode_karakter, k.tam_metinde_bitis_haric_unicode_karakter),
    };
  }
  const degisiklik = {};
  for (const i of isaretler?.isaretler || []) (degisiklik[i.madde_id] ||= []).push(i.metin);
  return {
    kaynak_id: m.kaynak_id,
    mevzuat_id: m.mevzuat_id,
    ad: m.ad,
    tur: m.tur,
    mevzuat_numarasi: m.mevzuat_numarasi,
    ilk_yayim: m.ilk_yayim,
    alma_tarihi: m.alma_tarihi,
    metin_sha256: m.metin_sha256,
    orijinal_dosya_sha256: m.orijinal_dosya_sha256,
    bagimsiz_guncellik_taramasi_tamamlandi: m.bagimsiz_guncellik_taramasi_tamamlandi,
    maddeler: m.madde_dizini.map((a) => ({
      madde_id: a.madde_id,
      madde_no: a.madde_no,
      bolum: a.bolum,
      baslik: baslikTemizle(a.baslik_adayi),
      metin: a.metin,
      dipnot_idleri: a.dipnot_idleri,
      mulga: a.ilk_satirda_mulga,
    })),
    dipnotlar: Object.fromEntries(m.dipnotlar_ve_sonnotlar.map((d) => [d.not_id, d.metin.trim()])),
    degisiklik_isaretleri: degisiklik,
    kanitlar,
    kalite: {
      word_alan_hatasi_adedi: m.kalite?.word_alan_hatalari?.length || 0,
      eksik_dipnot_referanslari: m.kalite?.eksik_dipnot_referanslari || [],
    },
  };
}

export function derle(kaynakMetni) {
  const kt = JSON.parse(kaynakMetni);
  const hatalar = dogrula(kt);
  if (hatalar.length) return { hatalar };

  const tck = kt.mevzuat_tam_metinleri.find((m) => m.mevzuat_numarasi === '5237');
  const isaretler = new Map(kt.degisiklik_ve_iptal_indeksi.map((x) => [x.kaynak_id, x]));
  const paket = {
    kimlik: {
      paket_surumu: kt.paket.surum,
      kaynak_sha256: sha256(kaynakMetni),
      kaynak_dosya: 'kaynak/kural_tabani.json',
      bicim: 1,
    },
  };
  for (const b of PAKET_BOLUMLERI) {
    if (!(b in kt)) throw new Error('Kaynakta bölüm yok: ' + b);
    paket[b] = kt[b];
  }
  paket.madde_kapsam_matrisi = kt.madde_kapsam_matrisi.filter((x) => x.kural_idleri.length);
  paket.tck_yapisi = tckYapisiCikar(tck);
  paket.mevzuat_listesi = kt.mevzuat_tam_metinleri.map((m) => ({
    kaynak_id: m.kaynak_id,
    mevzuat_id: m.mevzuat_id,
    ad: m.ad,
    tur: m.tur,
    mevzuat_numarasi: m.mevzuat_numarasi,
    ilk_yayim: m.ilk_yayim,
    madde_adedi: m.madde_dizini.length,
    metin_sha256: m.metin_sha256,
    dosya: `metin/${m.kaynak_id}.json`,
  }));

  const dosyalar = { 'paket.json': JSON.stringify(paket) };
  for (const m of kt.mevzuat_tam_metinleri) {
    dosyalar[`metin/${m.kaynak_id}.json`] = JSON.stringify(metinDosyasi(m, kt, isaretler.get(m.kaynak_id)));
  }
  return { hatalar: [], dosyalar, ozet: { kural: kt.kurallar.length, dugum: kt.karar_dugumleri.length, secici: kt.makine_secicileri.length, kanit: kt.kural_kanitlari.length, metin: kt.mevzuat_tam_metinleri.length } };
}

function main() {
  const kontrol = process.argv.includes('--kontrol');
  const kaynak = fs.readFileSync(KAYNAK_YOLU, 'utf8');
  const sonuc = derle(kaynak);
  if (sonuc.hatalar.length) {
    console.error(`Kural tabanı doğrulanamadı (${sonuc.hatalar.length} hata):`);
    sonuc.hatalar.slice(0, 50).forEach((h) => console.error('  - ' + h));
    process.exit(1);
  }
  let farkli = 0;
  for (const [ad, icerik] of Object.entries(sonuc.dosyalar)) {
    const yol = path.join(HEDEF_DIZIN, ad);
    if (kontrol) {
      const mevcut = fs.existsSync(yol) ? fs.readFileSync(yol, 'utf8') : null;
      if (mevcut !== icerik) {
        console.error('Güncel değil: ' + path.relative(KOK, yol));
        farkli++;
      }
    } else {
      fs.mkdirSync(path.dirname(yol), { recursive: true });
      fs.writeFileSync(yol, icerik);
    }
  }
  if (kontrol && farkli) {
    console.error('Paketleri yenilemek için: npm run veri');
    process.exit(1);
  }
  const boyut = Object.values(sonuc.dosyalar).reduce((t, x) => t + Buffer.byteLength(x), 0);
  console.log(`${kontrol ? 'Denetlendi' : 'Derlendi'}: ${sonuc.ozet.kural} kural, ${sonuc.ozet.dugum} karar düğümü, ${sonuc.ozet.secici} seçici, ${sonuc.ozet.kanit} kanıt, ${sonuc.ozet.metin} tam metin · ${(boyut / 1048576).toFixed(2)} MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
