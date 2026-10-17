// Hesap ekranının çizimi: cevap özetleri, sıradaki soru kartı ve sonuç.
// Yalnız gösterim; olaylar uygulama.js'de bağlanır (data-* öznitelikleri).

import { takvim as T } from '../cekirdek/index.js';
import { $, esc } from './yardimci.js';
import { metin, TEMEL_SORULAR } from './sorular.js';
import { sucAra, maddeCoz } from './tck-maddeleri.js';
import { ozelDurum, mahsupGunu, MAHSUP_TURLERI } from './dosya.js';
import { sureYaklasik } from './ozet.js';

const tr = (s) => (s ? T.trTarih(s) : '—');
const IKON = {
  geri: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  ileri: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  tamam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  kalem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  kopya: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  paylas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
};

// ---------------------------------------------------------------------------
// Cevaplar
// ---------------------------------------------------------------------------

export function cevaplarCiz(liste, aktifId) {
  $('cevaplar').innerHTML = liste.length
    ? liste
        .map((c) => `<button type="button" class="cevap${c.bilinmiyor ? ' bilinmiyor' : ''}${c.id === aktifId ? ' aktif' : ''}" data-duzenle="${esc(c.id)}" title="Değiştir">${esc(c.metin)}</button>`)
        .join('')
    : '';
}

// ---------------------------------------------------------------------------
// Soru kartı
// ---------------------------------------------------------------------------

const CEZA_TURLERI = [
  ['sureli_hapis', 'Süreli hapis'],
  ['muebbet', 'Müebbet'],
  ['agirlastirilmis_muebbet', 'Ağırlaştırılmış müebbet'],
  ['adli_paradan_cevrilen_hapis', 'Paradan çevrilen hapis'],
];

const sayiAlani = (id, etiket, deger) =>
  `<label class="sayi-alani"><input type="number" id="${id}" min="0" step="1" inputmode="numeric" placeholder="0" value="${deger || ''}"><span>${etiket}</span></label>`;

function govde(s, d, durum) {
  switch (s.tur) {
    case 'secim':
      return `<div class="secenekler">${s
        .secenekler(d)
        .map((o, i) => {
          const secili = mevcutSecim(s, d) === o.deger;
          return `<button type="button" class="secenek${secili ? ' secili' : ''}" data-secim="${i}"><b>${esc(o.etiket)}</b>${o.aciklama ? `<small>${esc(o.aciklama)}</small>` : ''}</button>`;
        })
        .join('')}</div>`;
    case 'tarih': {
      const deger = s.id === 'suc_tarihi' ? d.suc_tarihi : d.ek[s.id];
      return `<input type="date" id="s_tarih" class="buyuk-girdi" value="${esc(deger || '')}" max="2100-12-31">`;
    }
    case 'ceza': {
      const esas = s.id === 'esas_ceza';
      const c = esas ? d.esas_ceza : d.ceza;
      const tur = esas ? 'sureli_hapis' : d.ceza_turu;
      const sureli = tur === 'sureli_hapis' || tur === 'adli_paradan_cevrilen_hapis';
      return `${esas ? '' : `<div class="bolumlu" role="radiogroup" aria-label="Ceza türü">${CEZA_TURLERI.map(([k, ad]) => `<button type="button" role="radio" aria-checked="${k === tur}" data-ceza-turu="${k}">${ad}</button>`).join('')}</div>`}
        <div class="ceza-girdi${sureli ? '' : ' gizli'}">${sayiAlani('s_yil', 'yıl', c?.yil)}${sayiAlani('s_ay', 'ay', c?.ay)}${sayiAlani('s_gun', 'gün', c?.gun)}</div>`;
    }
    case 'suc': {
      const sorgu = durum.sorgu ?? '';
      const sonuclar = sucAra(sorgu);
      const serbest = maddeCoz(sorgu);
      const ozel = ozelDurum(d);
      const listede = serbest && sonuclar.some((x) => x.kanun === 5237 && x.madde === serbest.madde);
      return `<input type="search" id="s_ara" class="buyuk-girdi" placeholder="hırsızlık, 142, 87/2-d…" value="${esc(sorgu)}" autocomplete="off">
        <div class="suc-listesi">${sonuclar
          .map((x) => `<button type="button" class="secenek satir${d.suc?.kanun === x.kanun && d.suc?.madde === x.madde ? ' secili' : ''}" data-suc="${x.kanun}|${esc(x.madde)}"><b>${esc(x.etiket)}</b><small>${esc(x.ad)}</small></button>`)
          .join('')}
          ${serbest && (!listede || serbest.fikra) ? `<button type="button" class="secenek satir" data-suc-serbest="1"><b>TCK ${esc(serbest.madde)}${serbest.fikra ? '/' + esc(serbest.fikra) : ''}${serbest.bent ? '-' + esc(serbest.bent) : ''}</b><small>yazdığım madde</small></button>` : ''}
        </div>
        <details class="baska-kanun"${durum.baskaKanun ? ' open' : ''}><summary>Başka kanun</summary>
          <div class="yan-yana"><label class="alan"><span>Kanun no</span><input type="number" id="s_kanun" inputmode="numeric" placeholder="6136"></label>
          <label class="alan"><span>Madde</span><input type="text" id="s_madde" placeholder="13/1"></label>
          <button type="button" class="dugme" data-suc-kanun="1">Seç</button></div>
        </details>
        <div class="ozel-durum"><span>Özel durum varsa:</span>
          ${[['teror', 'Terör suçu'], ['orgut', 'Örgüt faaliyeti çerçevesinde'], ['taksir', 'Taksirli suç']]
            .map(([k, ad]) => `<button type="button" class="anahtar" role="switch" aria-checked="${!!ozel[k]}" data-ozel="${k}">${ad}</button>`)
            .join('')}
        </div>`;
    }
    case 'giris': {
      if (d.konum === 'cezaevinde') return `<input type="date" id="s_tarih" class="buyuk-girdi" value="${esc(d.giris?.tarih || '')}">`;
      const tarihli = durum.girisTarihli || d.giris?.tur === 'tarih';
      return `<div class="secenekler iki">
          <button type="button" class="secenek${d.giris?.tur === 'bugun' ? ' secili' : ''}" data-giris="bugun"><b>Bugün</b><small>${esc(tr(T.bugunIstanbul()))}</small></button>
          <button type="button" class="secenek${tarihli ? ' secili' : ''}" data-giris="tarih"><b>Tarih seç</b><small>Bilinen giriş günü</small></button>
        </div>
        <input type="date" id="s_tarih" class="buyuk-girdi${tarihli ? '' : ' gizli'}" value="${esc(d.giris?.tarih || '')}">`;
    }
    case 'mahsup':
      return `<div class="secenekler iki"><button type="button" class="secenek${d.mahsup && !d.mahsup.length ? ' secili' : ''}" data-mahsup-yok="1"><b>Yok</b><small>mahsup yok</small></button></div>
        <div class="mahsup-liste">${(durum.mahsupTaslak || []).map(mahsupSatiri).join('')}</div>
        <button type="button" class="dugme hafif ekle" data-mahsup-ekle="1">＋ Kayıt ekle</button>`;
    case 'fikra':
      return `<div class="ceza-girdi"><label class="sayi-alani"><input type="text" id="s_fikra" inputmode="numeric" placeholder="2" value="${esc(d.suc?.fikra || '')}"><span>fıkra</span></label>
        <label class="sayi-alani"><input type="text" id="s_bent" placeholder="a" value="${esc(d.suc?.bent || '')}"><span>bent</span></label></div>`;
    default:
      return '';
  }
}

function mahsupSatiri(k, i) {
  const g = mahsupGunu(k);
  return `<div class="mahsup-satir" data-satir="${i}">
    <div class="mahsup-ust">
      <select data-m="tur" aria-label="Tür">${MAHSUP_TURLERI.map(([t, ad]) => `<option value="${t}"${t === k.tur ? ' selected' : ''}>${esc(ad)}</option>`).join('')}</select>
      <button type="button" class="sil" data-mahsup-sil="${i}" aria-label="Kaydı sil">✕</button>
    </div>
    <div class="mahsup-alanlar">
      <label class="alan"><span>Başlangıç</span><input type="date" data-m="baslangic" value="${esc(k.baslangic || '')}"></label>
      <label class="alan"><span>Bitiş</span><input type="date" data-m="bitis" value="${esc(k.bitis || '')}"></label>
      <label class="alan gun"><span>veya gün</span><input type="number" data-m="gun" min="0" step="1" inputmode="numeric" placeholder="0" value="${k.gun || ''}"></label>
    </div>
    <p class="mahsup-hesap">${mahsupHesapMetni(k, g)}</p>
  </div>`;
}

export function mahsupHesapMetni(k, g = mahsupGunu(k)) {
  if (!g.takvim) return '';
  return k.tur === 'konutu_terk_etmeme' ? `${g.takvim} gün → cezadan ${g.dusulen} gün düşülür` : `${g.takvim} gün cezadan düşülür`;
}

// Mahsup satırlarını okur. Boş satır atlanır; eksik/ters tarih → { hata }.
export function mahsupOku() {
  const liste = [];
  for (const satir of document.querySelectorAll('.mahsup-satir')) {
    const v = (m) => satir.querySelector(`[data-m="${m}"]`).value.trim();
    const k = { tur: v('tur') };
    const gun = v('gun');
    const bas = v('baslangic');
    const bit = v('bitis');
    if (gun) {
      const n = Number(gun);
      if (!Number.isInteger(n) || n < 0) return { hata: 'Gün sayısını tam sayı olarak girin.' };
      if (n > 0) liste.push({ ...k, gun: n });
    } else if (bas || bit) {
      if (!T.gecerliTarih(bas) || !T.gecerliTarih(bit)) return { hata: 'Tarih aralığının iki ucunu da girin ya da gün sayısı yazın.' };
      if (bit < bas) return { hata: 'Bitiş tarihi başlangıçtan önce olamaz.' };
      liste.push({ ...k, baslangic: bas, bitis: bit });
    }
  }
  return { liste };
}

// Satırların ekrandaki hâli (girilen değerler kaybolmadan yeniden çizim için).
export function mahsupTaslagi() {
  return [...document.querySelectorAll('.mahsup-satir')].map((satir) => {
    const v = (m) => satir.querySelector(`[data-m="${m}"]`).value.trim();
    const gun = Number(v('gun'));
    return { tur: v('tur'), baslangic: v('baslangic') || undefined, bitis: v('bitis') || undefined, gun: Number.isInteger(gun) && gun > 0 ? gun : undefined };
  });
}

function mevcutSecim(s, d) {
  if (s.id === 'konum') return d.konum;
  if (s.id === 'tekerrur') return d.tekerrur;
  return d.ek[s.id];
}

const DEVAM_GEREKEN = new Set(['tarih', 'ceza', 'mahsup', 'fikra']);

export function soruCiz(s, d, durum) {
  const kart = $('soruKarti');
  if (!s) {
    kart.className = 'soru-karti bitti';
    kart.innerHTML = durum.hesaplanabilir
      ? `<div class="bitti-satir">${IKON.tamam}<div><b>Gerekli bilgiler tamam.</b><small>Bir cevabı değiştirmek için yukarıdaki kutucuklara dokunun.</small></div></div>`
      : '';
    return;
  }
  const temel = TEMEL_SORULAR.includes(s);
  const sira = temel ? `${durum.sira} / ${durum.toplam}` : 'Ek soru · sonucu değiştiriyor';
  const devam = DEVAM_GEREKEN.has(s.tur) || (s.tur === 'giris' && (d.konum === 'cezaevinde' || durum.girisTarihli || d.giris?.tur === 'tarih'));
  kart.className = `soru-karti${temel ? '' : ' ek'}`;
  kart.innerHTML = `
    <div class="soru-ust"><span class="sira">${esc(sira)}</span>${durum.ilerleme !== null ? `<span class="ilerleme"><i style="width:${Math.round(durum.ilerleme * 100)}%"></i></span>` : ''}</div>
    <h2>${esc(metin(s.baslik, d))}</h2>
    ${s.aciklama ? `<p class="soru-aciklama">${esc(metin(s.aciklama, d))}</p>` : ''}
    <div class="soru-govde">${govde(s, d, durum)}</div>
    ${durum.uyari ? `<p class="uyari" role="alert">${esc(durum.uyari)}</p>` : ''}
    <div class="soru-alt">
      ${durum.geriVar ? `<button type="button" class="dugme hafif" data-eylem="geri">${IKON.geri}<span>Geri</span></button>` : '<span></span>'}
      <div class="sag-grup">
        ${s.bilinmiyor ? `<button type="button" class="dugme hafif" data-eylem="bilmiyorum">Bilmiyorum</button>` : ''}
        ${devam ? `<button type="button" class="dugme ana" data-eylem="devam"><span>Devam</span>${IKON.ileri}</button>` : ''}
      </div>
    </div>`;
}

// Soru kartındaki girdilerden cevap değeri (devam düğmesi için). null: geçersiz.
export function soruDegeri(s, d) {
  const sayi = (id) => {
    const v = $(id)?.value.trim();
    if (!v) return 0;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };
  switch (s.tur) {
    case 'tarih':
    case 'giris': {
      const v = $('s_tarih')?.value || '';
      if (!T.gecerliTarih(v)) return null;
      return s.tur === 'giris' ? { tur: 'tarih', tarih: v } : v;
    }
    case 'ceza': {
      const tur = s.id === 'esas_ceza' ? 'sureli_hapis' : d.ceza_turu;
      if (tur === 'muebbet' || tur === 'agirlastirilmis_muebbet') return { ceza_turu: tur, ceza: null };
      const c = { yil: sayi('s_yil'), ay: sayi('s_ay'), gun: sayi('s_gun') };
      if (Object.values(c).some(Number.isNaN) || !(c.yil || c.ay || c.gun)) return null;
      return { ceza_turu: tur, ceza: c };
    }
    case 'mahsup': {
      const m = mahsupOku();
      return m.hata ? null : m.liste;
    }
    case 'fikra': {
      const fikra = $('s_fikra').value.trim();
      const bent = $('s_bent').value.trim().toLocaleLowerCase('tr');
      if (!fikra && !bent) return null;
      return { fikra: fikra || null, bent: bent || null };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Sonuç
// ---------------------------------------------------------------------------

function sayiKutusu(tur, ad, gun, acik) {
  const yaklasik = sureYaklasik(gun);
  return `<button type="button" class="sayi-kutu ${tur}${gun ? '' : ' sifir'}${acik ? ' acik-neden' : ''}" data-neden="${tur}" aria-expanded="${acik}">
    <span class="ad">${ad}</span>
    <span class="deger">${gun}<small>gün</small></span>
    <span class="yaklasik">${esc(yaklasik) || '&nbsp;'}</span>
  </button>`;
}

function nedenHtml(o, tur) {
  const n = o.neden;
  const satirlar = { kapali: [n.kapali], acik: [n.kapali, n.cikis], ds: [n.cikis, n.ks] }[tur].filter(Boolean);
  if (!satirlar.length) return '';
  return `<div class="neden-kutu">${satirlar
    .map((x) => `<p>${esc(x.metin)}${x.madde ? ` <button type="button" class="madde-bag" data-madde="${esc(x.madde)}">Madde metni</button>` : ''}</p>`)
    .join('')}</div>`;
}

function cizelge(olaylar) {
  return `<ol class="cizelge">${olaylar
    .map((e) => `<li class="olay ${e.tur}${e.vurgu ? ' vurgu' : ''}"><span class="nokta"></span><div><span class="tarih">${e.tarih ? esc(tr(e.tarih)) : ''}</span><b>${esc(e.baslik)}</b><small>${esc(e.aciklama)}</small></div></li>`)
    .join('')}</ol>`;
}

function karsilastirmaHtml(o, gorunen) {
  return `<h3 class="kiyas-baslik">Cezaevinde kalış · tekerrüre göre</h3><div class="karsilastirma" role="group" aria-label="Tekerrüre göre karşılaştırma">${o.karsilastirma
    .map(
      (k) => `<button type="button" class="kiyas${k.anahtar === o.senaryo ? ' secili' : ''}" data-senaryo="${k.anahtar}" aria-pressed="${k.anahtar === o.senaryo}">
        <span>${esc(k.baslik)}</span>
        <b>${k.gun === null ? '—' : `${k.en_cok ? '<i title="en çok">≤</i>' : ''}${k.gun}<small> gün</small>`}</b>
        ${k.gun === null ? `<small class="neden-kisa">${esc(k.neden)}</small>` : `<small>çıkış ${esc(tr(k.cikis))}</small>`}
      </button>`,
    )
    .join('')}</div>${gorunen ? '<p class="ipucu">Karşılaştırma görünümü. Dosyanın kendi sonucuna dönmek için seçili kartlara dokunun.</p>' : ''}`;
}

export function muddetnameTablosu(satirlar) {
  const farkli = satirlar.filter((r) => r.fark);
  const govde = satirlar
    .map((r) => {
      const fark = r.fark === null ? '' : r.fark === 0 ? '<span class="fark ayni">aynı</span>' : `<span class="fark">${r.fark > 0 ? '+' : '−'}${Math.abs(r.fark)} gün</span>`;
      return `<tr><th>${esc(r.kisa)}</th><td>${esc(tr(r.hesap))}</td><td>${r.muddetname ? esc(tr(r.muddetname)) : '<span class="silik">—</span>'}</td><td>${fark}</td></tr>`;
    })
    .join('');
  return `<table class="md-tablo"><thead><tr><th></th><th>Hesap</th><th>Müddetname</th><th>Fark</th></tr></thead><tbody>${govde}</tbody></table>
    ${farkli.length ? '<p class="ipucu">Fark varsa önce giriş tarihini ve mahsupları (gözaltı, tutukluluk, kullanılan DS) kontrol edin. Bu araçta ay 30 gün sayılır, kesirli gün aşağı yuvarlanır. "+" müddetnamenin daha geç olduğunu gösterir.</p>' : ''}`;
}

function muddetnameKarti(satirlar, md) {
  if (!satirlar.length) return '';
  const dolu = Object.values(md || {}).some(Boolean);
  return `<details class="katlanir muddetname"${dolu ? ' open' : ''}><summary>Müddetname ile karşılaştır</summary>
    <p class="ipucu">Müddetnamedeki tarihleri girin; hesapla farkı gün olarak görünür.</p>
    <div class="md-girdiler">${satirlar
      .map((r) => `<label class="alan"><span>${esc(r.ad)}</span><input type="date" data-md="${r.id}" value="${esc(r.muddetname || '')}"></label>`)
      .join('')}</div>
    <div id="mdTablo">${muddetnameTablosu(satirlar)}</div>
  </details>`;
}

export function sonucCiz(o, { gorunen = null, acikNeden = null, paylasVar = false, onSonuc = false, muddetname = [], md = {} } = {}) {
  const el = $('sonuc');
  if (o.durum === 'bos' || o.durum === 'kapsam_disi') {
    el.innerHTML = `<div class="sonuc-bos${o.durum === 'kapsam_disi' ? ' kapsam-disi' : ''}"><p>${esc(o.mesaj)}</p></div>`;
    return;
  }
  const parca = [];
  if (o.durum === 'hesaplanamadi') {
    parca.push(`<section class="sonuc-kart"><div class="sonuc-ust"><span class="etiket">${esc(o.baslik)}</span></div><p class="hesaplanamadi">${esc(o.mesaj)}</p></section>`);
  } else {
    const ozet = [];
    if (o.kapali) ozet.push(`${o.kapali} gün kapalı`);
    if (o.acik) ozet.push(`${o.acik} gün açık`);
    const cumle = `${ozet.length ? ozet.join(', ') + ' cezaevinde' : 'Cezaevinde kalmaz'}${o.ds ? `, sonra ${o.ds} gün denetimli serbestlik` : ''}.`;
    parca.push(`<section class="sonuc-kart">
      <div class="sonuc-ust">
        <span class="etiket">${esc(o.baslik)} · iyi hâl şartıyla</span>
        ${onSonuc ? '<span class="rozet on-sonuc" title="Sorular tamamlanınca kesinleşir">ön sonuç</span>' : o.en_cok ? '<span class="rozet en-cok" title="Bilinmeyen bilgiler aleyhe kabul edildi">en çok</span>' : ''}
      </div>
      <p class="cumle">${esc(cumle)}</p>
      <div class="uc-sayi">
        ${sayiKutusu('kapali', 'Kapalı', o.kapali, acikNeden === 'kapali')}
        ${sayiKutusu('acik', 'Açık', o.acik, acikNeden === 'acik')}
        ${sayiKutusu('ds', 'Denetimli serbestlik', o.ds, acikNeden === 'ds')}
      </div>
      ${acikNeden ? nedenHtml(o, acikNeden) : '<p class="ipucu ortali">Nedenini görmek için sayıya dokunun.</p>'}
      ${cizelge(o.olaylar)}
      ${o.talepsiz ? `<p class="talepsiz"><b>Denetimli serbestliği talep etmezse:</b> ${esc(tr(o.talepsiz.cikis))} tarihinde ${o.talepsiz.ks ? 'koşullu salıverilme ile' : 'ceza bitiminde'} çıkar · ${o.talepsiz.icerde} gün cezaevinde${o.talepsiz.kapali && o.talepsiz.acik ? ` (${o.talepsiz.kapali} kapalı, ${o.talepsiz.acik} açık)` : ''}.</p>` : ''}
      ${o.en_cok ? '<p class="not-satiri">Bazı bilgiler bilinmediği için aleyhe hesaplandı; süre daha kısa olabilir.</p>' : ''}
      <div class="eylemler">
        <button type="button" class="dugme" data-eylem="kopyala">${IKON.kopya}<span>Kopyala</span></button>
        ${paylasVar ? `<button type="button" class="dugme" data-eylem="paylas">${IKON.paylas}<span>Paylaş</span></button>` : ''}
      </div>
    </section>`);
  }
  if (!gorunen) parca.push(muddetnameKarti(muddetname, md));
  parca.push(karsilastirmaHtml(o, gorunen));
  if (o.varsayimlar.length) {
    parca.push(`<div class="varsayimlar"><h3>Bilinmeyenler</h3><ul>${o.varsayimlar.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>`);
  }
  if (o.dikkat.length) {
    parca.push(`<details class="katlanir dikkat"><summary>Dikkat edilmesi gerekenler <span class="sayac">${o.dikkat.length}</span></summary><ul>${o.dikkat.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></details>`);
  }
  if (o.adimlar?.length) {
    parca.push(`<details class="katlanir"><summary>Hesabın adımları</summary><ol class="adimlar">${o.adimlar.map((v) => `<li>${esc(v)}</li>`).join('')}</ol></details>`);
  }
  parca.push('<p class="yasal">Ön değerlendirmedir; iyi hâl, açığa ayrılma ve DS kurum ile hâkimlik kararlarına bağlıdır. Resmî müddetnamenin yerine geçmez.</p>');
  el.innerHTML = parca.join('');
}

