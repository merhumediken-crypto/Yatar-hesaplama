// Arayüz bileşim kökü: çalışma paketini yükler, dosyayı (cevapları) tutar, sıradaki
// soruyu ve sonucu çizer, olayları dağıtır. Hukuki mantık çekirdekte; soru sırası
// sorular.js'de, sonuç özeti ozet.js'dedir.

import { hesapla, KuralTabani, MevzuatDeposu, takvim as T } from '../cekirdek/index.js';
import { $, depo, sayfaAc, bildir } from './yardimci.js';
import { bosDosya, dosyaYukle, hesaplanabilir, kapsamDisi, ozelDurum, vakaKur, SURELI_TURLER } from './dosya.js';
import { TEMEL_SORULAR, TUM_SORULAR, soru, sonrakiSoru, cevaplar, cevapla, bilinmiyorCevabi, gosterilenSenaryo } from './sorular.js';
import { sonucOzeti, paylasimMetni, muddetnameKarsilastir } from './ozet.js';
import { gerekceMetni } from './gerekce.js';
import { maddeCoz } from './tck-maddeleri.js';
import { cevaplarCiz, soruCiz, soruDegeri, sonucCiz, mahsupOku, mahsupTaslagi, mahsupHesapMetni, muddetnameTablosu } from './ekran.js';
import { mevzuatKur, aramaYap, maddeGoster, kuralGoster, dayanaklarCiz } from './mevzuat-gorunumu.js';
import { surelerCiz } from './sureler.js';

const DOSYA_ANAHTARI = 'infaz-dosya-v3';
const tamSayfa = new URLSearchParams(location.search).has('tam');
const paylasVar = typeof navigator.share === 'function';

const durum = {
  kt: null,
  dosya: bosDosya(),
  cikti: null,
  talepsiz: null, // aynı dosya, DS talebi olmadan
  ozet: null,
  aktif: null, // ekrandaki soru
  duzenlenen: null, // avukatın değiştirmek için seçtiği soru
  gorunen: null, // karşılaştırmada seçilen senaryo
  acikNeden: null,
  sorgu: '',
  girisTarihli: false,
  mahsupTaslak: null, // mahsup sorusunda düzenlenen satırlar
  uyari: null,
  hesapHatasi: null,
};

const veriYukle = async (dosya) => {
  const yanit = await fetch(`veri/${dosya}`);
  if (!yanit.ok) throw new Error(`${dosya}: ${yanit.status}`);
  return yanit.json();
};

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

function sonucuCiz() {
  durum.ozet = sonucOzeti(durum.kt, durum.dosya, durum.cikti, durum.gorunen, durum.talepsiz);
  if (durum.hesapHatasi) durum.ozet = { durum: 'hesaplanamadi', baslik: 'Hesap hatası', mesaj: durum.hesapHatasi, karsilastirma: [], varsayimlar: [], dikkat: [] };
  const onSonuc = !!durum.aktif && TEMEL_SORULAR.includes(durum.aktif) && !durum.aktif.cevaplandi(durum.dosya);
  const md = durum.dosya.muddetname;
  sonucCiz(durum.ozet, { gorunen: durum.gorunen, acikNeden: durum.acikNeden, paylasVar, onSonuc, md, muddetname: muddetnameKarsilastir(durum.ozet, md) });
}

function siradakiSorular(d) {
  return TUM_SORULAR.filter((s) => s.gorunur(d) && (TEMEL_SORULAR.includes(s) || s.cevaplandi(d)));
}

function soruyuCiz() {
  const d = durum.dosya;
  const s = durum.aktif;
  if (s?.id === 'mahsup' && !durum.mahsupTaslak) {
    durum.mahsupTaslak = d.mahsup?.length ? d.mahsup.map((k) => ({ ...k })) : [{ tur: 'gozalti' }, { tur: 'tutukluluk' }];
  }
  const temel = TEMEL_SORULAR.filter((x) => x.gorunur(d));
  const sira = siradakiSorular(d);
  cevaplarCiz(cevaplar(d), s?.id);
  soruCiz(s, d, {
    sira: s ? temel.indexOf(s) + 1 : 0,
    toplam: temel.length,
    ilerleme: s && temel.includes(s) ? temel.filter((x) => x.cevaplandi(d)).length / temel.length : null,
    geriVar: !!s && sira.indexOf(s) > 0,
    hesaplanabilir: hesaplanabilir(d) && !kapsamDisi(d),
    sorgu: durum.sorgu,
    girisTarihli: durum.girisTarihli,
    mahsupTaslak: durum.mahsupTaslak,
    uyari: durum.uyari,
  });
}

function yenile({ kaydet = true } = {}) {
  hesapYap();
  durum.aktif = durum.duzenlenen ? soru(durum.duzenlenen) : sonrakiSoru(durum.kt, durum.dosya, T.bugunIstanbul(), durum.cikti);
  soruyuCiz();
  sonucuCiz();
  if (kaydet) depo.yaz(DOSYA_ANAHTARI, durum.dosya).catch(() => bildir('Son cevap kaydedilemedi. Bu ekranı kapatmadan önce yeniden deneyin.'));
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
  yenile();
  odakla();
}

function odakla() {
  const girdi = $('soruKarti').querySelector('input:not(.gizli)');
  // Telefonda klavyenin kendiliğinden açılması rahatsız eder; yalnız geniş ekranda.
  if (girdi && matchMedia('(min-width: 720px)').matches) girdi.focus({ preventScroll: true });
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

// ---------------------------------------------------------------------------
// Soru kartı olayları
// ---------------------------------------------------------------------------

function cezaGirdileriniSakla() {
  const s = durum.aktif;
  if (s?.tur !== 'ceza' || s.id !== 'ceza') return;
  const v = soruDegeri({ ...s, tur: 'ceza' }, { ...durum.dosya, ceza_turu: 'sureli_hapis' });
  if (v?.ceza) durum.dosya.ceza = v.ceza;
}

function devam() {
  const s = durum.aktif;
  const d = durum.dosya;
  const deger = soruDegeri(s, d);
  if (deger === null) {
    if (s.tur === 'mahsup') {
      durum.mahsupTaslak = mahsupTaslagi();
      return uyar(mahsupOku().hata);
    }
    uyar({ tarih: 'Geçerli bir tarih girin.', giris: 'Geçerli bir tarih girin.', ceza: 'Ceza süresini girin (yıl, ay veya gün).', mahsup: 'Gün sayılarını tam sayı olarak girin.', fikra: 'Fıkra veya bent girin ya da "Bilmiyorum" deyin.' }[s.tur]);
    return;
  }
  const bugun = T.bugunIstanbul();
  if (s.id === 'suc_tarihi' && T.once(bugun, deger)) return uyar('Suç tarihi bugünden sonra olamaz.');
  if (s.id === 'suc_tarihi' && d.ek.dogum_tarihi && T.once(deger, d.ek.dogum_tarihi)) return uyar('Suç tarihi doğum tarihinden önce olamaz.');
  if (s.id === 'suc_tarihi' && d.giris?.tarih && T.once(d.giris.tarih, deger)) return uyar('Suç tarihi girilmiş giriş tarihinden sonra olamaz.');
  if (s.id === 'dogum_tarihi' && d.suc_tarihi && !T.once(deger, d.suc_tarihi)) return uyar('Doğum tarihi suç tarihinden önce olmalı.');
  if (s.tur === 'giris' && d.suc_tarihi && T.once(deger.tarih, d.suc_tarihi)) return uyar('Giriş tarihi suç tarihinden önce olamaz.');
  if (s.tur === 'giris' && d.konum === 'cezaevinde' && T.once(bugun, deger.tarih)) return uyar('Cezaevine giriş tarihi bugünden sonra olamaz.');
  cevapla(d, s, deger);
  ilerle();
}

function sucSec(suc) {
  const s = soru('suc');
  const yazilan = maddeCoz(durum.sorgu);
  const ayni = yazilan && suc.kanun === 5237 && yazilan.madde === suc.madde;
  cevapla(durum.dosya, s, { fikra: ayni ? yazilan.fikra : null, bent: ayni ? yazilan.bent : null, ...suc });
  ilerle();
}

function soruKartiTiklama(e) {
  const s = durum.aktif;
  if (!s) return;
  const d = durum.dosya;
  const hedef = e.target.closest('button');
  if (!hedef) return;
  const ds = hedef.dataset;
  if (ds.secim !== undefined) {
    cevapla(d, s, s.secenekler(d)[Number(ds.secim)].deger);
    return ilerle();
  }
  if (ds.eylem === 'devam') return devam();
  if (ds.eylem === 'bilmiyorum') {
    bilinmiyorCevabi(d, s.id);
    return ilerle();
  }
  if (ds.eylem === 'geri') {
    const sira = siradakiSorular(d);
    const onceki = sira[sira.indexOf(s) - 1];
    if (onceki) {
      durum.duzenlenen = onceki.id;
      durum.uyari = null;
      yenile({ kaydet: false });
    }
    return;
  }
  if (ds.cezaTuru) {
    cezaGirdileriniSakla();
    d.ceza_turu = ds.cezaTuru;
    if (!SURELI_TURLER.includes(d.ceza_turu)) d.ceza = null;
    return soruyuCiz();
  }
  if (ds.suc) {
    const [kanun, madde] = ds.suc.split('|');
    return sucSec({ kanun: Number(kanun), madde });
  }
  if (ds.sucSerbest) {
    const m = maddeCoz(durum.sorgu);
    if (m) {
      cevapla(d, soru('suc'), { kanun: 5237, ...m });
      ilerle();
    }
    return;
  }
  if (ds.sucKanun) {
    const kanun = Number($('s_kanun').value);
    const m = maddeCoz($('s_madde').value);
    if (!Number.isInteger(kanun) || kanun <= 0 || !m) return uyar('Kanun numarasını ve maddeyi girin.');
    cevapla(d, soru('suc'), { kanun, ...m });
    return ilerle();
  }
  if (ds.ozel) {
    d.ozel[ds.ozel] = !ozelDurum(d)[ds.ozel];
    return yenile();
  }
  if (ds.giris === 'bugun') {
    cevapla(d, s, { tur: 'bugun' });
    return ilerle();
  }
  if (ds.giris === 'tarih') {
    durum.girisTarihli = true;
    soruyuCiz();
    $('s_tarih')?.focus();
    return;
  }
  if (ds.mahsupYok) {
    cevapla(d, s, []);
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
  Object.assign(durum, { dosya: bosDosya(), duzenlenen: null, gorunen: null, acikNeden: null, sorgu: '', girisTarihli: false, uyari: null });
  sekmeAc('hesap');
  yenile();
}

function olaylariBagla() {
  $('soruKarti').addEventListener('click', soruKartiTiklama);
  $('soruKarti').addEventListener('input', soruKartiGirdi);
  $('soruKarti').addEventListener('keydown', soruKartiTus);
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
  $('cevaplar').addEventListener('click', (e) => {
    const c = e.target.closest('[data-duzenle]');
    if (!c) return;
    durum.duzenlenen = c.dataset.duzenle;
    durum.sorgu = '';
    durum.uyari = null;
    yenile({ kaydet: false });
    $('soruKarti').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    odakla();
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
