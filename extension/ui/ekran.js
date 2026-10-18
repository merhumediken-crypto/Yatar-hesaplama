// Hesap ekranının çizimi: cevap özetleri, sıradaki soru kartı ve sonuç.
// Yalnız gösterim; olaylar uygulama.js'de bağlanır (data-* öznitelikleri).

import { takvim as T } from '../cekirdek/index.js';
import { $, esc } from './yardimci.js';
import { metin, TEMEL_SORULAR } from './sorular.js';
import { sucAra, maddeCoz } from './tck-maddeleri.js';
import { ozelDurum, mahsupGunu, siraliIlamAdi, MAHSUP_TURLERI } from './dosya.js';
import { maddeEtiketi } from './tck-maddeleri.js';
import { sureYaklasik } from './ozet.js';
import { sonucKompozisyonu, bosKompozisyon } from './kompozisyon.js';

const tr = (s) => (s ? T.trTarih(s) : '—');
const IKON = {
  geri: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  ileri: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  tamam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  kalem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  kopya: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  paylas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  harici: '<svg viewBox="0 0 24 24" class="harici-ikon" aria-hidden="true"><path d="M8 5h11v11M19 5L5 19"/></svg>',
};

// ---------------------------------------------------------------------------
// Cevaplar
// ---------------------------------------------------------------------------

// Gruplar (sorular.js → cevapGruplari): tek ilamda tek grup; birden çok ilamda dosya grubu
// ve ilam başına başlıklı, katlanır grup. `aktif`: ekrandaki soru örneği { s, i }.
// Telefonda uzun liste soru kartını aşağı itmesin diye yalnız soru sorulan ilam ve avukatın
// açtığı ilamlar (`acikIlamlar`) açık çizilir. Açma/kapama uygulama.js'de durumdan yönetilir.
export function cevaplarCiz(gruplar, aktif, { ilamEkle = false, acikIlamlar = new Set() } = {}) {
  const aktifMi = (c) => aktif && aktif.s.id === c.id && (aktif.i ?? null) === (c.i ?? null);
  const kutu = (c) =>
    `<button type="button" class="cevap${c.bilinmiyor ? ' bilinmiyor' : ''}${aktifMi(c) ? ' aktif' : ''}" data-duzenle="${esc(c.id)}"${c.i !== null && c.i !== undefined ? ` data-ilam="${c.i}"` : ''} title="Değiştir">${esc(c.metin)}</button>`;
  const ilamGrubu = (g) => {
    const etkin = aktif?.i === g.i;
    const acik = etkin || acikIlamlar.has(g.i);
    const durum = g.eksik ? `<span class="ilam-durum bekliyor">${g.eksik} soru</span>` : `<span class="ilam-durum tamam" title="Temel bilgiler tamam">✓</span>`;
    return `<details class="ilam-grup${etkin ? ' aktif' : ''}" data-ilam-grup="${g.i}"${acik ? ' open' : ''}>
      <summary class="ilam-grup-ust"><span class="ilam-no" aria-hidden="true">${g.i + 1}</span><div><b>${esc(g.baslik)}</b>${g.alt ? `<small>${esc(g.alt)}</small>` : ''}</div>${durum}<button type="button" class="ilam-sil" data-ilam-sil="${g.i}" title="İlamı dosyadan çıkar" aria-label="${g.i + 1}. ilamı dosyadan çıkar">✕</button></summary>
      <div class="cevap-grup">${g.cevaplar.map(kutu).join('') || '<span class="ipucu">Sorular sırayla gelecek.</span>'}</div></details>`;
  };
  const html = gruplar
    .map((g) =>
      g.baslik === null
        ? g.cevaplar.length
          ? `<div class="cevap-grup">${g.cevaplar.map(kutu).join('')}</div>`
          : ''
        : ilamGrubu(g),
    )
    .join('');
  $('cevaplar').innerHTML = html + (ilamEkle ? '<button type="button" class="ilam-ekle" data-ilam-ekle="1">＋ Başka ilam ekle</button>' : '');
}

// ---------------------------------------------------------------------------
// Belgeden okuma paneli
// ---------------------------------------------------------------------------

const BELGE_SIMGE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>';
const MAHSUP_ADI = Object.fromEntries(MAHSUP_TURLERI);

function okumaOnizleme(r, mevcutVar) {
  const ilamlar = r.ilamlar || [];
  // Telefonda tablo yana taşar; her ilam bir satır kartıdır. Okunamayan alan "sorulacak" etiketiyle.
  const etiket = (deger, bos) => (deger ? `<span>${esc(deger)}</span>` : `<span class="sorulacak">${bos}</span>`);
  const satir = (i, n) => {
    const ceza = i.ceza ? T.cezaMetni(i.ceza) : { muebbet: 'Müebbet', agirlastirilmis_muebbet: 'Ağırlaştırılmış müebbet' }[i.ceza_turu];
    const suc = i.maddeler?.length ? i.maddeler.map(maddeEtiketi).join(', ') : i.suc_adi;
    return `<li><span class="ilam-no" aria-hidden="true">${i.sira ?? n + 1}</span><div>
      <div class="belge-ilam-ust"><b>${esc(i.mahkeme_kisa || 'Mahkeme okunamadı')}</b>${ceza ? `<b class="ceza">${esc(ceza)}</b>` : '<span class="sorulacak">ceza okunamadı</span>'}</div>
      <small>${esc([i.esas_no && `${i.esas_no} E.`, i.karar_no && `${i.karar_no} K.`, i.infaz_no && `infaz ${i.infaz_no}`].filter(Boolean).join(' · '))}</small>
      <div class="belge-etiketler">${etiket(i.karar_tarihi && `hüküm ${tr(i.karar_tarihi)}`, 'hüküm tarihi yok')}${etiket(i.suc_tarihi && `suç ${tr(i.suc_tarihi)}`, 'suç tarihi sorulacak')}${etiket(suc, 'suç sorulacak')}</div>
    </div></li>`;
  };
  const toplam = r.toplam
    ? `<p class="belge-toplam ${r.toplam.uyusuyor === false ? 'uyusmaz' : 'uyusur'}">${r.toplam.uyusuyor === false ? '⚠' : '✓'} Karardaki toplam: <b>${esc(T.cezaMetni(r.toplam.ceza))}</b>${r.toplam.uyusuyor === false ? ` · okunan ilamların toplamı ${esc(T.cezaMetni(r.toplam.ilamlar_toplami))}` : ' · ilam cezalarının toplamıyla uyuşuyor'}</p>`
    : '';
  const infaz = r.infaz
    ? `<ul class="belge-liste">${r.infaz.baslama ? `<li>Cezaevine giriş: <b>${esc(tr(r.infaz.baslama))}</b></li>` : ''}${(r.infaz.mahsuplar || []).map((m) => `<li>${esc(MAHSUP_ADI[m.tur])}: <b>${m.gun ? `${m.gun} gün` : `${esc(tr(m.baslangic))} – ${esc(tr(m.bitis))}`}</b></li>`).join('')}</ul>`
    : '';
  const md = Object.entries(r.muddetname || {});
  const mdHtml = md.length ? `<p class="ipucu">Müddetnamedeki ${md.length} tarih karşılaştırma tablosuna aktarılacak.</p>` : '';
  return `<div class="belge-onizleme">
    <div class="belge-tur"><span class="rozet">${esc(r.tur_adi)}</span>${r.karar?.mahkeme ? `<span>${esc(r.karar.mahkeme)}${r.karar.karar_no ? ` · karar ${esc(r.karar.karar_no)}` : ''}${r.karar.karar_tarihi ? ` · ${esc(tr(r.karar.karar_tarihi))}` : ''}</span>` : ''}</div>
    ${r.kisi?.ad || r.kisi?.dogum_tarihi ? `<p class="belge-kisi">${esc(r.kisi.ad || '')}${r.kisi.dogum_tarihi ? ` · doğum ${esc(tr(r.kisi.dogum_tarihi))}` : ''}</p>` : ''}
    ${ilamlar.length ? `<ol class="belge-ilamlar" aria-label="Okunan ilamlar">${ilamlar.map(satir).join('')}</ol>` : ''}
    ${toplam}${infaz}${mdHtml}
    ${r.uyarilar?.length ? `<ul class="belge-uyari">${r.uyarilar.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
    <p class="ipucu">Okunanları kontrol edin. Belgede olmayan bilgiler (suç tarihi, suç, tekerrür, gözaltı/tutukluluk) her ilam için sırayla sorulacak.</p>
    <div class="belge-eylem">
      ${r.tur === 'bilinmiyor' ? '' : mevcutVar ? '<button type="button" class="dugme ana" data-belge="birlestir">Mevcut dosyaya ekle</button><button type="button" class="dugme" data-belge="yeni">Yeni dosya başlat</button>' : '<button type="button" class="dugme ana" data-belge="birlestir">Hesaba aktar</button>'}
      <button type="button" class="dugme hafif" data-belge="geri">Geri</button>
    </div>
  </div>`;
}

// b: { acik, metin, okuma, hata, sonuc, mevcutVar, ozet (dosyadaki belge özeti) }
export function belgeKartiCiz(b) {
  const el = $('belgeKarti');
  if (!b.acik) {
    const oz = b.ozet;
    el.className = 'belge-karti kapali';
    el.innerHTML = `<button type="button" class="belge-ac" data-belge="ac">${BELGE_SIMGE}<span><b>Belgeden oku</b><small>${oz ? esc([oz.tur_adi, oz.karar?.mahkeme, oz.toplam && `toplam ${T.cezaMetni(oz.toplam)}`].filter(Boolean).join(' · ')) : 'İçtima kararı, müddetname veya gerekçeli karar'}</small></span></button>`;
    return;
  }
  el.className = 'belge-karti acik';
  if (b.sonuc) {
    el.innerHTML = `<div class="belge-ust"><h2>${BELGE_SIMGE} Belgeden aktarıldı</h2></div>
      <ul class="belge-liste">${b.sonuc.degisiklikler.map((x) => `<li>${esc(x)}</li>`).join('') || '<li>Yeni bilgi bulunamadı; dosyadaki cevaplar korundu.</li>'}</ul>
      ${b.sonuc.uyarilar.length ? `<ul class="belge-uyari">${b.sonuc.uyarilar.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
      <div class="belge-eylem"><button type="button" class="dugme ana" data-belge="kapat">Tamam, sorulara geç</button><button type="button" class="dugme hafif" data-belge="baska">Başka belge oku</button></div>`;
    return;
  }
  el.innerHTML = `<div class="belge-ust"><h2>${BELGE_SIMGE} Belgeden oku</h2><button type="button" class="dugme hafif" data-belge="kapat" aria-label="Kapat">✕</button></div>
    ${b.okuma ? okumaOnizleme(b.okuma, b.mevcutVar) : `
    <p class="ipucu">İçtima (toplama) kararı, müddetname veya gerekçeli kararın metnini yapıştırın ya da UYAP'tan indirdiğiniz <b>.udf</b> dosyasını seçin. Metin bu cihazda okunur; hiçbir yere gönderilmez.</p>
    <textarea id="belgeMetni" class="belge-metni" rows="7" placeholder="UYAP Evrak Görüntüleme sayfasındaki metni buraya yapıştırın…" aria-label="Belge metni">${esc(b.metin || '')}</textarea>
    ${b.hata ? `<p class="uyari" role="alert">${esc(b.hata)}</p>` : ''}
    ${b.okunuyor ? '<p class="ipucu" role="status">Dosya okunuyor…</p>' : ''}
    <div class="belge-eylem">
      <button type="button" class="dugme ana" data-belge="oku"${b.okunuyor ? ' disabled' : ''}>Metni oku</button>
      <label class="dugme dosya-sec"><input type="file" id="belgeDosyasi" accept=".udf,.txt,.html,.htm,.xml,application/zip,text/plain,text/html"${b.okunuyor ? ' disabled' : ''}>Dosya seç (.udf)</label>
    </div>`}`;
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
      const hizli = s.id === 'suc_tarihi' && durum.ayniTarih && !deger ? `<button type="button" class="secenek satir hizli" data-tarih-hizli="${esc(durum.ayniTarih.tarih)}"><b>${esc(tr(durum.ayniTarih.tarih))}</b><small>${esc(durum.ayniTarih.ad)} ile aynı · aynı esas ve karar</small></button>` : '';
      return `${hizli}<input type="date" id="s_tarih" aria-label="${esc(metin(s.baslik, d))}" class="buyuk-girdi" value="${esc(deger || '')}" max="2100-12-31">`;
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
      const oneriler = d.meta?.madde_onerileri || [];
      const belgeden = oneriler.length
        ? `<div class="belge-oneri"><span>Belgede geçen${d.meta.suc_adi ? ` · ${esc(d.meta.suc_adi)}` : ''}:</span>${oneriler.map((o, n) => `<button type="button" class="secenek satir" data-suc-oneri="${n}"><b>${esc(maddeEtiketi(o))}</b><small>belgeden</small></button>`).join('')}</div>`
        : d.meta?.suc_adi ? `<p class="ipucu">Belgede suç: <b>${esc(d.meta.suc_adi)}</b></p>` : '';
      return `${belgeden}<input type="search" id="s_ara" aria-label="Suç adı veya TCK maddesi" class="buyuk-girdi" placeholder="hırsızlık, 142, 87/2-d…" value="${esc(sorgu)}" autocomplete="off">
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
      if (d.konum === 'cezaevinde') return `<input type="date" id="s_tarih" aria-label="${esc(metin(s.baslik, d))}" class="buyuk-girdi" value="${esc(d.giris?.tarih || '')}">`;
      const tarihli = durum.girisTarihli || d.giris?.tur === 'tarih';
      return `<div class="secenekler iki">
          <button type="button" class="secenek${d.giris?.tur === 'bugun' ? ' secili' : ''}" data-giris="bugun"><b>Bugün</b><small>${esc(tr(T.bugunIstanbul()))}</small></button>
          <button type="button" class="secenek${tarihli ? ' secili' : ''}" data-giris="tarih"><b>Tarih seç</b><small>Bilinen giriş günü</small></button>
        </div>
        <input type="date" id="s_tarih" aria-label="${esc(metin(s.baslik, d))}" class="buyuk-girdi${tarihli ? '' : ' gizli'}" value="${esc(d.giris?.tarih || '')}">`;
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
  return k.tur === 'konutu_terk_etmeme' ? `${g.takvim} gün → ${g.dusulen.toLocaleString('tr-TR')} gün${Number.isInteger(g.dusulen) ? ' düşülür' : ' (kesir toplamda yuvarlanır)'}` : `${g.takvim} gün cezadan düşülür`;
}

// Mahsup satırlarını okur. Boş satır atlanır; eksik/ters tarih → { hata }.
export function mahsupOku() {
  const liste = [];
  for (const satir of document.querySelectorAll('.mahsup-satir')) {
    if (!satir.querySelector('[data-m="gun"]').validity.valid) return { hata: 'Gün sayısını geçerli bir tam sayı olarak girin.' };
    const v = (m) => satir.querySelector(`[data-m="${m}"]`).value.trim();
    const k = { tur: v('tur') };
    const gun = v('gun');
    const bas = v('baslangic');
    const bit = v('bitis');
    if (gun) {
      const n = Number(gun);
      if (!Number.isSafeInteger(n) || n < 0 || !satir.querySelector('[data-m="gun"]').validity.valid) return { hata: 'Gün sayısını geçerli bir tam sayı olarak girin.' };
      if (n > 0) liste.push({ ...k, gun: n });
    } else if (bas || bit) {
      if (!T.gecerliTarih(bas) || !T.gecerliTarih(bit)) return { hata: 'Tarih aralığının iki ucunu da girin ya da gün sayısı yazın.' };
      if (bit < bas) return { hata: 'Bitiş tarihi başlangıçtan önce olamaz.' };
      liste.push({ ...k, baslangic: bas, bitis: bit });
    }
  }
  const araliklar = liste.filter((k) => k.baslangic).sort((a,b) => a.baslangic.localeCompare(b.baslangic));
  let son = null;
  for (const k of araliklar) {
    if (son && k.baslangic <= son) return { hata: 'Mahsup tarih aralıkları çakışıyor; aynı gün iki kez sayılamaz.' };
    if (!son || k.bitis > son) son = k.bitis;
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

// o: soru örneği { s, i, g } (g ilam görünümü). durum.ilamBaglam: birden çok ilamda başlık.
export function soruCiz(o, durum) {
  const s = o?.s;
  const d = o?.g;
  const kart = $('soruKarti');
  if (!s) {
    kart.className = 'soru-karti bitti';
    kart.innerHTML = durum.hesaplanabilir
      ? `<div class="bitti-satir">${IKON.tamam}<div><b>Gerekli bilgiler tamam.</b><small>${durum.coklu ? 'Bir ilamın cevaplarını görmek ve değiştirmek için ilam başlığına dokunun.' : 'Bir cevabı değiştirmek için yukarıdaki kutucuklara dokunun.'}</small></div></div>`
      : '';
    return;
  }
  const temel = TEMEL_SORULAR.includes(s);
  const sira = temel ? `${durum.sira} / ${durum.toplam}` : 'Ek soru · sonucu değiştiriyor';
  const devam = DEVAM_GEREKEN.has(s.tur) || (s.tur === 'giris' && (d.konum === 'cezaevinde' || durum.girisTarihli || d.giris?.tur === 'tarih'));
  kart.className = `soru-karti${temel ? '' : ' ek'}`;
  kart.innerHTML = `
    <div class="soru-ust"><span class="sira">${esc(sira)}</span>${durum.ilerleme !== null ? `<span class="ilerleme"><i style="width:${Math.round(durum.ilerleme * 100)}%"></i></span>` : ''}</div>
    ${durum.ilamBaglam ? `<div class="ilam-baglam"><span class="ilam-no" aria-hidden="true">${durum.ilamBaglam.no}</span><div><small>${durum.ilamBaglam.no}. ilam / ${durum.ilamBaglam.toplam}</small><b>${esc(durum.ilamBaglam.ad)}</b>${durum.ilamBaglam.alt ? `<small>${esc(durum.ilamBaglam.alt)}</small>` : ''}</div></div>` : ''}
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
    const el = $(id);
    if (el && !el.validity.valid) return NaN;
    const v = el?.value.trim();
    if (!v) return 0;
    const n = Number(v);
    return Number.isSafeInteger(n) && n >= 0 ? n : NaN;
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
      try {
        if (!T.gecerliTarih(T.cezaEkle(d.giris?.tarih || T.bugunIstanbul(), c))) return null;
      } catch { return null; }
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
      if ((fikra && !/^[1-9]\d*$/.test(fikra)) || (bent && !/^[a-zçğıöşü]$/.test(bent))) return null;
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
  return `<button type="button" class="sayi-kutu ${tur}${gun ? '' : ' sifir'}${acik ? ' acik-neden' : ''}" data-neden="${tur}" aria-expanded="${acik}" aria-controls="fazGerekcesi">
    <span class="faz-no" aria-hidden="true">${{ kapali: '01', acik: '02', ds: '03' }[tur]}</span>
    <span class="ad">${ad}</span>
    <span class="deger">${gun}<small>gün</small></span>
    <span class="yaklasik">${esc(yaklasik) || '&nbsp;'}</span>
    <span class="faz-bag">${acik ? 'Kapat −' : `Neden? ${IKON.harici}`}</span>
  </button>`;
}

function nedenHtml(o, tur) {
  const faz = o.gerekce.fazlar[tur];
  const a = o.gerekce.adimlar.find((x) => x.id === faz.adim);
  return `<div class="neden-kutu ${tur}"><h3>${esc({ kapali: 'Kapalı süre nasıl bulundu?', acik: 'Açık süre nasıl bulundu?', ds: 'DS süresi nasıl bulundu?' }[tur])}</h3>
    <p>${esc(faz.metin)}</p>${a.islem ? `<p class="hesap-islem">${esc(a.islem)}</p>` : ''}
    <button type="button" class="madde-bag gerekceye-git" data-gerekce-ac="${faz.adim}">Şartları ve dayanakları incele ${IKON.ileri}</button></div>`;
}

function kaynakHtml(kaynaklar) {
  if (!kaynaklar?.length) return '';
  return `<div class="gerekce-kaynaklar"><span>Hukuki dayanak</span>${kaynaklar.map((k) => `<div><button type="button" class="kaynak-dugme" data-kural="${esc(k.id)}" title="${esc(k.ozet)}">${esc(k.ad)} <small>${esc(k.id)}</small></button>${k.madde ? `<button type="button" class="madde-bag" data-madde="${esc(k.madde)}">Madde metni ${IKON.harici}</button>` : ''}</div>`).join('')}</div>`;
}

function gerekceHtml(o) {
  return `<section class="gerekce-alani" aria-labelledby="gerekceBaslik"><div class="bolum-baslik"><div><span class="ust-etiket">SONUCUN ARKASINDAKİ HESAP</span><h2 id="gerekceBaslik">Hesabın gerekçesi</h2><p>Bilgiden sonuca, her adımın nedeni ve dayanağı.</p></div><span class="bolum-sayac">6 adım</span></div>
    ${o.gerekce.adimlar.map((a, i) => `<details class="gerekce-adim" data-gerekce="${a.id}" id="gerekce-${a.id}"><summary><span class="adim-no">${i + 1}</span><span><b>${esc(a.baslik)}</b><small>${esc(a.ozet)}</small></span><span class="ac-kapa" aria-hidden="true">+</span></summary><div class="gerekce-govde">
      ${a.satirlar?.length ? `<dl class="hesap-verileri">${a.satirlar.map((r) => `<div><dt>${esc(r.etiket)}</dt><dd>${esc(r.deger)}</dd></div>`).join('')}</dl>` : ''}
      ${a.paragraflar.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${a.sartlar?.length ? `<div class="sart-listesi"><h4>Birlikte aranan tarih şartları</h4>${a.sartlar.map((s) => `<div class="sart${s.belirleyici ? ' belirleyici' : ''}"><span>${esc(s.ad)}${s.belirleyici ? '<small>Belirleyici eşik</small>' : ''}</span><b>${esc(tr(s.tarih))}</b></div>`).join('')}<p class="ipucu">Aynı yoldaki şartların en geç tamamlandığı tarih esas alınır. Mahsupla geçmişte kalan eşikler yeni girişten önce fizikî çıkış oluşturmaz.</p></div>` : ''}
      ${a.islem ? `<p class="hesap-islem">${esc(a.islem)}</p>` : ''}
      ${a.yollar?.length ? `<h4>Diğer yollar neden seçilmedi?</h4><ul class="yol-listesi">${a.yollar.map((y) => `<li class="${y.secili ? 'secilen' : ''}"><div><b>${esc(y.ad)}</b><span class="yol-durum">${esc(y.durum)}</span></div>${y.tarih ? `<time>${esc(tr(y.tarih))}</time>` : ''}<p>${esc(y.neden)}</p><button type="button" class="madde-bag" data-kural="${esc(y.kural)}">Kuralı incele ${IKON.harici}</button></li>`).join('')}</ul>` : ''}
      ${a.kabuller?.length ? `<h4>Kullanılan kabuller ve bilinmeyenler</h4><ul class="gerekce-liste">${a.kabuller.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      ${a.kararlar?.length ? `<h4>Uygulamada gereken kararlar</h4><ul class="gerekce-liste">${a.kararlar.map((k) => `<li>${esc(k.metin)}</li>`).join('')}</ul>` : ''}
      ${kaynakHtml(a.kaynaklar)}
    </div></details>`).join('')}
    <button type="button" class="dugme gerekce-kopyala" data-eylem="gerekce-kopyala">${IKON.kopya} Gerekçeli metni kopyala</button>
  </section>`;
}

// Oranlar kompozisyonda görünür; burada yalnız toplam.
function dagilim(o) {
  const toplam = o.kapali + o.acik + o.ds;
  if (!toplam) return '<p class="dagilim-notu">Bu girişten sonra kalan kurum veya DS günü yok.</p>';
  return `<p class="dagilim-notu">Girişten ${o.tarihler.ks ? 'koşullu salıverilmeye' : 'çıkışa'} kadar ${toplam} gün · mahsup sonrası kalan süre</p>`;
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

// Toplanan cezalarda ilam başına ceza, gün, oran ve KS payı.
function ilamDokumu(t) {
  // Üç sütun: telefonda yana kaydırmadan okunur. KS payı, oranıyla birlikte.
  const satir = (k) => `<tr><th scope="row">${esc(siraliIlamAdi(k.sira, k.etiket))}<small>suç ${esc(tr(k.suc_tarihi))}${k.tekerrur !== 'yok' ? ` · ${k.tekerrur === 'birinci' ? '1.' : '2.'} tekerrür` : ''}${k.para_hapis ? ' · paradan çevrilen' : ''}</small></th><td>${esc(T.cezaMetni(k.ceza))}<small>${k.gun} gün</small></td><td class="sayi">${esc(k.ks_pay)}<small>${esc(k.oran)} oranla</small></td></tr>`;
  return `<section class="ilam-dokumu"><h3 class="kiyas-baslik">İlam dökümü · toplanarak infaz</h3>
    <div class="md-tablo-kaydir" tabindex="0" role="region" aria-label="İlam dökümü"><table class="md-tablo"><thead><tr><th scope="col">İlam</th><th scope="col">Ceza</th><th scope="col" class="sayi">KS payı (gün)</th></tr></thead>
    <tbody>${t.ilamlar.map(satir).join('')}</tbody>
    <tfoot><tr><th scope="row">Toplam · ${t.ilam_sayisi} ilam</th><td>${esc(T.cezaMetni(t.toplam_ceza))}<small>${t.toplam_gun} gün</small></td><td class="sayi">${t.ks_gun}${t.tavan ? '<small>107/3-4 tavanı</small>' : ''}</td></tr></tfoot></table></div>
    <p class="ipucu">Her ilamın KS oranı kendi suç tarihi, maddesi ve tekerrürüne göre belirlenir; paylar toplanır (5275 m.99, 107/3-4).</p></section>`;
}

export function muddetnameTablosu(satirlar) {
  const farkli = satirlar.filter((r) => r.fark);
  const govde = satirlar
    .map((r) => {
      const fark = r.fark === null ? '' : r.fark === 0 ? '<span class="fark ayni">aynı</span>' : `<span class="fark">${r.fark > 0 ? '+' : '−'}${Math.abs(r.fark)} gün</span>`;
      return `<tr><th>${esc(r.kisa)}</th><td>${esc(tr(r.hesap))}</td><td>${r.muddetname ? esc(tr(r.muddetname)) : '<span class="silik">—</span>'}</td><td>${fark}</td></tr>`;
    })
    .join('');
  return `<div class="md-tablo-kaydir" tabindex="0" role="region" aria-label="Müddetname tarih karşılaştırması; yatay kaydırılabilir"><table class="md-tablo"><caption class="yalniz-okuyucu">Hesap ve müddetname tarihlerinin karşılaştırması</caption><thead><tr><th scope="col">Aşama</th><th scope="col">Hesap</th><th scope="col">Müddetname</th><th scope="col">Fark</th></tr></thead><tbody>${govde}</tbody></table></div>
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
  const acikAdimlar = el.dataset.senaryo === o.senaryo ? [...el.querySelectorAll('[data-gerekce][open]')].map((d) => d.dataset.gerekce) : [];
  el.dataset.senaryo = o.senaryo || '';
  if (o.durum === 'bos' || o.durum === 'kapsam_disi') {
    el.innerHTML = `<div class="sonuc-bos${o.durum === 'kapsam_disi' ? ' kapsam-disi' : ''}">${o.durum === 'bos' ? `<div class="bos-resim">${bosKompozisyon()}</div>` : ''}<span class="ust-etiket">İNFAZ ÇALIŞMA ALANI</span><h2>${o.durum === 'kapsam_disi' ? 'Kapsam dışı suç tarihi' : 'Bir dosya, anlaşılır bir hesap.'}</h2><p>${esc(o.mesaj)}</p>${o.durum === 'bos' ? '<div class="bos-fazlar"><span>01 Kapalı</span><span>02 Açık</span><span>03 Denetimli serbestlik</span></div><small>Bilgileri sırayla girin; süreler, tarihler ve gerekçeleri birlikte oluşsun.</small>' : ''}</div>`;
    return;
  }
  const parca = [];
  if (o.durum === 'hesaplanamadi') {
    parca.push(`<section class="sonuc-kart"><div class="sonuc-ust"><span class="etiket">${esc(o.baslik)}</span></div><p class="hesaplanamadi" role="alert">${esc(o.mesaj)}</p></section>`);
  } else {
    const ozet = [];
    if (o.kapali) ozet.push(`${o.kapali} gün kapalı`);
    if (o.acik) ozet.push(`${o.acik} gün açık`);
    const cumle = `${ozet.length ? ozet.join(', ') + ' cezaevinde' : 'Cezaevinde kalmaz'}${o.ds ? `, sonra ${o.ds} gün denetimli serbestlik` : ''}.`;
    parca.push(`<section class="sonuc-kart">
      <div class="sonuc-ust">
        <span class="etiket">${esc(o.baslik)} · iyi hâl şartıyla</span>
        ${onSonuc ? '<span class="rozet on-sonuc" title="Sorular tamamlanınca güncellenir">ön sonuç</span>' : o.en_cok ? '<span class="rozet en-cok" title="Bilinmeyen bilgiler aleyhe kabul edildi">en çok</span>' : ''}
      </div>
      <div class="tahliye-vitrin"><span class="ust-etiket">${onSonuc ? 'BİLGİLER TAMAMLANMADAN ÖN SONUÇ' : o.en_cok ? 'MEVCUT KABULLERLE ÖNGÖRÜLEN ÇIKIŞ' : 'İYİ HÂL VE GEREKLİ KARARLARLA İLK ÇIKIŞ'}</span><time datetime="${esc(o.tarihler.cikis)}">${esc(tr(o.tarihler.cikis))}</time>${sonucKompozisyonu(o)}<span class="uygulanan-yol">${esc(o.gerekce.yol)}</span></div>
      <p class="cumle" role="status" aria-atomic="true">${esc(cumle)}</p>
      <div class="uc-sayi">
        ${sayiKutusu('kapali', 'Kapalı', o.kapali, acikNeden === 'kapali')}
        ${sayiKutusu('acik', 'Açık', o.acik, acikNeden === 'acik')}
        ${sayiKutusu('ds', 'Denetimli serbestlik', o.ds, acikNeden === 'ds')}
      </div>
      <div id="fazGerekcesi">${acikNeden ? nedenHtml(o, acikNeden) : '<p class="ipucu ortali">Bir süreye dokunun, nasıl hesaplandığını görün.</p>'}</div>
      ${dagilim(o)}
      <div class="cizelge-baslik"><h3>İnfaz takvimi</h3><span>Girişten ceza bitimine</span></div>${cizelge(o.olaylar)}
      ${o.talepsiz ? `<p class="talepsiz"><b>Denetimli serbestliği talep etmezse:</b> ${esc(tr(o.talepsiz.cikis))} tarihinde ${o.talepsiz.ks ? 'koşullu salıverilme ile' : 'ceza bitiminde'} çıkar · ${o.talepsiz.icerde} gün cezaevinde${o.talepsiz.kapali && o.talepsiz.acik ? ` (${o.talepsiz.kapali} kapalı, ${o.talepsiz.acik} açık)` : ''}.</p>` : ''}
      ${o.en_cok ? '<p class="not-satiri">Bazı bilgiler bilinmediği için aleyhe hesaplandı; süre daha kısa olabilir.</p>' : ''}
      <div class="eylemler">
        <button type="button" class="dugme" data-eylem="kopyala">${IKON.kopya}<span>Kopyala</span></button>
        ${paylasVar ? `<button type="button" class="dugme" data-eylem="paylas">${IKON.paylas}<span>Paylaş</span></button>` : ''}
      </div>
    </section>`);
    parca.push(gerekceHtml(o));
  }
  if (!gorunen) parca.push(muddetnameKarti(muddetname, md));
  parca.push(o.toplama ? ilamDokumu(o.toplama) : karsilastirmaHtml(o, gorunen));
  if (o.varsayimlar.length) {
    parca.push(`<div class="varsayimlar"><h3>Bilinmeyenler</h3><ul>${o.varsayimlar.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div>`);
  }
  if (o.dikkat.length) {
    parca.push(`<details class="katlanir dikkat"><summary>Dikkat edilmesi gerekenler <span class="sayac">${o.dikkat.length}</span></summary><ul>${o.dikkat.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></details>`);
  }
  if (o.adimlar?.length) {
    parca.push(`<details class="katlanir hesap-izi"><summary>Teknik hesap izi</summary><ol class="adimlar">${o.adimlar.map((v) => `<li>${esc(v)}</li>`).join('')}</ol></details>`);
  }
  parca.push('<p class="yasal">Ön değerlendirmedir; iyi hâl, açığa ayrılma ve DS kurum ile hâkimlik kararlarına bağlıdır. Resmî müddetnamenin yerine geçmez.</p>');
  el.innerHTML = parca.join('');
  for (const id of acikAdimlar) el.querySelector(`[data-gerekce="${id}"]`)?.setAttribute('open', '');
}

