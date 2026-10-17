// Hesap ve Gerekçe sekmelerinin çizimi. Bu modül yalnız çıktı modelini görselleştirir;
// hukuki karar vermez.

import { SENARYOLAR, adayMetni, izMetni, takvim as T } from '../cekirdek/index.js';
import { $, esc, trT, cip, deger3, gunMetni, DURUM_ETIKETI, SEVIYE_ETIKETI } from './yardimci.js';
import { ALAN_ETIKETLERI } from './form.js';

let kt = null;

const YOL_KISA = {
  DS_105A_1: '105/A-1',
  DS_105A_3_a: '105/A-3-a',
  DS_105A_3_b: '105/A-3-b',
  DS_gecici6_1: 'Geçici 6/1',
  DS_gecici6_2a: 'Geçici 6/2-a',
  DS_gecici6_2b: 'Geçici 6/2-b',
  gecici10_6: 'Geçici 10/6',
};

// "Sonucu kesinleştirmek için" listesinin önceliği; madde bilinmiyorsa maddeye bağlı alanlar gizlenir.
const ONCELIK = ['Suç maddesi', 'Fıkra', 'Bent', 'Kast türü', 'Doğum tarihi', 'Terörle Mücadele K. kapsamı', 'Örgüt faaliyeti', 'Örgüt kurma/yönetme', 'Örgüt üyeliği', 'Özel KS yasağı', 'KS geri alınması', 'Adli paradan çevrilme', 'İyi hâl', 'DS talebi'];
const KISISEL = new Set(['Cinsiyet', '0-6 yaş çocuk', '105/A-3-b sağlık raporu']);
const MADDEYE_BAGLI = new Set(['Fıkra', 'Bent', 'Mağdurla yakınlık', 'Mağdur eş mi', 'Mağdurun savunmasızlığı', 'Deprem/yapı bağlantılı ölüm', '2937 kapsamı']);

export function gorunumKur(kuralTabani) {
  kt = kuralTabani;
}

export function kuralCipi(id) {
  if (!kt?.kurallar.has(id)) return cip('kural', id);
  const o = kt.kuralOzeti(id);
  return cip('kural', id, { baslik: `${o.mevzuat.join(', ')} — ${o.ozet}`, veri: { kural: id } });
}

function konuCipi(id) {
  const q = kt.acikKonular.get(id);
  if (q) return cip('inceleme', id, { baslik: `${q.konu}${q.tamamlanma ? ': ' + q.tamamlanma : ''}` });
  const e = kt.hataKodlari[id];
  return cip(e ? 'varsayim' : 'bilgi', id, { baslik: e || '' });
}

// ---------------------------------------------------------------------------
// Hesap sekmesi
// ---------------------------------------------------------------------------

function senaryoKarti(anahtar, S, c) {
  const tanim = SENARYOLAR.find((s) => s.anahtar === anahtar);
  if (!S) {
    return `<article class="senaryo pasif"><div class="senaryo-ust"><h3>${esc(tanim.baslik)}</h3></div>
      <div class="buyuk"><span class="sayi">—</span></div><p class="uygulanamaz-neden">Suç tarihi ve ceza girildiğinde hesaplanır.</p></article>`;
  }
  const secili = c.secili_senaryo === anahtar;
  const rozet = secili ? `<span class="rozet-secili">${c.tekerrur?.hukumde_uygulanan === anahtar ? 'Hükümdeki' : 'Belgelerden aday'}</span>` : '';
  const ust = `<div class="senaryo-ust"><div><h3>${esc(S.baslik)}</h3>${cip(S.durum, DURUM_ETIKETI[S.durum] || S.durum)}</div>${rozet}</div>`;
  if (!S.uygulanabilir || S.hesaplanamadi || S.kurumda_kalis_gun === null) {
    return `<article class="senaryo pasif${secili ? ' secili' : ''}" data-senaryo="${anahtar}">${ust}<div class="buyuk"><span class="sayi">—</span></div>
      <p class="uygulanamaz-neden">${esc(S.neden || 'Bu senaryo hesaplanamadı.')}</p></article>`;
  }
  const t = S.takvim;
  const yol = S.ds_yollari.find((y) => y.id === S.secilen_ds_yolu);
  const satir = [];
  if (S.oran) satir.push(['KS oranı', `${S.oran}`]);
  if (S.muebbet) satir.push(['KS süresi', `${S.muebbet.yil} yıl`]);
  if (S.ks_ham_gun) satir.push(['KS süresi', `${S.ks_ham_gun.ondalik(2)} → ${S.ks_gun} gün`]);
  if (S.asgari_kurum?.uygulanir) satir.push(['Asgari kurum', `${S.asgari_kurum.gun} gün`]);
  if (S.acik_kurum) {
    satir.push(['Açık kurum', S.acik_kurum.yol === 'dogrudan' ? 'Doğrudan' : S.acik_kurum.yol === 'yasak' ? 'Ayrılamaz' : trT(S.acik_kurum.tarih)]);
  }
  satir.push(['DS yolu', yol ? YOL_KISA[yol.id] || yol.ad : 'Yok']);
  satir.push(['DS’ye ayrılma', trT(t.DSye_hak_kazanma)]);
  satir.push(['Koşullu salıverilme', trT(t.kosullu_saliverilme)]);
  satir.push(['Hak ederek tahliye', trT(t.hak_ederek_tahliye)]);
  if (t.mahsup_gun) satir.push(['Mahsup dahil infaz', `${S.toplam_infaz_gun} gün`]);

  const ek = [];
  if (S.ust_sinir_108_2) ek.push(`<div class="alternatif">108/2 üst sınırı: temel KS + ${esc(T.cezaMetni(S.ust_sinir_108_2.ceza))} (${S.ust_sinir_108_2.gun} gün) = ${esc(S.ust_sinir_108_2.ust_sinir.ondalik())} gün${S.ust_sinir_108_2.uygulandi ? ' — uygulandı' : ''}</div>`);
  for (const y of S.alternatif_yollar) {
    ek.push(`<div class="alternatif"><b>Alternatif · ${esc(y.ad)}:</b> ${y.kurumda_kalis_gun} gün (${esc(trT(y.tarih))}) ${cip('hukuki_inceleme_gerekli', 'İnceleme')}</div>`);
  }
  const gun = S.kurumda_kalis_gun;
  return `<article class="senaryo${secili ? ' secili' : ''}" data-senaryo="${anahtar}">${ust}
    <div>
      <div class="buyuk">${S.en_cok ? '<span class="nitelik" title="Bilgi eksikliği hükümlü aleyhine çözüldü; gerçek süre daha kısa olabilir">EN ÇOK</span>' : ''}<span class="sayi">${gun}</span><span class="birim">gün</span></div>
      <div class="buyuk-alt">kurumda kalış${gunMetni(gun) ? ` (${esc(gunMetni(gun))})` : ''} · çıkış ${esc(trT(t.kurumdan_cikis))}</div>
    </div>
    <dl class="ozet">${satir.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
    ${ek.join('')}
    <button type="button" class="baglanti" data-gerekce="${anahtar}">Gerekçeyi gör →</button>
  </article>`;
}

export function hesapCiz(c) {
  const bant = $('durumBandi');
  bant.className = `durum-bandi var ${c.durum}`;
  let metin;
  if (c.durum === 'eksik_veri') metin = c.eksik_veri.map((e) => esc(e.mesaj)).join('<br>');
  else if (c.durum === 'hukuki_inceleme_gerekli') metin = 'Seçili senaryoda yazılımın tek başına sonuçlandıramayacağı konular var; sayılar ön değerlendirmedir.';
  else metin = `Sonuç ${c.hukuki_kabuller.length} varsayıma dayanır; ayrıntılar Gerekçe sekmesinde.`;
  const kodlar = [...c.engelleyici_konu_idleri, ...c.hata_kodlari];
  bant.innerHTML = `<strong>${esc(DURUM_ETIKETI[c.durum])}:</strong> ${metin}${kodlar.length ? `<div class="konular">${kodlar.map(konuCipi).join('')}</div>` : ''}`;

  $('senaryolar').innerHTML = SENARYOLAR.map((s) => senaryoKarti(s.anahtar, c.senaryolar[s.anahtar], c)).join('');
  eksikBilgiCiz(c);
  rejimCiz(c);
  tekerrurCiz(c);
  cekCiz(c);
  $('sonucEtiketi').textContent = c.sonuc_etiketi;
}

// Belgeli bağlamda belirsiz kalan alanlar: "bunları girerseniz sonuç kesinleşir".
function eksikBilgiCiz(c) {
  const el = $('eksikBilgi');
  const S = c.senaryolar[c.secili_senaryo || 'yok'];
  const alanlar = new Map();
  for (const a of S?.belirsiz_kosullar || []) {
    const [etiket, hedef] = ALAN_ETIKETLERI[a] || [a, null];
    if (!alanlar.has(etiket)) alanlar.set(etiket, hedef);
  }
  if (alanlar.has('Suç maddesi')) for (const e of MADDEYE_BAGLI) alanlar.delete(e);
  if (!alanlar.size) {
    el.classList.add('gizli');
    return;
  }
  const sira = (e) => (ONCELIK.includes(e) ? ONCELIK.indexOf(e) : ONCELIK.length);
  const liste = [...alanlar].sort((a, b) => sira(a[0]) - sira(b[0]));
  const dugme = ([etiket, hedef]) => `<button type="button" class="cip eksik-alan" ${hedef ? `data-odak="${esc(hedef)}"` : ''}>${esc(etiket)}</button>`;
  const ana = liste.filter(([e]) => !KISISEL.has(e));
  const kisisel = liste.filter(([e]) => KISISEL.has(e));
  el.classList.remove('gizli');
  el.innerHTML = `${ana.length ? `<b>Sonucu kesinleştirmek için:</b> ${ana.map(dugme).join(' ')}` : ''}
    ${kisisel.length ? `<span class="ikincil"><b>Özel DS yolları için:</b> ${kisisel.map(dugme).join(' ')}</span>` : ''}
    <span class="ipucu">Girilmeyen bilgiler için olağan dosya varsayımı veya hükümlü aleyhine ihtiyat çözümü kullanıldı.</span>`;
}

function rejimCiz(c) {
  const el = $('rejim');
  if (!c.rejim.length) {
    el.innerHTML = '<h3>Suç tarihine göre rejim</h3><p class="aciklama">Suç tarihi girildiğinde uygulanan tarih eşikleri burada listelenir.</p>';
    return;
  }
  const S = c.senaryolar[c.secili_senaryo || 'yok'];
  const oran = S?.temel_oran ? `<span>Temel KS oranı: <b>${esc(S.temel_oran.oran.toString())}</b> ${kuralCipi(S.temel_oran.kaynak)} <span class="ipucu">${esc(S.temel_oran.neden)}</span></span>` : '';
  const konum = { once: 'öncesi', sonra: 'sonrası', ayni_gun: 'aynı gün' };
  el.innerHTML = `<h3>Suç tarihine göre rejim</h3><div class="oran-ozet">${oran}</div>
    <ul class="esikler">${c.rejim.map((r) => `<li><span>${esc(trT(r.tarih))}</span><span class="konum ${r.konum}">${konum[r.konum]}</span><span>${esc(r.anlam)}</span></li>`).join('')}</ul>`;
}

function tekerrurCiz(c) {
  const t = c.tekerrur;
  const kartlar = [...document.querySelectorAll('#oncekiListe .onceki')];
  $('tekerrurSayac').textContent = kartlar.length ? `(${kartlar.length} kayıt)` : '';
  if (!t) {
    $('tekerrurSonuc').innerHTML = '';
    return;
  }
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
    const e = { esas: ['Tekerrüre esas', 'tamam'], esas_degil: ['Esas alınamaz', 'inceleme'], belirsiz: ['Belirsiz', 'varsayim'] }[d.sonuc];
    durumEl.innerHTML = cip(e[1], e[0]) + (d.ikinci_zincir === true ? cip('inceleme', 'İkinci tekerrür zinciri') : '');
    nedenEl.innerHTML = d.kosullar
      .map((k) => `<li class="${k.deger === true ? 'kabul' : k.deger === false ? 'eler' : 'belirsiz'}">${deger3(k.deger)} ${esc(k.ad)} <span class="ipucu">${esc(k.dugum_id)}</span>${k.aciklama ? ` — ${esc(k.aciklama)}` : ''}${k.dugum_id === 'D103' && d.tekerrur_suresi ? ` <span class="ipucu">(${d.tekerrur_suresi.yil} yıl, bitiş ${esc(trT(d.tekerrur_suresi.bitis))})</span>` : ''}</li>`)
      .join('');
  });
  const satir = [`Belgelerden aday: <b>${esc(t.belgelerden_aday_tespit ? adayMetni(t.belgelerden_aday_tespit) : 'Veri yok')}</b>`, `Hükümdeki: <b>${esc(t.hukumde_uygulanan ? adayMetni(t.hukumde_uygulanan) : 'Girilmedi')}</b>`];
  if (t.uyusuyor_mu !== null) satir.push(t.uyusuyor_mu ? cip('tamam', 'Uyumlu') : cip('inceleme', 'Uyuşmazlık (E004)'));
  const alt = [];
  if (t.dayanak_ilamlar.length) alt.push(`Dayanak ilamlar: ${esc(t.dayanak_ilamlar.join(', '))}`);
  if (t.tekerrure_esas_en_agir_ceza) alt.push(`108/2 için en ağır ceza: ${esc(t.tekerrure_esas_en_agir_ceza_metni)} (${esc(t.tekerrure_esas_en_agir_ilam)})`);
  for (const u of t.uyarilar) alt.push(`${cip(u.seviye, u.kod)} ${esc(u.mesaj)}`);
  $('tekerrurSonuc').innerHTML = `<div class="tekerrur-ozet">${satir.join(' · ')}${alt.length ? `<div>${alt.join('<br>')}</div>` : ''}</div>`;
}

function cekCiz(c) {
  const bolum = $('cekBolumu');
  const cek = c.cek_sonucu;
  const tur = c.vaka?.suclar_ve_ilamlar?.[0];
  const goster = !!cek || tur?.infazdaki_ceza_turu === 'adli_paradan_cevrilen_hapis';
  bolum.classList.toggle('gizli', !goster);
  document.querySelectorAll('.cek-alani').forEach((el) => el.classList.toggle('gizli', !cek));
  if (!cek) {
    $('cekSonuc').innerHTML = '';
    $('cekSayac').textContent = '';
    return;
  }
  const yolAdi = { cek_5_11: 'm.5/11: adli paradan doğrudan hapse çevirme (KS ve 105/A yok)', genel_sureli_hapis: 'm.7: genel süreli hapis yolu', adli_para: 'm.5/1: adli para cezası (henüz hapse çevrilmemiş)', belirsiz: 'Belirsiz: madde ve ceza türünü belirtin' }[cek.yol];
  $('cekSayac').textContent = `(${cek.yol === 'belirsiz' ? 'yol belirsiz' : cek.yol.replace(/_/g, ' ')})`;
  $('cekSonuc').innerHTML = `<div class="tekerrur-ozet"><b>Rejim:</b> ${esc(yolAdi)}</div>
    <ul class="not-listesi">${[...cek.talepler, ...cek.gecis, ...cek.bilgiler].map((x) => `<li>${esc(x.metin)} ${kuralCipi(x.kural)}</li>`).join('')}</ul>`;
}

// ---------------------------------------------------------------------------
// Gerekçe sekmesi
// ---------------------------------------------------------------------------

function notListesi(baslik, liste) {
  if (!liste.length) return '';
  const sira = ['inceleme', 'varsayim', 'bilgi'];
  const sirali = [...liste].sort((a, b) => sira.indexOf(a.seviye) - sira.indexOf(b.seviye));
  return `<div class="not-grup"><h4>${esc(baslik)}</h4><ul>${sirali
    .map((n) => `<li>${cip(n.seviye, SEVIYE_ETIKETI[n.seviye] || n.seviye)} ${esc(n.mesaj)} ${(n.kurallar || []).filter((k) => kt.kurallar.has(k)).map(kuralCipi).join('')}</li>`)
    .join('')}</ul></div>`;
}

export function gerekceCiz(c, anahtar) {
  $('gerekceSenaryo').innerHTML = SENARYOLAR.map((s) => `<button type="button" class="dugme hafif kucuk" data-gerekce-sekme="${s.anahtar}" aria-pressed="${s.anahtar === anahtar}">${esc(s.baslik)}</button>`).join('');
  const S = c.senaryolar[anahtar];
  const el = $('gerekce');
  if (!S) {
    el.innerHTML = '<div class="kart"><p class="aciklama">Hesap yapılmadı.</p></div>';
    return;
  }
  const parca = [];
  parca.push(`<div class="kart"><h3>${esc(S.baslik)} ${cip(S.durum, DURUM_ETIKETI[S.durum])}</h3>
    ${S.neden ? `<p>${esc(S.neden)}</p>` : ''}
    <ol class="iz">${S.izler.map((i) => `<li><span class="adim">${esc(i.adim)}:</span> ${esc(i.aciklama)} <span class="kurallar">${i.kurallar.map(kuralCipi).join('')}</span></li>`).join('') || '<li>İz yok.</li>'}</ol></div>`);

  if (S.ds_yollari.length) {
    parca.push(`<div class="kart"><h3>Denetimli serbestlik yolları</h3><table class="tablo"><thead><tr><th>Yol</th><th>Uygun</th><th>Tarih</th><th>Not</th></tr></thead><tbody>${S.ds_yollari
      .map((y) => `<tr class="${y.id === S.secilen_ds_yolu ? 'secili-satir' : ''}"><td>${esc(y.ad)} ${kuralCipi(y.kural)}</td><td>${deger3(y.uygun)}${y.ihtiyatli ? ' <span class="ipucu">ihtiyat</span>' : ''}</td><td>${esc(trT(y.tarih))}</td><td>${esc(y.neden || (y.id === S.secilen_ds_yolu ? 'Seçilen yol' : ''))}</td></tr>`)
      .join('')}</tbody></table></div>`);
  }
  if (S.acik_kurum) {
    const a = S.acik_kurum;
    const kalemler = a.yol === 'kapalidan' ? a.kapali.kalemler.map((k) => `<li>${esc(k.ad)} → <b>${esc(trT(k.tarih))}</b> ${kuralCipi(k.kural)}</li>`).join('') : '';
    const metin = a.yol === 'dogrudan' ? a.dogrudan.neden : a.yol === 'yasak' ? a.yasaklar.map((y) => y.neden).join(' ') : a.kapali.aciklama;
    parca.push(`<div class="kart"><h3>Açık kurum</h3><p>${esc(metin)}</p>${kalemler ? `<ul class="not-listesi">${kalemler}</ul>` : ''}</div>`);
  }
  if (S.gerekli_kararlar.length) {
    parca.push(`<div class="kart"><h3>Gerekli kararlar</h3><ul class="not-listesi">${S.gerekli_kararlar.map((k) => `<li>${esc(k.metin)} ${kuralCipi(k.kural)}</li>`).join('')}</ul><p class="ipucu">Yazılım bu kararları gerçekleşmiş saymaz.</p></div>`);
  }
  const varsayim = S.varsayimlar.map((v) => ({ seviye: 'varsayim', kod: v.alan, mesaj: v.mesaj, kurallar: v.kurallar }));
  parca.push(`<div class="kart">${notListesi('Olağan dosya varsayımları', varsayim)}${notListesi('Senaryo notları', S.notlar)}${notListesi('Bütün senaryolar', c.notlar)}</div>`);

  if (S.karar_dugumu_sonuclari.length) {
    parca.push(`<div class="kart"><h3>Karar düğümleri</h3><p class="ipucu">Belgeli: yalnız girilen bilgiyle. Varsayımlı: olağan dosya varsayımları ve ihtiyat çözümüyle. ✓ doğru · ✗ yanlış · ? belirsiz</p>
      <table class="tablo dugumler"><thead><tr><th>Düğüm</th><th>Belgeli</th><th>Varsayımlı</th><th>Dayanak</th></tr></thead><tbody>${S.karar_dugumu_sonuclari
        .map((d) => `<tr><td><details><summary><b>${esc(d.dugum_id)}</b> ${esc(d.ad)} <span class="ipucu">${esc(d.grup)}</span></summary><pre class="kosul-izi">${esc(izMetni(d.iz).join('\n'))}</pre></details></td><td>${deger3(d.belgeli_deger)}</td><td>${deger3(d.cozulen)}${d.ihtiyatli ? ' <span class="ipucu">ihtiyat</span>' : ''}${d.aday_tarihte ? ' <span class="ipucu" title="KS\'ye kalan süre kapısı aday tarihte sağlanmış kabul edildi">aday tarihte</span>' : ''}</td><td>${d.dayanak_kurallar.map(kuralCipi).join('')}</td></tr>`)
        .join('')}</tbody></table></div>`);
  }
  if (c.ozel_infaz_notlari.length) {
    parca.push(`<div class="kart"><h3>Özel infaz ve başvuru olanakları</h3><ul class="not-listesi">${c.ozel_infaz_notlari.map((n) => `<li><b>${esc(n.baslik)}:</b> ${esc(n.metin)} ${kuralCipi(n.kural)}</li>`).join('')}</ul></div>`);
  }
  if (c.toplama) parca.push(`<div class="kart"><h3>Toplama</h3><p>${esc(c.toplama.mesaj)}</p></div>`);
  parca.push(`<div class="kart"><h3>Bu sürümün hesaplamadığı dallar</h3><ul class="not-listesi">${c.desteklenmeyen_dallar.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>`);
  el.innerHTML = parca.join('');
}
