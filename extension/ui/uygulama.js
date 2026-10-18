// Arayüz bileşim kökü: çalışma paketini yükler, dosyayı (cevapları) tutar, sıradaki
// soruyu, belge panelini ve sonucu çizer, olayları dağıtır. Hukuki mantık çekirdekte;
// soru sırası sorular.js'de, belge aktarımı belge-aktar.js'de, sonuç özeti ozet.js'dedir.
//
// Ekrandaki soru bir "soru örneği"dir: { s: soru, i: ilam sırası (dosya sorusunda null),
// g: o ilamın görünümü }. Cevaplar her zaman görünüme yazılır; görünüm alanı dosyaya ya da
// ilama yönlendirir (dosya.js → ilamGorunumu).

import { belgeOku, dosyaMetni, BelgeHatasi, hesapla, KuralTabani, MevzuatDeposu, takvim as T } from '../cekirdek/index.js';
import { $, depo, sayfaAc, bildir } from './yardimci.js';
import { bosDosya, cezaVar, cokluMu, dosyaYukle, hesaplanabilir, ilamAdi, ilamEkle, ilamSil, kapsamDisi, ozelDurum, vakaKur, SURELI_TURLER } from './dosya.js';
import { TEMEL_SORULAR, ayniOrnek, bilinmiyorCevabi, cevapGruplari, cevapla, gorunenSira, gorunum, gosterilenSenaryo, soru, sonrakiSoru, temelSira } from './sorular.js';
import { belgeyiAktar } from './belge-aktar.js';
import { sonucOzeti, paylasimMetni, muddetnameKarsilastir } from './ozet.js';
import { gerekceMetni } from './gerekce.js';
import { maddeCoz } from './tck-maddeleri.js';
import { belgeKartiCiz, cevaplarCiz, soruCiz, soruDegeri, sonucCiz, mahsupOku, mahsupTaslagi, mahsupHesapMetni, muddetnameTablosu } from './ekran.js';
import { mevzuatKur, aramaYap, maddeGoster, kuralGoster, dayanaklarCiz } from './mevzuat-gorunumu.js';
import { surelerCiz } from './sureler.js';

// Anahtar sürüm 3'ten kalmadır; içerik sürüm 4'tür. Anahtar değişirse güncellemede
// kayıtlı dosya kaybolur; dosyaYukle eski içeriği yeni biçime çevirir.
const DOSYA_ANAHTARI = 'infaz-dosya-v3';
const ILAM_SINIRI = 40;
const BELGE_BOYUT_SINIRI = 25 * 1024 * 1024;
const tamSayfa = new URLSearchParams(location.search).has('tam');
const paylasVar = typeof navigator.share === 'function';

// Belge paneli: metin yalnız bellekte tutulur, kaydedilmez (kişisel veri).
const bosBelge = (acik = false) => ({ acik, metin: '', okuma: null, hata: null, sonuc: null, okunuyor: false });

const durum = {
  kt: null,
  dosya: bosDosya(),
  cikti: null,
  talepsiz: null, // aynı dosya, DS talebi olmadan
  ozet: null,
  aktif: null, // ekrandaki soru örneği { s, i, g }
  duzenlenen: null, // avukatın değiştirmek için seçtiği soru { id, i }
  gorunen: null, // karşılaştırmada seçilen senaryo (tek ilam)
  acikNeden: null,
  sorgu: '',
  girisTarihli: false,
  mahsupTaslak: null, // mahsup sorusunda düzenlenen satırlar
  uyari: null,
  hesapHatasi: null,
  belge: bosBelge(),
  acikIlamlar: new Set(), // avukatın açtığı ilam grupları (soru sorulan ilam her zaman açık)
};

const veriYukle = async (dosya) => {
  const yanit = await fetch(`veri/${dosya}`);
  if (!yanit.ok) throw new Error(`${dosya}: ${yanit.status}`);
  return yanit.json();
};

const tr = (s) => (s ? T.trTarih(s) : '');
const genisEkran = () => matchMedia('(min-width: 720px)').matches;
const kaydir = (el) => el?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

// ---------------------------------------------------------------------------
// Hesap ve çizim
// ---------------------------------------------------------------------------

function hesapYap() {
  const d = durum.dosya;
  durum.cikti = null;
  durum.talepsiz = null;
  durum.hesapHatasi = null;
  if (hesaplanabilir(d)) {
    try {
      durum.cikti = hesapla(durum.kt, vakaKur(d, T.bugunIstanbul()));
      durum.talepsiz = hesapla(durum.kt, vakaKur(d, T.bugunIstanbul(), { dsTalebi: false }));
    } catch (hata) {
      console.error(hata);
      durum.cikti = null;
      durum.talepsiz = null;
      durum.hesapHatasi = `Hesap oluşturulamadı: ${hata.message}. Girilen bilgileri kontrol edin.`;
    }
  }
}

// Düzenlenen soru (silinmiş bir ilama aitse düzenleme biter) ya da sıradaki soru.
function aktifSoru() {
  const d = durum.dosya;
  const e = durum.duzenlenen;
  if (e) {
    const s = soru(e.id);
    if (s && (e.i === null || e.i < d.ilamlar.length)) return { s, i: e.i, g: gorunum(d, e.i) };
    durum.duzenlenen = null;
  }
  return sonrakiSoru(durum.kt, d, T.bugunIstanbul(), durum.cikti);
}

function sonucuCiz() {
  durum.ozet = sonucOzeti(durum.kt, durum.dosya, durum.cikti, durum.gorunen, durum.talepsiz);
  if (durum.hesapHatasi) durum.ozet = { durum: 'hesaplanamadi', baslik: 'Hesap hatası', mesaj: durum.hesapHatasi, karsilastirma: [], varsayimlar: [], dikkat: [] };
  const o = durum.aktif;
  const onSonuc = !!o && TEMEL_SORULAR.includes(o.s) && !o.s.cevaplandi(o.g);
  const md = durum.dosya.muddetname;
  sonucCiz(durum.ozet, { gorunen: durum.gorunen, acikNeden: durum.acikNeden, paylasVar, onSonuc, md, muddetname: muddetnameKarsilastir(durum.ozet, md) });
}

// Birden çok ilamda soru kartının üstündeki ilam başlığı.
function ilamBaglami(d, o) {
  if (!o || o.i === null || !cokluMu(d)) return null;
  const il = d.ilamlar[o.i];
  const ceza = cezaVar(il.ceza) ? T.cezaMetni(il.ceza) : { muebbet: 'Müebbet', agirlastirilmis_muebbet: 'Ağırlaştırılmış müebbet' }[il.ceza_turu];
  return {
    no: o.i + 1,
    toplam: d.ilamlar.length,
    ad: il.meta?.etiket || 'Elle eklenen ilam',
    alt: [ceza, il.meta?.karar_tarihi && `hüküm ${tr(il.meta.karar_tarihi)}`, il.meta?.suc_adi].filter(Boolean).join(' · '),
  };
}

// Aynı hükümden (aynı esas ve karar numarası) başka bir ilamın suç tarihi tek dokunuşla önerilir.
function ayniTarihOnerisi(d, o) {
  if (o?.s.id !== 'suc_tarihi' || o.i === null || !cokluMu(d)) return null;
  const m = d.ilamlar[o.i].meta || {};
  if (!m.esas_no) return null;
  const j = d.ilamlar.findIndex((il, n) => n !== o.i && il.suc_tarihi && il.meta?.esas_no === m.esas_no && (il.meta?.karar_no || null) === (m.karar_no || null));
  return j < 0 ? null : { tarih: d.ilamlar[j].suc_tarihi, ad: `${j + 1}. ilam` };
}

// Tek ilamda "başka ilam ekle" sorular bitince görünür; soru akışını bölmez.
const ilamEklenebilir = (d) => d.ilamlar.length < ILAM_SINIRI && (cokluMu(d) || (hesaplanabilir(d) && !durum.aktif));

// Yalnız cevap listesi (soru kartındaki yazılmış değerler kaybolmasın).
function cevaplariCiz() {
  cevaplarCiz(cevapGruplari(durum.dosya), durum.aktif, { ilamEkle: ilamEklenebilir(durum.dosya), acikIlamlar: durum.acikIlamlar });
}

function soruyuCiz() {
  const d = durum.dosya;
  const o = durum.aktif;
  if (o?.s.id === 'mahsup' && !durum.mahsupTaslak) {
    durum.mahsupTaslak = o.g.mahsup?.length ? o.g.mahsup.map((k) => ({ ...k })) : [{ tur: 'gozalti' }, { tur: 'tutukluluk' }];
  }
  const temel = temelSira(d).filter((x) => x.s.gorunur(gorunum(d, x.i)));
  const sira = gorunenSira(d);
  const temelde = o ? temel.findIndex((x) => ayniOrnek(x, o)) : -1;
  const sirada = o ? sira.findIndex((x) => ayniOrnek(x, o)) : -1;
  cevaplariCiz();
  soruCiz(o, {
    sira: temelde + 1,
    toplam: temel.length,
    ilerleme: temelde >= 0 ? temel.filter((x) => x.s.cevaplandi(gorunum(d, x.i))).length / temel.length : null,
    // Cevaplanmamış ek sorudan geri: son cevaplanan soruya.
    geriVar: !!o && (sirada > 0 || (sirada < 0 && sira.length > 0)),
    hesaplanabilir: hesaplanabilir(d) && !kapsamDisi(d),
    coklu: cokluMu(d),
    sorgu: durum.sorgu,
    girisTarihli: durum.girisTarihli,
    mahsupTaslak: durum.mahsupTaslak,
    uyari: durum.uyari,
    ilamBaglam: ilamBaglami(d, o),
    ayniTarih: ayniTarihOnerisi(d, o),
  });
}

// Belge paneli. "Mevcut dosya": elle ya da belgeden girilmiş en az bir ilam bilgisi.
function belgeyiCiz() {
  const d = durum.dosya;
  const mevcutVar = d.ilamlar.length > 1 || d.ilamlar.some((il) => il.ceza || il.suc_tarihi || il.suc || il.meta?.esas_no);
  belgeKartiCiz({ ...durum.belge, mevcutVar, ozet: d.belge });
}

function kaydet() {
  depo.yaz(DOSYA_ANAHTARI, durum.dosya).catch(() => bildir('Son cevap kaydedilemedi. Bu ekranı kapatmadan önce yeniden deneyin.'));
}

function yenile({ kaydet: kalici = true } = {}) {
  hesapYap();
  durum.aktif = aktifSoru();
  soruyuCiz();
  belgeyiCiz();
  sonucuCiz();
  if (kalici) kaydet();
  if (!$('ekran-mevzuat').classList.contains('gizli')) dayanaklarCiz(durum.cikti);
}

// Bir cevap verildi: düzenleme biter, sıradaki soruya geçilir.
function ilerle() {
  durum.duzenlenen = null;
  durum.sorgu = '';
  durum.girisTarihli = false;
  durum.mahsupTaslak = null;
  durum.uyari = null;
  durum.gorunen = null;
  const onceki = durum.aktif;
  yenile();
  // Başka ilama geçildiyse kart görünür olsun (uzun cevap listesinde telefon).
  if (onceki && durum.aktif && onceki.i !== durum.aktif.i && cokluMu(durum.dosya)) kaydir($('soruKarti'));
  odakla();
}

function odakla() {
  const girdi = $('soruKarti').querySelector('input:not(.gizli)');
  // Telefonda klavyenin kendiliğinden açılması rahatsız eder; yalnız geniş ekranda.
  if (girdi && genisEkran()) girdi.focus({ preventScroll: true });
}

function uyar(metin) {
  durum.uyari = metin;
  soruyuCiz();
  const kart = $('soruKarti');
  kart.classList.remove('salla');
  void kart.offsetWidth;
  kart.classList.add('salla');
  if (!kart.querySelector('.uyari')) bildir(metin);
}

function duzenle(id, i) {
  durum.duzenlenen = { id, i };
  durum.sorgu = '';
  durum.uyari = null;
  durum.mahsupTaslak = null;
  durum.girisTarihli = false;
  yenile({ kaydet: false });
}

// ---------------------------------------------------------------------------
// Soru kartı olayları
// ---------------------------------------------------------------------------

// Ceza türü değişirken yazılmış yıl/ay/gün kaybolmasın.
function cezaGirdileriniSakla() {
  const o = durum.aktif;
  if (o?.s.id !== 'ceza') return;
  const v = soruDegeri(o.s, { ceza_turu: 'sureli_hapis', giris: o.g.giris });
  if (v?.ceza) o.g.ceza = v.ceza;
}

// Birden çok ilamda en geç ve en erken suç tarihi (giriş ve doğum tarihi denetimi için).
const sucTarihleri = (d) => d.ilamlar.map((il) => il.suc_tarihi).filter(Boolean).sort();

function devam() {
  const { s, g } = durum.aktif;
  const d = durum.dosya;
  const deger = soruDegeri(s, g);
  if (deger === null) {
    if (s.tur === 'mahsup') {
      durum.mahsupTaslak = mahsupTaslagi();
      return uyar(mahsupOku().hata);
    }
    uyar({ tarih: 'Geçerli bir tarih girin.', giris: 'Geçerli bir tarih girin.', ceza: 'Ceza süresini girin (yıl, ay veya gün).', mahsup: 'Gün sayılarını tam sayı olarak girin.', fikra: 'Fıkra veya bent girin ya da "Bilmiyorum" deyin.' }[s.tur]);
    return;
  }
  const bugun = T.bugunIstanbul();
  const tarihler = sucTarihleri(d);
  if (s.id === 'suc_tarihi') {
    if (T.once(bugun, deger)) return uyar('Suç tarihi bugünden sonra olamaz.');
    if (g.meta?.karar_tarihi && T.once(g.meta.karar_tarihi, deger)) return uyar(`Suç tarihi hüküm tarihinden (${tr(g.meta.karar_tarihi)}) sonra olamaz.`);
    if (d.ek.dogum_tarihi && T.once(deger, d.ek.dogum_tarihi)) return uyar('Suç tarihi doğum tarihinden önce olamaz.');
    if (d.giris?.tarih && T.once(d.giris.tarih, deger)) return uyar('Suç tarihi girilmiş giriş tarihinden sonra olamaz.');
  }
  if (s.id === 'dogum_tarihi' && tarihler.length && !T.once(deger, tarihler[0])) return uyar('Doğum tarihi suç tarihinden önce olmalı.');
  if (s.tur === 'giris' && tarihler.length && T.once(deger.tarih, tarihler.at(-1))) return uyar(`Giriş tarihi suç tarihinden (${tr(tarihler.at(-1))}) önce olamaz.`);
  if (s.tur === 'giris' && d.konum === 'cezaevinde' && T.once(bugun, deger.tarih)) return uyar('Cezaevine giriş tarihi bugünden sonra olamaz.');
  cevapla(g, s, deger);
  ilerle();
}

function sucSec(suc) {
  const yazilan = maddeCoz(durum.sorgu);
  const ayni = yazilan && suc.kanun === 5237 && yazilan.madde === suc.madde;
  cevapla(durum.aktif.g, soru('suc'), { fikra: ayni ? yazilan.fikra : null, bent: ayni ? yazilan.bent : null, ...suc });
  ilerle();
}

function soruKartiTiklama(e) {
  const o = durum.aktif;
  if (!o) return;
  const { s, g } = o;
  const hedef = e.target.closest('button');
  if (!hedef) return;
  const ds = hedef.dataset;
  if (ds.secim !== undefined) {
    cevapla(g, s, s.secenekler(g)[Number(ds.secim)].deger);
    return ilerle();
  }
  if (ds.eylem === 'devam') return devam();
  if (ds.eylem === 'bilmiyorum') {
    bilinmiyorCevabi(g, s.id);
    return ilerle();
  }
  if (ds.eylem === 'geri') {
    const sira = gorunenSira(durum.dosya);
    const n = sira.findIndex((x) => ayniOrnek(x, o));
    const onceki = n > 0 ? sira[n - 1] : n < 0 ? sira.at(-1) : null;
    if (onceki) duzenle(onceki.s.id, onceki.i);
    return;
  }
  if (ds.tarihHizli) {
    cevapla(g, s, ds.tarihHizli);
    return ilerle();
  }
  if (ds.cezaTuru) {
    cezaGirdileriniSakla();
    g.ceza_turu = ds.cezaTuru;
    if (!SURELI_TURLER.includes(g.ceza_turu)) g.ceza = null;
    return soruyuCiz();
  }
  if (ds.sucOneri !== undefined) {
    const oneri = g.meta?.madde_onerileri?.[Number(ds.sucOneri)];
    if (oneri) {
      cevapla(g, soru('suc'), { ...oneri });
      ilerle();
    }
    return;
  }
  if (ds.suc) {
    const [kanun, madde] = ds.suc.split('|');
    return sucSec({ kanun: Number(kanun), madde });
  }
  if (ds.sucSerbest) {
    const m = maddeCoz(durum.sorgu);
    if (m) {
      cevapla(g, soru('suc'), { kanun: 5237, ...m });
      ilerle();
    }
    return;
  }
  if (ds.sucKanun) {
    const kanun = Number($('s_kanun').value);
    const m = maddeCoz($('s_madde').value);
    if (!Number.isInteger(kanun) || kanun <= 0 || !m) return uyar('Kanun numarasını ve maddeyi girin.');
    cevapla(g, soru('suc'), { kanun, ...m });
    return ilerle();
  }
  if (ds.ozel) {
    g.ozel[ds.ozel] = !ozelDurum(g)[ds.ozel];
    return yenile();
  }
  if (ds.giris === 'bugun') {
    cevapla(g, s, { tur: 'bugun' });
    return ilerle();
  }
  if (ds.giris === 'tarih') {
    durum.girisTarihli = true;
    soruyuCiz();
    $('s_tarih')?.focus();
    return;
  }
  if (ds.mahsupYok) {
    cevapla(g, s, []);
    return ilerle();
  }
  if (ds.mahsupEkle) {
    durum.mahsupTaslak = [...mahsupTaslagi(), { tur: 'tutukluluk' }];
    return soruyuCiz();
  }
  if (ds.mahsupSil !== undefined) {
    durum.mahsupTaslak = mahsupTaslagi().filter((_, i) => i !== Number(ds.mahsupSil));
    return soruyuCiz();
  }
}

function soruKartiGirdi(e) {
  const satir = e.target.closest('.mahsup-satir');
  if (satir) {
    // Yalnız satırın hesap metni güncellenir; odak kaybolmasın diye kart yeniden çizilmez.
    durum.mahsupTaslak = mahsupTaslagi();
    satir.querySelector('.mahsup-hesap').textContent = mahsupHesapMetni(durum.mahsupTaslak[Number(satir.dataset.satir)]);
    return;
  }
  if (e.target.id !== 's_ara') return;
  durum.sorgu = e.target.value;
  const konum = e.target.selectionStart;
  soruyuCiz();
  const ara = $('s_ara');
  ara.focus();
  ara.setSelectionRange(konum, konum);
}

function soruKartiTus(e) {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  e.preventDefault();
  if (e.target.id === 's_ara') {
    $('soruKarti').querySelector('[data-suc], [data-suc-serbest]')?.click();
  } else if (e.target.closest('.baska-kanun')) {
    $('soruKarti').querySelector('[data-suc-kanun]')?.click();
  } else devam();
}

// ---------------------------------------------------------------------------
// Cevaplar ve ilamlar
// ---------------------------------------------------------------------------

// İki dokunuşla onay: ilk dokunuş düğmeyi uyarıya çevirir, 3 sn içinde ikincisi işlemi yapar.
function onayIste(dugme, metin, eski) {
  if (dugme.classList.contains('onay')) return true;
  dugme.classList.add('onay');
  dugme.textContent = metin;
  setTimeout(() => {
    if (!dugme.isConnected) return;
    dugme.classList.remove('onay');
    dugme.textContent = eski;
  }, 3000);
  return false;
}

function ilamiCikar(i) {
  const d = durum.dosya;
  if (d.ilamlar.length <= 1) return;
  const ad = ilamAdi(d, i);
  ilamSil(d, i);
  durum.acikIlamlar.clear();
  const e = durum.duzenlenen;
  if (e?.i !== null && e?.i !== undefined) durum.duzenlenen = e.i === i ? null : e.i > i ? { ...e, i: e.i - 1 } : e;
  durum.mahsupTaslak = null;
  durum.uyari = null;
  yenile();
  bildir(`${ad} dosyadan çıkarıldı`);
}

function cevaplarTiklama(e) {
  const sil = e.target.closest('[data-ilam-sil]');
  if (sil) {
    e.preventDefault(); // özet satırındaki düğme grubu açıp kapamasın
    if (onayIste(sil, 'Çıkar?', '✕')) ilamiCikar(Number(sil.dataset.ilamSil));
    return;
  }
  // İlam grubu başlığı: açık/kapalı durumu yeniden çizimlerde korunsun diye durumdan yönetilir.
  const baslik = e.target.closest('summary.ilam-grup-ust');
  if (baslik) {
    e.preventDefault();
    const i = Number(baslik.parentElement.dataset.ilamGrup);
    if (durum.aktif?.i === i) return;
    if (durum.acikIlamlar.has(i)) durum.acikIlamlar.delete(i);
    else durum.acikIlamlar.add(i);
    cevaplariCiz();
    $('cevaplar').querySelector(`[data-ilam-grup="${i}"] > summary`)?.focus({ preventScroll: true });
    return;
  }
  if (e.target.closest('[data-ilam-ekle]')) {
    const d = durum.dosya;
    const i = ilamEkle(d);
    durum.duzenlenen = null;
    durum.mahsupTaslak = null;
    durum.uyari = null;
    yenile();
    bildir(`${i + 1}. ilam eklendi; bilgilerini sırayla girin`);
    kaydir($('soruKarti'));
    odakla();
    return;
  }
  const c = e.target.closest('[data-duzenle]');
  if (!c) return;
  duzenle(c.dataset.duzenle, c.dataset.ilam !== undefined ? Number(c.dataset.ilam) : null);
  kaydir($('soruKarti'));
  odakla();
}

// ---------------------------------------------------------------------------
// Belgeden okuma
// ---------------------------------------------------------------------------

function belgeMetniOku(metin) {
  const b = durum.belge;
  b.metin = metin;
  if (!metin.trim()) {
    b.hata = 'Önce belge metnini yapıştırın ya da bir dosya seçin.';
    b.okuma = null;
    return;
  }
  try {
    b.okuma = belgeOku(metin);
    b.hata = null;
  } catch (hata) {
    console.error(hata);
    b.okuma = null;
    b.hata = 'Metin okunamadı. Belgenin tamamını kopyaladığınızdan emin olun.';
  }
}

async function belgeDosyasiSec(dosya) {
  const b = durum.belge;
  if (dosya.size > BELGE_BOYUT_SINIRI) {
    b.hata = 'Dosya çok büyük. Belgenin metnini kopyalayıp yapıştırın.';
    return belgeyiCiz();
  }
  b.okunuyor = true;
  b.hata = null;
  belgeyiCiz();
  try {
    const { metin } = await dosyaMetni(dosya);
    belgeMetniOku(metin);
  } catch (hata) {
    if (!(hata instanceof BelgeHatasi)) console.error(hata);
    b.okuma = null;
    b.hata = hata instanceof BelgeHatasi ? hata.message : 'Dosya okunamadı. Belge metnini kopyalayıp yapıştırın.';
  } finally {
    b.okunuyor = false;
  }
  belgeyiCiz();
}

function belgeyiUygula(mod) {
  const b = durum.belge;
  if (!b.okuma) return;
  const sonuc = belgeyiAktar(durum.dosya, b.okuma, { mod });
  durum.dosya = sonuc.dosya;
  Object.assign(durum.belge, { okuma: null, metin: '', hata: null, sonuc });
  Object.assign(durum, { duzenlenen: null, gorunen: null, acikNeden: null, sorgu: '', girisTarihli: false, mahsupTaslak: null, uyari: null, acikIlamlar: new Set() });
  yenile();
  kaydir($('belgeKarti'));
}

function belgeKartiTiklama(e) {
  const dugme = e.target.closest('button[data-belge]');
  if (!dugme) return;
  const b = durum.belge;
  switch (dugme.dataset.belge) {
    case 'ac':
      b.acik = true;
      belgeyiCiz();
      if (genisEkran()) $('belgeMetni')?.focus({ preventScroll: true });
      return;
    case 'kapat':
      if (b.sonuc) {
        durum.belge = bosBelge();
        belgeyiCiz();
        kaydir($('soruKarti'));
        odakla();
      } else {
        b.acik = false;
        belgeyiCiz();
      }
      return;
    case 'baska':
      durum.belge = bosBelge(true);
      return belgeyiCiz();
    case 'oku':
      belgeMetniOku($('belgeMetni')?.value || '');
      belgeyiCiz();
      kaydir($('belgeKarti'));
      return;
    case 'geri':
      b.okuma = null;
      return belgeyiCiz();
    case 'birlestir':
      return belgeyiUygula('birlestir');
    case 'yeni':
      // Mevcut cevaplar silinir: iki dokunuşla onay.
      if (onayIste(dugme, 'Emin misiniz? Mevcut cevaplar silinir', 'Yeni dosya başlat')) belgeyiUygula('yeni');
      return;
  }
}

// ---------------------------------------------------------------------------
// Sonuç ve genel olaylar
// ---------------------------------------------------------------------------

async function kopyala(metin = paylasimMetni(durum.dosya, durum.ozet), mesaj = 'Sonuç kopyalandı') {
  try {
    await navigator.clipboard.writeText(metin);
  } catch {
    const odak = document.activeElement;
    const ta = document.createElement('textarea');
    ta.value = metin;
    ta.className = 'kopya-gecici';
    ta.setAttribute('aria-label', 'Kopyalanacak metin');
    document.body.appendChild(ta);
    ta.select();
    let basarili = false;
    try { basarili = document.execCommand('copy'); } catch { /* bildir */ }
    finally { ta.remove(); odak?.focus({ preventScroll: true }); }
    if (!basarili) return bildir('Metin kopyalanamadı. Panoya erişimi kontrol edip yeniden deneyin.');
  }
  bildir(mesaj);
}

async function paylas() {
  try {
    await navigator.share({ title: 'İnfaz hesabı', text: paylasimMetni(durum.dosya, durum.ozet) });
  } catch (h) {
    if (h.name !== 'AbortError') kopyala();
  }
}

function sonucTiklama(e) {
  const hedef = e.target.closest('button');
  if (!hedef) return;
  const ds = hedef.dataset;
  if (ds.neden) {
    durum.acikNeden = durum.acikNeden === ds.neden ? null : ds.neden;
    sonucuCiz();
    $('sonuc').querySelector(`[data-neden="${ds.neden}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (ds.senaryo) {
    const kendi = gosterilenSenaryo(durum.dosya);
    durum.gorunen = ds.senaryo === kendi || ds.senaryo === durum.gorunen ? null : ds.senaryo;
    durum.acikNeden = null;
    sonucuCiz();
    $('sonuc').querySelector(`[data-senaryo="${ds.senaryo}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (ds.gerekceAc) {
    const detay = document.getElementById(`gerekce-${ds.gerekceAc}`);
    if (!detay) return;
    detay.open = true;
    detay.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    detay.querySelector('summary').focus({ preventScroll: true });
    return;
  }
  if (ds.eylem === 'gerekce-kopyala') return kopyala(gerekceMetni(durum.ozet), 'Gerekçeli metin kopyalandı');
  if (ds.eylem === 'kopyala') return kopyala();
  if (ds.eylem === 'paylas') return paylas();
}

function sekmeAc(ad) {
  for (const s of document.querySelectorAll('.sekmeler [role="tab"]')) {
    const aktif = s.id === `sekme-${ad}`;
    s.setAttribute('aria-selected', String(aktif));
    s.tabIndex = aktif ? 0 : -1;
    $(s.getAttribute('aria-controls')).classList.toggle('gizli', !aktif);
  }
  if (ad === 'mevzuat') {
    dayanaklarCiz(durum.cikti);
    if (!$('mevzuatSonuc').children.length) aramaYap();
  }
  if (ad === 'sureler') surelerCiz(durum.kt);
  window.scrollTo({ top: 0 });
}

let yeniOnayZamanlayici = null;
function yeniHesap() {
  const dugme = $('yeniHesap');
  if (!dugme.classList.contains('onay')) {
    dugme.classList.add('onay');
    dugme.querySelector('span').textContent = 'Emin misiniz?';
    yeniOnayZamanlayici = setTimeout(() => {
      dugme.classList.remove('onay');
      dugme.querySelector('span').textContent = 'Yeni';
    }, 3000);
    return;
  }
  clearTimeout(yeniOnayZamanlayici);
  dugme.classList.remove('onay');
  dugme.querySelector('span').textContent = 'Yeni';
  Object.assign(durum, { dosya: bosDosya(), duzenlenen: null, gorunen: null, acikNeden: null, sorgu: '', girisTarihli: false, mahsupTaslak: null, uyari: null, belge: bosBelge(), acikIlamlar: new Set() });
  sekmeAc('hesap');
  yenile();
}

function olaylariBagla() {
  $('soruKarti').addEventListener('click', soruKartiTiklama);
  $('soruKarti').addEventListener('input', soruKartiGirdi);
  $('soruKarti').addEventListener('keydown', soruKartiTus);
  $('cevaplar').addEventListener('click', cevaplarTiklama);
  $('belgeKarti').addEventListener('click', belgeKartiTiklama);
  // Yapıştırılan metin yeniden çizimde kaybolmasın (yalnız bellekte).
  $('belgeKarti').addEventListener('input', (e) => {
    if (e.target.id === 'belgeMetni') durum.belge.metin = e.target.value;
  });
  $('belgeKarti').addEventListener('keydown', (e) => {
    if (e.target.id === 'belgeMetni' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      $('belgeKarti').querySelector('[data-belge="oku"]')?.click();
    }
  });
  $('belgeKarti').addEventListener('change', (e) => {
    if (e.target.id !== 'belgeDosyasi') return;
    const dosya = e.target.files?.[0];
    if (dosya) belgeDosyasiSec(dosya);
  });
  $('sonuc').addEventListener('click', sonucTiklama);
  // Müddetname tarihleri: yalnız tablo yeniden çizilir (odak korunur).
  $('sonuc').addEventListener('input', (e) => {
    const id = e.target.dataset.md;
    if (!id) return;
    const v = e.target.value;
    if (v && !T.gecerliTarih(v)) return;
    if (v) durum.dosya.muddetname[id] = v;
    else delete durum.dosya.muddetname[id];
    depo.yaz(DOSYA_ANAHTARI, durum.dosya).catch(() => bildir('Müddetname karşılaştırması kaydedilemedi.'));
    $('mdTablo').innerHTML = muddetnameTablosu(muddetnameKarsilastir(durum.ozet, durum.dosya.muddetname));
  });
  document.querySelector('.sekmeler').addEventListener('click', (e) => {
    const s = e.target.closest('[role="tab"]');
    if (s) sekmeAc(s.id.replace('sekme-', ''));
  });
  document.querySelector('.sekmeler').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const sekmeler = [...document.querySelectorAll('.sekmeler [role="tab"]')];
    const i = sekmeler.indexOf(e.target);
    if (i < 0) return;
    e.preventDefault();
    const yeni = e.key === 'Home' ? 0 : e.key === 'End' ? sekmeler.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + sekmeler.length) % sekmeler.length;
    sekmeler[yeni].click();
    sekmeler[yeni].focus();
  });
  // Madde ve kural bağlantıları (sonuç, mevzuat ve süreler ekranlarında)
  document.addEventListener('click', (e) => {
    const madde = e.target.closest('button[data-madde]');
    if (madde) {
      sekmeAc('mevzuat');
      maddeGoster(madde.dataset.madde);
      return;
    }
    const kural = e.target.closest('[data-kural]');
    if (kural) {
      sekmeAc('mevzuat');
      kuralGoster(kural.dataset.kural);
    }
  });
  $('yeniHesap').addEventListener('click', yeniHesap);
  $('tamEkran').addEventListener('click', async () => {
    try {
      await depo.yaz(DOSYA_ANAHTARI, durum.dosya);
      sayfaAc('tam=1');
    } catch { bildir('Son cevap kaydedilemedi; tam sayfa açılmadı.'); }
  });
  $('mevzuatSec').addEventListener('change', aramaYap);
  let aramaZamanlayici;
  $('mevzuatAra').addEventListener('input', () => {
    clearTimeout(aramaZamanlayici);
    aramaZamanlayici = setTimeout(aramaYap, 200);
  });
  $('ekran-sureler').addEventListener('input', () => surelerCiz(durum.kt));
}

async function baslat() {
  // Lemur geniş bir açılır pencere açabilir; genişlik sekmede olduğumuzu kanıtlamaz.
  if (tamSayfa) $('tamEkran').classList.add('gizli');
  document.body.classList.toggle('tam', tamSayfa || innerWidth > 560);
  try {
    durum.kt = new KuralTabani(await veriYukle('paket.json'));
  } catch (hata) {
    return baslatmaHatasi('Kural tabanı yüklenemedi. Eklenti dosyalarının eksiksiz olduğundan emin olup yeniden deneyin.');
  }
  const k = durum.kt;
  $('paketBilgi').textContent = `Kural tabanı ${k.surum} · ${k.mevzuatListesi.length} tam metin · hesap cihazda yapılır`;
  $('paketBilgi').title = `Kaynak SHA-256: ${k.sha256}`;
  mevzuatKur(k, new MevzuatDeposu(k, veriYukle));
  try {
    durum.dosya = dosyaYukle(await depo.oku(DOSYA_ANAHTARI));
  } catch {
    return baslatmaHatasi('Kayıtlı dosya okunamadı. Verilerin üzerine yazılmaması için hesap başlatılmadı. Yeniden deneyin.');
  }
  olaylariBagla();
  yenile({ kaydet: false });
  document.body.classList.add('hazir');
}

function baslatmaHatasi(mesaj) {
  $('soruKarti').innerHTML = '<h2>Çalışma alanı açılamadı</h2><p class="uyari" role="alert"></p><button type="button" class="dugme ana" id="yenidenDene">Yeniden dene</button>';
  $('soruKarti').querySelector('.uyari').textContent = mesaj;
  $('paketBilgi').textContent = mesaj;
  $('yenidenDene').addEventListener('click', () => location.reload());
  document.body.classList.add('hazir');
}

baslat();
