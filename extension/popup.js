import { hesapla, KuralTabani, SENARYOLAR, adayMetni, tarih as T } from './engine/index.js';
import { TCK_MADDELERI } from './data/tck_maddeleri.js';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const DURUM_ETIKETI = {
  varsayimli_senaryo: 'Varsayımlı senaryo',
  hukuki_inceleme_gerekli: 'Hukuki inceleme gerekli',
  eksik_veri: 'Eksik veri',
  uygulanamaz: 'Uygulanamaz',
};
const SEVIYE_ETIKETI = { inceleme: 'Hukuki inceleme', varsayim: 'Varsayım', bilgi: 'Bilgi', eksik: 'Eksik veri' };
const DOGRULAMA_ETIKETI = {
  resmi_metin: ['Resmî metin', 'tamam'],
  resmi_indeks: ['Resmî indeks', 'varsayim'],
  hukuki_modelleme: ['Hukuki modelleme', 'varsayim'],
  erisilemedi: ['Tam metne erişilemedi', 'inceleme'],
  karar_gerektirir: ['Karar gerektirir', 'inceleme'],
};
const MADDE_ADLARI = new Map(TCK_MADDELERI);
const chromeApi = globalThis.chrome;
const tamEkran = new URLSearchParams(location.search).has('tam');

let db = null;
let kt = null;
let sonVaka = null;
let sonCikti = null;
let izSekme = 'yok';
let zamanlayici = null;

// ---------------------------------------------------------------------------
// Kalıcı form durumu (yalnız bu tarayıcıda; hiçbir sunucuya gönderilmez)
// ---------------------------------------------------------------------------

const depo = {
  async oku() {
    try {
      if (chromeApi?.storage?.local) return (await chromeApi.storage.local.get('form')).form || null;
    } catch {}
    try {
      return JSON.parse(localStorage.getItem('infaz-form') || 'null');
    } catch {
      return null;
    }
  },
  async yaz(deger) {
    try {
      if (chromeApi?.storage?.local) return await chromeApi.storage.local.set({ form: deger });
    } catch {}
    try {
      localStorage.setItem('infaz-form', JSON.stringify(deger));
    } catch {}
  },
};

function formAlanlari() {
  return [...document.querySelectorAll('main input[id], main select[id]')];
}

function formDurumu() {
  const alanlar = {};
  for (const el of formAlanlari()) alanlar[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  const onceki = [...document.querySelectorAll('#oncekiListe .onceki')].map((kart) => {
    const o = {};
    kart.querySelectorAll('[data-a]').forEach((el) => (o[el.dataset.a] = el.type === 'checkbox' ? el.checked : el.value));
    return o;
  });
  return { alanlar, onceki };
}

function formuDoldur(durum) {
  if (!durum) return;
  for (const el of formAlanlari()) {
    if (!(el.id in (durum.alanlar || {}))) continue;
    if (el.type === 'checkbox') el.checked = !!durum.alanlar[el.id];
    else el.value = durum.alanlar[el.id];
  }
  $('oncekiListe').innerHTML = '';
  (durum.onceki || []).forEach((o) => oncekiKartEkle(o));
}

// ---------------------------------------------------------------------------
// Formdan vaka nesnesi
// ---------------------------------------------------------------------------

function sayi(deger) {
  const v = String(deger ?? '').trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

const uc = (v) => (v === 'evet' ? true : v === 'hayir' ? false : null);

function cezaOku(yil, ay, gun) {
  const p = [sayi(yil), sayi(ay), sayi(gun)];
  if (p.every((x) => x === null)) return null;
  return { yil: p[0] ?? 0, ay: p[1] ?? 0, gun: p[2] ?? 0 };
}

// "87/2-d" gibi tek alana yazılan madde/fıkra/bent ayrıştırılır.
function maddeAyristir() {
  let madde = $('madde').value.trim();
  let fikra = $('fikra').value.trim();
  let bent = $('bent').value.trim();
  const m = /^(\d+)\s*(?:\/\s*(\d+))?\s*(?:[-.]\s*([a-zçğıöşü]))?$/i.exec(madde);
  if (m) {
    madde = m[1];
    if (!fikra && m[2]) fikra = m[2];
    if (!bent && m[3]) bent = m[3].toLowerCase();
  }
  return { madde: madde || null, fikra: fikra || null, bent: bent || null };
}

function oncekiOku() {
  return [...document.querySelectorAll('#oncekiListe .onceki')].map((kart, i) => {
    const d = (a) => kart.querySelector(`[data-a="${a}"]`);
    return {
      ilam_id: `Önceki-${i + 1}`,
      suc_tarihi: d('suc_tarihi').value || null,
      kesinlesme_tarihi: d('kesinlesme_tarihi').value || null,
      ceza_turu: d('ceza_turu').value,
      ceza: cezaOku(d('yil').value, d('ay').value, d('gun').value),
      kast_turu: d('kast_turu').value || null,
      infaz_durumu: d('infaz_durumu').value || null,
      infaz_tamamlanma_tarihi: d('infaz_tamamlanma_tarihi').value || null,
      tekerrur_uygulanmis_mi: uc(d('tekerrur_uygulanmis_mi').value),
      karar_turu: d('karar_turu').value,
      tekerrure_esas_olamaz: uc(d('tekerrure_esas_olamaz').value),
      yabanci_mahkeme_karari: uc(d('yabanci_mahkeme_karari').value),
      yabanci_istisna_sucu: uc(d('yabanci_istisna_sucu').value),
      suclunun_o_tarihteki_yasi: sayi(d('suclunun_o_tarihteki_yasi').value) ?? undefined,
      sirf_askeri_suc: d('sirf_askeri_suc').checked,
    };
  });
}

function vakaOku() {
  const cezaTuru = $('ceza_turu').value;
  const kanunSecim = $('kanun').value;
  const kanun = kanunSecim === 'diger' ? sayi($('kanun_no').value) : Number(kanunSecim);
  const mahsup = sayi($('mahsup_gun').value);
  return {
    hesap_tarihi: $('hesap_tarihi').value || undefined,
    infaza_baslama_tarihi: $('infaza_baslama_tarihi').value || null,
    mahsup_gun: Number.isInteger(mahsup) ? mahsup : undefined,
    dogum_tarihi: $('dogum_tarihi').value || null,
    cinsiyet: $('cinsiyet').value || null,
    kadin_0_6_cocuk: $('kadin_0_6_cocuk').checked || null,
    agir_hasta_yalniz_yasayamaz: $('agir_hasta_yalniz_yasayamaz').checked || null,
    iyi_hal_karari: $('iyi_hal_karari').checked || null,
    yuvarlama: $('yuvarlama').value,
    tekerrure_esas_en_agir_ceza: cezaOku($('esas_yil').value, $('esas_ay').value, $('esas_gun').value),
    onceki_mahkumiyet_kayitlari_tam_mi: $('kayit_tam').checked ? true : null,
    onceki_mahkumiyetler: oncekiOku(),
    ilam: {
      ilam_id: 'İlam-1',
      suc_tarihi: $('suc_tarihi').value || null,
      hukumdeki_sonuc_ceza: cezaOku($('ceza_yil').value, $('ceza_ay').value, $('ceza_gun').value),
      kanun_madde_fikra_bent: { kanun: Number.isInteger(kanun) ? kanun : null, ...maddeAyristir() },
      kast_turu: $('kast_turu').value || 'bilinmiyor',
      ceza_turu: cezaTuru === 'adli_paradan_cevrilen' ? 'sureli_hapis' : cezaTuru,
      para_cezasindan_cevrilme: cezaTuru === 'adli_paradan_cevrilen' ? true : null,
      teror_kanunu_kapsami: uc($('teror_kanunu_kapsami').value),
      orgut_faaliyeti: uc($('orgut_faaliyeti').value),
      orgut_kurma_yonetme: uc($('orgut_kurma_yonetme').value),
      orgut_uyelik: uc($('orgut_uyelik').value),
      magdur_yakin_veya_savunmasiz: uc($('magdur_yakin_veya_savunmasiz').value),
      deprem_yapi_olumu_baglantisi: uc($('deprem_yapi_olumu_baglantisi').value),
      ks_geri_alindi: uc($('ks_geri_alindi').value),
      hukumdeki_tekerrur: $('hukumdeki_tekerrur').value || null,
      kesinlesme_tarihi: $('kesinlesme_tarihi').value || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Gösterim yardımcıları
// ---------------------------------------------------------------------------

function cip(sinif, metin, baslik = '') {
  return `<span class="cip ${esc(sinif)}"${baslik ? ` title="${esc(baslik)}"` : ''}>${esc(metin)}</span>`;
}

function kuralCipi(id) {
  if (!kt.kurallar.has(id)) return cip('kural', id);
  const o = kt.kuralOzeti(id);
  return cip('kural', id, `${o.mevzuat.join(', ')} — ${o.ozet}`);
}

function konuCipi(id) {
  const q = kt.acikKonular.get(id);
  if (q) return cip('inceleme', id, `${q.konu}: ${q.neden}`);
  const e = kt.hataKodlari[id];
  return cip(e ? 'varsayim' : 'bilgi', id, e || '');
}

const trT = (s) => (s ? T.trTarih(s) : '—');

function nitelik(S) {
  if (S.alt_sinir && S.en_cok) return 'Aralık belirsiz';
  if (S.alt_sinir) return 'En az';
  if (S.en_cok) return 'En çok';
  return '';
}

function senaryoKarti(anahtar, S, c) {
  const tanim = SENARYOLAR.find((s) => s.anahtar === anahtar);
  if (!S) {
    return `<article class="senaryo pasif"><div class="senaryo-ust"><h3>${esc(tanim.baslik)}</h3></div>
      <div class="buyuk"><span class="sayi">—</span></div><p class="uygulanamaz-neden">Suç tarihi ve ceza girildiğinde hesaplanır.</p></article>`;
  }
  const secili = c.secili_senaryo === anahtar;
  const rozet = secili ? `<span class="rozet-secili">${c.tekerrur.hukumde_uygulanan === anahtar ? 'Hükümdeki' : 'Belgelerden aday'}</span>` : '';
  const ust = `<div class="senaryo-ust"><div><h3>${esc(S.baslik)}</h3>${cip(S.durum, DURUM_ETIKETI[S.durum] || S.durum)}</div>${rozet}</div>`;

  if (!S.uygulanabilir || S.hesaplanamadi || S.kurumda_kalis_gun === null) {
    return `<article class="senaryo pasif${secili ? ' secili' : ''}">${ust}<div class="buyuk"><span class="sayi">—</span></div>
      <p class="uygulanamaz-neden">${esc(S.neden || 'Bu senaryo hesaplanamadı.')}</p></article>`;
  }

  const t = S.takvim;
  const satirlar = [];
  if (S.oran) satirlar.push(['KS oranı', `${S.oran}`]);
  if (S.ks_ham_gun) satirlar.push(['KS süresi', `${S.ks_ham_gun.ondalik()} → ${S.ks_gun} gün`]);
  if (S.asgari_kurum) satirlar.push(['Asgari kurum', S.asgari_kurum.uygulanir ? `${S.asgari_kurum.gun} gün` : 'Uygulanmaz']);
  if (S.ds_penceresi) satirlar.push(['DS penceresi', S.ds_penceresi.yil === null ? 'Sınırsız' : `${S.ds_penceresi.yil} yıl`]);
  satirlar.push(['DS’ye ayrılma', trT(t.DSye_hak_kazanma)]);
  satirlar.push(['Koşullu salıverilme', trT(t.kosullu_saliverilme)]);
  satirlar.push(['Hak ederek tahliye', trT(t.hak_ederek_tahliye)]);
  if (t.mahsup_gun) satirlar.push(['Mahsup dahil infaz', `${S.toplam_infaz_gun} gün`]);

  const ek = [];
  if (S.ust_sinir_108_2) {
    ek.push(`<div class="alternatif">108/2 üst sınırı: temel KS + ${esc(T.cezaMetni(S.ust_sinir_108_2.ceza))} (${S.ust_sinir_108_2.gun} gün) = ${esc(S.ust_sinir_108_2.ust_sinir.ondalik())} gün</div>`);
  }
  for (const y of S.alternatif_yollar) {
    ek.push(`<div class="alternatif"><b>Alternatif · ${esc(y.yol)}:</b> ${y.kurumda_kalis_gun} gün (${esc(trT(y.tarih))}) ${cip('hukuki_inceleme_gerekli', 'İnceleme')}<br>${esc(y.aciklama)}</div>`);
  }

  const nit = nitelik(S);
  const gun = S.kurumda_kalis_gun;
  return `<article class="senaryo${secili ? ' secili' : ''}">${ust}
    <div>
      <div class="buyuk">${nit ? `<span class="nitelik">${esc(nit)}</span>` : ''}<span class="sayi">${gun}</span><span class="birim">gün</span></div>
      <div class="buyuk-alt">kurumda kalış${gun >= 60 ? ` (${esc(T.gunMetni(gun))})` : ''} · çıkış ${esc(trT(t.kurumdan_cikis))}</div>
    </div>
    <dl class="ozet">${satirlar.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
    ${ek.join('')}
  </article>`;
}

function durumBandi(c) {
  const el = $('durumBandi');
  el.className = `durum-bandi var ${c.durum}`;
  let metin = '';
  if (c.durum === 'eksik_veri') {
    metin = c.eksik_veri.map((e) => esc(e.mesaj)).join('<br>');
  } else if (c.durum === 'hukuki_inceleme_gerekli') {
    metin = 'Seçili senaryoda yazılımın tek başına sonuçlandıramayacağı konular var; sayılar ön değerlendirmedir.';
  } else {
    metin = `Sonuç ${c.hukuki_kabuller.length} varsayıma dayanır; ayrıntılar “Varsayımlar ve uyarılar” bölümünde.`;
  }
  const konular = [...c.engelleyici_konu_idleri, ...c.hata_kodlari];
  el.innerHTML = `<strong>${esc(DURUM_ETIKETI[c.durum])}:</strong> ${metin}${konular.length ? `<div class="konular">${konular.map(konuCipi).join('')}</div>` : ''}`;
}

function rejimBolumu(c) {
  const el = $('rejim');
  if (!c.rejim.length) {
    el.innerHTML = '<h3>Suç tarihine göre rejim</h3><p class="aciklama">Suç tarihi girildiğinde uygulanan tarih eşikleri burada listelenir.</p>';
    return;
  }
  const oran = c.temel_oran
    ? `<span>Temel KS oranı: <b>${esc(c.temel_oran.oran.toString())}</b> ${kuralCipi(c.temel_oran.kural_id)} <span class="ipucu">${esc(c.temel_oran.neden)}</span></span>`
    : '';
  const ds = c.ds_penceresi ? `<span>DS penceresi: <b>${c.ds_penceresi.yil === null ? 'sınırsız' : c.ds_penceresi.yil + ' yıl'}</b> ${kuralCipi(c.ds_penceresi.kural)} <span class="ipucu">${esc(c.ds_penceresi.ad)}</span></span>` : '';
  const konumMetni = { once: 'öncesi', sonra: 'sonrası', ayni_gun: 'aynı gün' };
  el.innerHTML = `<h3>Suç tarihine göre rejim</h3>
    <div class="oran-ozet">${oran}${ds}</div>
    <ul class="esikler">${c.rejim
      .map((r) => `<li><span>${esc(T.trTarih(r.tarih))}</span><span class="konum ${r.konum}">${konumMetni[r.konum]}</span><span>${esc(r.anlam)}</span></li>`)
      .join('')}</ul>`;
}

function tekerrurBolumu(c) {
  const t = c.tekerrur;
  const kartlar = [...document.querySelectorAll('#oncekiListe .onceki')];
  kartlar.forEach((kart, i) => {
    const d = t.degerlendirmeler.find((x) => x.sira === i + 1);
    kart.querySelector('.onceki-no').textContent = `Önceki mahkûmiyet ${i + 1}`;
    const durumEl = kart.querySelector('.onceki-durum');
    const nedenEl = kart.querySelector('.onceki-nedenler');
    if (!d) {
      durumEl.innerHTML = '';
      nedenEl.innerHTML = '';
      return;
    }
    const etiket = { esas: ['Tekerrüre esas', 'tamam'], esas_degil: ['Esas alınamaz', 'inceleme'], belirsiz: ['Belirsiz', 'varsayim'] }[d.sonuc];
    durumEl.innerHTML = cip(etiket[1], etiket[0]);
    nedenEl.innerHTML = d.nedenler.map((n) => `<li class="${n.etki}">${esc(n.metin)} ${kuralCipi(n.kural_id)}</li>`).join('');
  });
  $('tekerrurSayac').textContent = kartlar.length ? `(${kartlar.length} kayıt)` : '';

  const satir = [];
  satir.push(`Belgelerden aday: <b>${esc(t.belgelerden_aday_tespit ? adayMetni(t.belgelerden_aday_tespit) : 'Veri yok')}</b>`);
  satir.push(`Hükümdeki: <b>${esc(t.hukumde_uygulanan ? adayMetni(t.hukumde_uygulanan) : 'Girilmedi')}</b>`);
  if (t.uyusuyor_mu !== null) satir.push(t.uyusuyor_mu ? cip('tamam', 'Uyumlu') : cip('inceleme', 'Uyuşmazlık (E004)'));
  const alt = [];
  if (t.dayanak_ilamlar.length) alt.push(`Dayanak ilamlar: ${esc(t.dayanak_ilamlar.join(', '))}`);
  if (t.tekerrure_esas_en_agir_ceza) alt.push(`108/2 için en ağır ceza: ${esc(T.cezaMetni(t.tekerrure_esas_en_agir_ceza))} (${esc(t.tekerrure_esas_en_agir_ilam)})`);
  for (const u of t.uyarilar) alt.push(`${cip(u.kod === 'E004' ? 'inceleme' : 'varsayim', u.kod)} ${esc(u.mesaj)}`);
  $('tekerrurSonuc').innerHTML = `<div class="tekerrur-ozet">${satir.join(' · ')}${alt.length ? `<div>${alt.join('<br>')}</div>` : ''}</div>`;
}

function izBolumu(c) {
  const sekmeler = $('izSekmeleri');
  sekmeler.innerHTML = SENARYOLAR.map(
    (s) => `<button type="button" class="dugme hafif kucuk" role="tab" data-sekme="${s.anahtar}" aria-selected="${s.anahtar === izSekme}">${esc(s.baslik)}</button>`,
  ).join('');
  const S = c.senaryolar[izSekme];
  if (!S) {
    $('hesapIzi').innerHTML = '<li>Hesap yapılmadı.</li>';
    return;
  }
  const izler = S.izler.length ? S.izler : [{ adim: 'Uygulanamaz', aciklama: S.neden || '', kurallar: S.kural_idleri }];
  $('hesapIzi').innerHTML = izler
    .map((i) => `<li><span class="adim">${esc(i.adim)}:</span> ${esc(i.aciklama)} <span class="kurallar">${i.kurallar.map(kuralCipi).join('')}</span></li>`)
    .join('');
}

function notBolumu(c) {
  const gruplar = [];
  const ekle = (baslik, liste) => {
    if (!liste.length) return;
    const sirali = [...liste].sort((a, b) => ['inceleme', 'varsayim', 'bilgi'].indexOf(a.seviye) - ['inceleme', 'varsayim', 'bilgi'].indexOf(b.seviye));
    gruplar.push(`<div class="not-grup"><h3>${esc(baslik)}</h3><ul>${sirali
      .map((n) => `<li>${cip(n.seviye, SEVIYE_ETIKETI[n.seviye] || n.seviye)}${esc(n.mesaj)} ${n.kurallar.filter((k) => kt.kurallar.has(k)).map(kuralCipi).join('')}</li>`)
      .join('')}</ul></div>`);
  };
  ekle('Bütün senaryolar', c.notlar);
  for (const s of SENARYOLAR) {
    const S = c.senaryolar[s.anahtar];
    if (S && S.notlar.length) ekle(S.baslik, S.notlar);
  }
  $('notlar').innerHTML = gruplar.join('') || '<p class="aciklama">Not yok.</p>';
  const tum = [...c.notlar, ...Object.values(c.senaryolar).flatMap((s) => s.notlar)];
  const inc = tum.filter((n) => n.seviye === 'inceleme').length;
  const vrs = tum.filter((n) => n.seviye === 'varsayim').length;
  $('notSayac').textContent = tum.length ? `(${inc} inceleme · ${vrs} varsayım)` : '';
}

function ozelBolumu(c) {
  const parcalar = [];
  if (c.ozel_infaz_notlari.length) {
    parcalar.push(`<div class="not-grup"><h3>Olası başvuru yolları (karar gerektirir)</h3><ul>${c.ozel_infaz_notlari
      .map((n) => `<li><b>${esc(n.baslik)}:</b> ${esc(n.metin)} ${kuralCipi(n.kural)}</li>`)
      .join('')}</ul></div>`);
  }
  const elenen = [...c.elenen_yollar_ve_nedenleri];
  for (const S of Object.values(c.senaryolar)) for (const e of S.elenen_yollar || []) if (!elenen.some((x) => x.yol === e.yol && x.neden === e.neden)) elenen.push(e);
  if (elenen.length) {
    parcalar.push(`<div class="not-grup"><h3>Değerlendirilip elenen yollar</h3><ul>${elenen
      .map((e) => `<li><b>${esc(e.yol)}:</b> ${esc(e.neden)} ${kuralCipi(e.kural)}</li>`)
      .join('')}</ul></div>`);
  }
  if (c.toplama) parcalar.push(`<div class="not-grup"><h3>Toplama</h3><p>${esc(c.toplama.mesaj)}</p></div>`);
  $('ozelInfaz').innerHTML = parcalar.join('') || '<p class="aciklama">Suç tarihi ve ceza girildiğinde listelenir.</p>';
  $('ozelSayac').textContent = c.ozel_infaz_notlari.length ? `(${c.ozel_infaz_notlari.length})` : '';
}

function dayanakBolumu(c) {
  const kurallar = c.secilen_kural_idleri.map((id) => {
    const o = kt.kuralOzeti(id);
    const [etiket, sinif] = DOGRULAMA_ETIKETI[o.dogrulama] || [o.dogrulama, 'bilgi'];
    return `<div class="dayanak">${cip('kural', id)} ${esc(o.ozet)} ${cip(sinif, etiket)}<div class="mevzuat">${esc(o.mevzuat.join(' · '))} · Kaynak: ${esc(o.kaynak_idleri.join(', '))}</div></div>`;
  });
  const kaynaklar = c.kaynak_idleri.map((id) => kt.kaynaklar.get(id)).filter(Boolean);
  $('dayanaklar').innerHTML = `
    <p class="aciklama dogrulama-uyari">${esc(db.paket.dogrulama_siniri)}</p>
    ${kurallar.join('') || '<p class="aciklama">Hesap yapılmadı.</p>'}
    ${kaynaklar.length ? `<h3 style="margin-top:10px">Kaynaklar</h3><ul class="kaynaklar">${kaynaklar
      .map((s) => `<li><b>${esc(s.kaynak_id)}</b> <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.baslik)}</a> ${cip((DOGRULAMA_ETIKETI[s.dogrulama] || ['', 'bilgi'])[1], (DOGRULAMA_ETIKETI[s.dogrulama] || [s.dogrulama])[0])}${s.not ? `<br><span class="ipucu">${esc(s.not)}</span>` : ''}</li>`)
      .join('')}</ul>` : ''}`;
  $('dayanakSayac').textContent = c.secilen_kural_idleri.length ? `(${c.secilen_kural_idleri.length} kural · ${kaynaklar.length} kaynak)` : '';
}

function maddeIpucu() {
  const kanun = $('kanun').value;
  $('kanun_no').classList.toggle('gizli', kanun !== 'diger');
  const { madde, fikra, bent } = maddeAyristir();
  let metin = '';
  if (kanun === '5237' && madde) {
    const ad = MADDE_ADLARI.get(madde);
    metin = `TCK m.${madde}${fikra ? '/' + fikra : ''}${bent ? '-' + bent : ''}${ad ? ' · ' + ad : ''}`;
  } else if (kanun === '2937') {
    metin = '2937 ceza hükümleri otomatik eşleştirilmez; doğrulama gerekir.';
  }
  $('maddeAdi').textContent = metin;
  document.querySelectorAll('.kosullu').forEach((el) => {
    el.classList.toggle('goster', kanun === '5237' && !!madde && el.dataset.madde.split(',').includes(madde));
  });
  const dolu = [...document.querySelectorAll('#ayrintiBolumu input, #ayrintiBolumu select')].filter((el) =>
    el.type === 'checkbox' ? el.checked : el.id !== 'yuvarlama' && el.value !== '',
  ).length;
  $('ayrintiSayac').textContent = dolu ? `(${dolu} alan dolu)` : '';
}

// ---------------------------------------------------------------------------
// Hesap ve çizim
// ---------------------------------------------------------------------------

function hesaplaVeCiz() {
  maddeIpucu();
  sonVaka = vakaOku();
  try {
    sonCikti = hesapla(kt, sonVaka);
  } catch (hata) {
    console.error(hata);
    $('durumBandi').className = 'durum-bandi var hukuki_inceleme_gerekli';
    $('durumBandi').textContent = `Hesap hatası: ${hata.message}`;
    return;
  }
  const c = sonCikti;
  durumBandi(c);
  $('senaryolar').innerHTML = SENARYOLAR.map((s) => senaryoKarti(s.anahtar, c.senaryolar[s.anahtar], c)).join('');
  rejimBolumu(c);
  tekerrurBolumu(c);
  izBolumu(c);
  notBolumu(c);
  ozelBolumu(c);
  dayanakBolumu(c);
  $('sonucEtiketi').textContent = c.sonuc_etiketi;
}

function planla() {
  clearTimeout(zamanlayici);
  zamanlayici = setTimeout(() => {
    hesaplaVeCiz();
    depo.yaz(formDurumu());
  }, 80);
}

function oncekiKartEkle(deger = null) {
  const parca = $('oncekiSablon').content.cloneNode(true);
  const kart = parca.querySelector('.onceki');
  if (deger) {
    kart.querySelectorAll('[data-a]').forEach((el) => {
      if (!(el.dataset.a in deger)) return;
      if (el.type === 'checkbox') el.checked = !!deger[el.dataset.a];
      else el.value = deger[el.dataset.a];
    });
  }
  kart.querySelector('.sil').addEventListener('click', () => {
    kart.remove();
    planla();
  });
  $('oncekiListe').appendChild(parca);
}

// ---------------------------------------------------------------------------
// Dışa aktarım
// ---------------------------------------------------------------------------

function ozetMetni() {
  const c = sonCikti;
  const v = sonVaka;
  if (!c) return '';
  const i = v.ilam;
  const mfb = i.kanun_madde_fikra_bent;
  const satir = [
    'İNFAZ ÖN DEĞERLENDİRMESİ (kesin tahliye hesabı değildir)',
    `Suç tarihi: ${trT(i.suc_tarihi)} · Ceza: ${i.hukumdeki_sonuc_ceza ? T.cezaMetni(i.hukumdeki_sonuc_ceza) : '—'}${mfb.madde ? ` · ${mfb.kanun === 5237 ? 'TCK' : mfb.kanun} m.${mfb.madde}${mfb.fikra ? '/' + mfb.fikra : ''}${mfb.bent ? '-' + mfb.bent : ''}` : ''}`,
    `İnfaza başlama: ${trT(c.senaryolar.yok?.takvim?.infaza_baslama)} · Mahsup: ${v.mahsup_gun ?? 0} gün · Hesap tarihi: ${trT(c.hesap_tarihi)}`,
    `Genel durum: ${DURUM_ETIKETI[c.durum]}`,
    '',
  ];
  for (const s of SENARYOLAR) {
    const S = c.senaryolar[s.anahtar];
    if (!S) continue;
    if (!S.uygulanabilir || S.kurumda_kalis_gun === null) {
      satir.push(`${S.baslik}: — (${S.neden || DURUM_ETIKETI[S.durum]})`);
      continue;
    }
    const n = nitelik(S);
    satir.push(
      `${S.baslik}${c.secili_senaryo === s.anahtar ? ' [seçili]' : ''}: ${n ? n.toLowerCase() + ' ' : ''}${S.kurumda_kalis_gun} gün kurumda` +
        `${S.oran ? ` · KS oranı ${S.oran}` : ''} · DS ${trT(S.takvim.DSye_hak_kazanma)} · KS ${trT(S.takvim.kosullu_saliverilme)} · ${DURUM_ETIKETI[S.durum]}`,
    );
    for (const y of S.alternatif_yollar) satir.push(`   Alternatif ${y.yol}: ${y.kurumda_kalis_gun} gün (hukuki inceleme)`);
  }
  satir.push('');
  if (c.engelleyici_konu_idleri.length) satir.push(`Açık konular: ${c.engelleyici_konu_idleri.join(', ')}`);
  if (c.hata_kodlari.length) satir.push(`Uyarı kodları: ${c.hata_kodlari.join(', ')}`);
  satir.push(`Dayanak kurallar: ${c.secilen_kural_idleri.join(', ')}`);
  satir.push(`Kural tabanı: ${c.paket_surumu}`);
  satir.push(c.sonuc_etiketi);
  return satir.join('\n');
}

function bildir(metin) {
  const el = document.createElement('div');
  el.className = 'bildirim';
  el.textContent = metin;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

async function kopyala() {
  const metin = ozetMetni();
  try {
    await navigator.clipboard.writeText(metin);
    bildir('Özet panoya kopyalandı');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = metin;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    bildir('Özet panoya kopyalandı');
  }
}

function jsonIndir() {
  const veri = {
    olusturma: new Date().toISOString(),
    kural_tabani: { ad: db.paket.ad, surum: db.paket.surum, hazirlanma_tarihi: db.paket.hazirlanma_tarihi },
    vaka: sonVaka,
    cikti: sonCikti,
  };
  const blob = new Blob([JSON.stringify(veri, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `infaz-on-degerlendirme-${sonCikti?.hesap_tarihi || 'hesap'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function sayfaAc(sorgu) {
  const yol = `popup.html?${sorgu}`;
  if (chromeApi?.tabs?.create && chromeApi?.runtime?.getURL) chromeApi.tabs.create({ url: chromeApi.runtime.getURL(yol) });
  else window.open(yol, '_blank');
}

function yazdir() {
  if (tamEkran) {
    document.querySelectorAll('details.bolum').forEach((d) => (d.open = true));
    window.print();
  } else {
    depo.yaz(formDurumu()).then(() => sayfaAc('tam=1&yazdir=1'));
  }
}

// ---------------------------------------------------------------------------
// Başlatma
// ---------------------------------------------------------------------------

async function baslat() {
  if (tamEkran) {
    document.body.classList.add('tam');
    $('tamEkran').classList.add('gizli');
  }
  $('maddeListesi').innerHTML = TCK_MADDELERI.map(([m, ad]) => `<option value="${esc(m)}">${esc(ad)}</option>`).join('');

  try {
    db = await (await fetch('data/kural_tabani.json')).json();
    kt = new KuralTabani(db);
  } catch (hata) {
    $('paketBilgi').textContent = 'Kural tabanı yüklenemedi.';
    $('durumBandi').className = 'durum-bandi var hukuki_inceleme_gerekli';
    $('durumBandi').textContent = `Kural tabanı okunamadı: ${hata.message}`;
    return;
  }
  $('paketBilgi').textContent = `Kural tabanı ${db.paket.surum} · ${T.trTarih(db.paket.hazirlanma_tarihi)} · ${db.kurallar.length} kural · yerel hesap`;
  $('hesap_tarihi').placeholder = T.bugunIstanbul();

  formuDoldur(await depo.oku());

  document.querySelector('main').addEventListener('input', planla);
  document.querySelector('main').addEventListener('change', planla);
  $('izSekmeleri').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sekme]');
    if (!b) return;
    izSekme = b.dataset.sekme;
    izBolumu(sonCikti);
  });
  $('oncekiEkle').addEventListener('click', () => {
    oncekiKartEkle();
    $('tekerrurBolumu').open = true;
    planla();
  });
  $('sifirla').addEventListener('click', () => {
    for (const el of formAlanlari()) {
      if (el.type === 'checkbox') el.checked = false;
      else if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    }
    $('oncekiListe').innerHTML = '';
    planla();
  });
  $('tamEkran').addEventListener('click', () => depo.yaz(formDurumu()).then(() => sayfaAc('tam=1')));
  $('kopyala').addEventListener('click', kopyala);
  $('jsonIndir').addEventListener('click', jsonIndir);
  $('yazdir').addEventListener('click', yazdir);

  hesaplaVeCiz();
  if (!$('suc_tarihi').value) $('suc_tarihi').focus();
  if (new URLSearchParams(location.search).has('yazdir')) setTimeout(yazdir, 300);
}

baslat();
