// Arayüz bileşim kökü: çalışma paketini yükler, çekirdeği ve görünümleri bağlar,
// olayları dağıtır. Hukuki mantık içermez; tamamı extension/cekirdek'tedir.

import { hesapla, ozetMetni, KuralTabani, MevzuatDeposu, takvim as T } from '../cekirdek/index.js';
import { TCK_MADDELERI } from './tck-maddeleri.js';
import { $, esc, depo, sayfaAc, bildir, dosyaIndir } from './yardimci.js';
import { vakaOku, vakadanForm, formDurumu, formuDoldur, formuSifirla, maddeAyristir } from './form.js';
import { gorunumKur, hesapCiz, gerekceCiz } from './gorunum.js';
import { mevzuatKur, aramaYap, maddeGoster, kuralGoster, dayanaklarCiz } from './mevzuat-gorunumu.js';
import { surelerCiz } from './sureler.js';

const FORM_ANAHTARI = 'infaz-form-v2';
const MADDE_ADLARI = new Map(TCK_MADDELERI);
const tamEkran = new URLSearchParams(location.search).has('tam');

const durum = { kt: null, mevzuat: null, cikti: null, vaka: null, gerekceSenaryo: 'yok', zamanlayici: null };

const veriYukle = async (dosya) => {
  const yanit = await fetch(`veri/${dosya}`);
  if (!yanit.ok) throw new Error(`${dosya}: ${yanit.status}`);
  return yanit.json();
};

// ---------------------------------------------------------------------------
// Sekmeler
// ---------------------------------------------------------------------------

function sekmeAc(ad) {
  for (const s of document.querySelectorAll('.sekmeler [role="tab"]')) {
    const aktif = s.id === `sekme-${ad}`;
    s.setAttribute('aria-selected', String(aktif));
    $(s.getAttribute('aria-controls')).classList.toggle('gizli', !aktif);
  }
  if (ad === 'gerekce' && durum.cikti) gerekceCiz(durum.cikti, durum.gerekceSenaryo);
  if (ad === 'mevzuat') {
    dayanaklarCiz(durum.cikti);
    if (!$('mevzuatSonuc').children.length) aramaYap();
  }
  if (ad === 'sureler') surelerCiz(durum.kt);
}

// ---------------------------------------------------------------------------
// Form yardımcıları
// ---------------------------------------------------------------------------

function kosulluAlanlar() {
  const kanun = $('kanun').value;
  $('kanun_no').classList.toggle('gizli', kanun !== 'diger');
  const { madde, fikra, bent } = maddeAyristir();
  let metin = '';
  if (kanun === '5237' && madde) {
    const ad = MADDE_ADLARI.get(madde);
    const konum = durum.kt?.tckKonumu(madde);
    metin = `TCK m.${madde}${fikra ? '/' + fikra : ''}${bent ? '-' + bent : ''}${ad ? ' · ' + ad : ''}${konum ? ` · ${konum[0]}. Kitap ${konum[1]}. Kısım ${konum[2]}. Bölüm` : ''}`;
  } else if (kanun === '5941') {
    metin = 'Çek Kanunu: m.5 (karşılıksız çek adli parası) veya m.7 (hapis gerektiren suçlar).';
  } else if (kanun === '2937') {
    metin = '2937 ceza hükümleri: kapsam hükümden doğrulanmalı (Dosya ayrıntıları).';
  }
  $('maddeAdi').textContent = metin;
  const tur = $('ceza_turu').value;
  document.querySelectorAll('.kosullu').forEach((el) => {
    let goster = false;
    if (el.dataset.madde) goster = kanun === '5237' && !!madde && el.dataset.madde.split(',').includes(madde);
    if (el.dataset.tur) goster = el.dataset.tur.split(',').includes(tur);
    if (el.dataset.kanun) goster = el.dataset.kanun === kanun;
    el.classList.toggle('goster', goster);
  });
  const dolu = [...document.querySelectorAll('#ayrintiBolumu input, #ayrintiBolumu select')].filter((el) =>
    el.type === 'checkbox' ? el.checked : !['profil_kusurat', 'profil_ay'].includes(el.id) && el.value !== '',
  ).length;
  $('ayrintiSayac').textContent = dolu ? `(${dolu} alan dolu)` : '';
}

function oncekiKartEkle(deger = null) {
  const parca = $('oncekiSablon').content.cloneNode(true);
  const kart = parca.querySelector('.onceki');
  if (deger) {
    kart.querySelectorAll('[data-a]').forEach((el) => {
      if (el.dataset.a in deger && deger[el.dataset.a] !== null && deger[el.dataset.a] !== undefined) el.value = deger[el.dataset.a];
    });
  }
  kart.querySelector('.sil').addEventListener('click', () => {
    kart.remove();
    planla();
  });
  $('oncekiListe').appendChild(parca);
}

// ---------------------------------------------------------------------------
// Hesap döngüsü
// ---------------------------------------------------------------------------

function hesaplaVeCiz() {
  kosulluAlanlar();
  durum.vaka = vakaOku();
  try {
    durum.cikti = hesapla(durum.kt, durum.vaka);
  } catch (hata) {
    console.error(hata);
    $('durumBandi').className = 'durum-bandi var hukuki_inceleme_gerekli';
    $('durumBandi').textContent = `Hesap hatası: ${hata.message}`;
    return;
  }
  hesapCiz(durum.cikti);
  const acik = document.querySelector('.sekmeler [aria-selected="true"]').id;
  if (acik === 'sekme-gerekce') gerekceCiz(durum.cikti, durum.gerekceSenaryo);
  if (acik === 'sekme-mevzuat') dayanaklarCiz(durum.cikti);
}

function planla() {
  clearTimeout(durum.zamanlayici);
  durum.zamanlayici = setTimeout(() => {
    hesaplaVeCiz();
    depo.yaz(FORM_ANAHTARI, formDurumu());
  }, 80);
}

// ---------------------------------------------------------------------------
// Dışa aktarım
// ---------------------------------------------------------------------------

async function kopyala() {
  const metin = ozetMetni(durum.cikti);
  try {
    await navigator.clipboard.writeText(metin);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = metin;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  bildir('Özet panoya kopyalandı');
}

function sonucIndir() {
  const veri = { olusturma: new Date().toISOString(), kural_tabani: durum.kt.kimlik, vaka: durum.vaka, cikti: durum.cikti };
  dosyaIndir(`infaz-sonuc-${durum.cikti?.hesap_tarihi || 'hesap'}.json`, JSON.stringify(veri, null, 2));
}

function vakaKaydet() {
  const veri = { bicim: 'infaz-vaka', surum: 2, kural_tabani: durum.kt.kimlik.paket_surumu, vaka: vakaOku() };
  dosyaIndir(`infaz-vaka-${T.bugunIstanbul()}.json`, JSON.stringify(veri, null, 2));
}

async function vakaYukle(dosya) {
  try {
    const veri = JSON.parse(await dosya.text());
    const vaka = veri.vaka || veri;
    if (!vaka.suclar_ve_ilamlar && !vaka.ilam) throw new Error('Vaka dosyası değil.');
    vakadanForm(vaka, oncekiKartEkle);
    planla();
    bildir('Vaka yüklendi');
  } catch (h) {
    bildir(`Vaka yüklenemedi: ${h.message}`);
  }
}

function yazdir() {
  if (tamEkran) {
    document.body.classList.add('yazdirma');
    document.querySelectorAll('details.bolum').forEach((d) => (d.open = true));
    gerekceCiz(durum.cikti, durum.cikti?.secili_senaryo || 'yok');
    dayanaklarCiz(durum.cikti);
    setTimeout(() => {
      window.print();
      document.body.classList.remove('yazdirma');
    }, 50);
  } else {
    depo.yaz(FORM_ANAHTARI, formDurumu()).then(() => sayfaAc('tam=1&yazdir=1'));
  }
}

// ---------------------------------------------------------------------------
// Başlatma
// ---------------------------------------------------------------------------

function olaylariBagla() {
  const hesapPaneli = $('panel-hesap');
  hesapPaneli.addEventListener('input', planla);
  hesapPaneli.addEventListener('change', planla);
  document.querySelector('.sekmeler').addEventListener('click', (e) => {
    const s = e.target.closest('[role="tab"]');
    if (s) sekmeAc(s.id.replace('sekme-', ''));
  });
  // Kural çipleri, madde bağlantıları, gerekçe ve eksik alan kısayolları
  document.addEventListener('click', (e) => {
    const kural = e.target.closest('[data-kural]');
    if (kural) {
      sekmeAc('mevzuat');
      kuralGoster(kural.dataset.kural);
      return;
    }
    const madde = e.target.closest('[data-madde]');
    if (madde && madde.tagName === 'BUTTON') {
      sekmeAc('mevzuat');
      maddeGoster(madde.dataset.madde);
      return;
    }
    const gerekce = e.target.closest('[data-gerekce]');
    if (gerekce) {
      durum.gerekceSenaryo = gerekce.dataset.gerekce;
      sekmeAc('gerekce');
      return;
    }
    const sekme = e.target.closest('[data-gerekce-sekme]');
    if (sekme) {
      durum.gerekceSenaryo = sekme.dataset.gerekceSekme;
      gerekceCiz(durum.cikti, durum.gerekceSenaryo);
      return;
    }
    const odak = e.target.closest('[data-odak]');
    if (odak) {
      const hedef = $(odak.dataset.odak);
      const bolum = hedef?.closest('details');
      if (bolum) bolum.open = true;
      hedef?.closest('.kosullu')?.classList.add('goster');
      hedef?.focus();
    }
  });
  $('oncekiEkle').addEventListener('click', () => {
    oncekiKartEkle();
    planla();
  });
  $('sifirla').addEventListener('click', () => {
    formuSifirla();
    planla();
  });
  $('tamEkran').addEventListener('click', () => depo.yaz(FORM_ANAHTARI, formDurumu()).then(() => sayfaAc('tam=1')));
  $('kopyala').addEventListener('click', kopyala);
  $('jsonIndir').addEventListener('click', sonucIndir);
  $('yazdir').addEventListener('click', yazdir);
  $('vakaKaydet').addEventListener('click', vakaKaydet);
  $('vakaYukle').addEventListener('change', (e) => e.target.files[0] && vakaYukle(e.target.files[0]));
  $('mevzuatSec').addEventListener('change', aramaYap);
  let aramaZamanlayici;
  $('mevzuatAra').addEventListener('input', () => {
    clearTimeout(aramaZamanlayici);
    aramaZamanlayici = setTimeout(aramaYap, 200);
  });
  $('panel-sureler').addEventListener('input', () => surelerCiz(durum.kt));
}

async function baslat() {
  if (tamEkran) {
    document.body.classList.add('tam');
    $('tamEkran').classList.add('gizli');
  }
  $('maddeListesi').innerHTML = TCK_MADDELERI.map(([m, ad]) => `<option value="${esc(m)}">${esc(ad)}</option>`).join('');
  try {
    durum.kt = new KuralTabani(await veriYukle('paket.json'));
  } catch (hata) {
    $('paketBilgi').textContent = 'Kural tabanı yüklenemedi.';
    $('durumBandi').className = 'durum-bandi var hukuki_inceleme_gerekli';
    $('durumBandi').textContent = `Çalışma paketi okunamadı (${hata.message}). npm run veri ile yeniden derleyin.`;
    return;
  }
  durum.mevzuat = new MevzuatDeposu(durum.kt, veriYukle);
  const k = durum.kt;
  $('paketBilgi').textContent = `Kural tabanı ${k.surum} · ${k.kurallar.size} kural · ${k.dugumler.size} düğüm · ${k.mevzuatListesi.length} tam metin`;
  $('paketBilgi').title = `Kaynak SHA-256: ${k.sha256}`;
  gorunumKur(k);
  mevzuatKur(k, durum.mevzuat);
  formuDoldur(await depo.oku(FORM_ANAHTARI), oncekiKartEkle);
  olaylariBagla();
  hesaplaVeCiz();
  if (!$('suc_tarihi').value) $('suc_tarihi').focus();
  if (new URLSearchParams(location.search).has('yazdir')) setTimeout(yazdir, 300);
}

baslat();
