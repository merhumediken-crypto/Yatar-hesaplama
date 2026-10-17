// Mevzuat sekmesi: tam metin tarayıcısı, kural ayrıntısı ve kanıt doğrulama.
// Kanun dosyaları ilk kullanımda yüklenir; kanıt metninin SHA-256 özeti tarayıcıda
// yeniden hesaplanıp paketteki özetle karşılaştırılır.

import { sha256Hex } from '../cekirdek/index.js';
import { $, esc, cip, dogrulamaEtiketi } from './yardimci.js';
import { kuralCipi } from './gorunum.js';

let kt = null;
let depo = null;

export function mevzuatKur(kuralTabani, mevzuatDeposu) {
  kt = kuralTabani;
  depo = mevzuatDeposu;
  $('mevzuatSec').innerHTML = kt.mevzuatListesi
    .map((m) => `<option value="${esc(m.kaynak_id)}">${esc(m.mevzuat_numarasi)} · ${esc(m.ad)}</option>`)
    .join('');
  $('mevzuatSec').value = 'U03';
}

export async function aramaYap() {
  const liste = $('mevzuatSonuc');
  liste.innerHTML = '<li class="ipucu">Yükleniyor…</li>';
  try {
    const sonuc = await depo.ara($('mevzuatSec').value, $('mevzuatAra').value, 60);
    liste.innerHTML = sonuc.length
      ? sonuc.map((a) => `<li><button type="button" class="baglanti" data-madde="${esc(a.madde_id)}"><b>${esc(maddeNoMetni(a.madde_no))}</b> ${esc(a.baslik || '')}${a.mulga ? ' <span class="ipucu">(mülga)</span>' : ''}</button></li>`).join('')
      : '<li class="ipucu">Sonuç yok.</li>';
  } catch (h) {
    liste.innerHTML = `<li class="ipucu">Metin yüklenemedi: ${esc(h.message)}</li>`;
  }
}

function maddeNoMetni(no) {
  return no.startsWith('gecici_') ? `Geçici m.${no.slice(7)}` : `m.${no}`;
}

function maddeHtml(m) {
  if (!m) return '<p class="aciklama">Madde bulunamadı.</p>';
  const { madde, kaynak, dipnotlar, degisiklikler, kurallar } = m;
  return `<header class="goruntuleyici-ust"><h3>${esc(kaynak.mevzuat_numarasi)} sayılı ${esc(kaynak.ad)} — ${esc(maddeNoMetni(madde.madde_no))}</h3>
      ${madde.baslik ? `<p class="ipucu">${esc(madde.baslik)}</p>` : ''}
      ${kurallar.length ? `<div>Bu maddeye dayanan kurallar: ${kurallar.map(kuralCipi).join('')}</div>` : ''}</header>
    <div class="madde-metni">${esc(madde.metin.replace(/\[DIPNOT:([^\]]+)\]/g, '[$1]'))}</div>
    ${degisiklikler.length ? `<details><summary>Değişiklik işaretleri (${degisiklikler.length})</summary><ul class="not-listesi">${degisiklikler.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></details>` : ''}
    ${dipnotlar.length ? `<details open><summary>Dipnotlar (${dipnotlar.length})</summary><ol class="dipnotlar">${dipnotlar.map((d) => `<li value="${esc(d.id)}">${esc(d.metin)}</li>`).join('')}</ol></details>` : ''}
    <p class="ipucu">Kaynak: kullanıcının sunduğu nüsha; bağımsız güncellik denetimi yapılmadı (A06).</p>`;
}

export async function maddeGoster(maddeId) {
  const el = $('goruntuleyici');
  el.innerHTML = '<p class="ipucu">Yükleniyor…</p>';
  try {
    el.innerHTML = maddeHtml(await depo.madde(maddeId));
  } catch (h) {
    el.innerHTML = `<p class="aciklama">Metin yüklenemedi: ${esc(h.message)}</p>`;
  }
  el.scrollIntoView({ block: 'nearest' });
}

export async function kuralGoster(kuralId) {
  const el = $('goruntuleyici');
  const o = kt.kuralOzeti(kuralId);
  const r = kt.kural(kuralId);
  const [etiket, sinif] = dogrulamaEtiketi(o.dogrulama);
  el.innerHTML = `<header class="goruntuleyici-ust"><h3>${cip('kural', kuralId)} ${esc(o.ozet)}</h3>
      <div>${cip(sinif, etiket)} ${cip('bilgi', o.otomasyon_kapsami.replace(/_/g, ' '))}</div>
      <p class="ipucu">${esc(o.mevzuat.join(' · '))}</p></header>
    <details><summary>Parametreler</summary><pre class="kosul-izi">${esc(JSON.stringify(r.parametreler, null, 2))}</pre></details>
    ${o.karar_dugumu_idleri.length ? `<p>Karar düğümleri: ${o.karar_dugumu_idleri.map((d) => cip('bilgi', d, { baslik: kt.dugum(d).ad })).join('')}</p>` : ''}
    <div id="kanitlar"><p class="ipucu">Kanıt metni yükleniyor…</p></div>`;
  const kutu = $('kanitlar');
  const parcalar = [];
  for (const id of o.kanit_idleri) {
    try {
      const k = await depo.kanit(id);
      const ozet = k.metin ? await sha256Hex(k.metin) : null;
      const dogru = ozet === null ? null : ozet === k.madde_metin_sha256;
      parcalar.push(`<section class="kanit"><h4>${esc(id)} · <button type="button" class="baglanti" data-madde="${esc(k.madde_id)}">${esc(k.madde_id)}</button>
        ${dogru === true ? cip('tamam', 'SHA-256 doğrulandı', { baslik: k.madde_metin_sha256 }) : dogru === false ? cip('inceleme', 'SHA-256 uyuşmadı') : cip('bilgi', 'Özet doğrulanamadı')}</h4>
        <div class="madde-metni">${esc((k.metin || '').trim())}</div>
        <p class="ipucu">Hukuki özet metinle özdeş değildir; kanıt, kuralın dayandığı madde metnidir.</p></section>`);
    } catch (h) {
      parcalar.push(`<p class="aciklama">${esc(id)} yüklenemedi: ${esc(h.message)}</p>`);
    }
  }
  kutu.innerHTML = parcalar.join('') || '<p class="ipucu">Bu kural için kanıt kaydı yok.</p>';
}

export function dayanaklarCiz(c) {
  const el = $('dayanaklar');
  if (!c?.secilen_kural_idleri?.length) {
    el.innerHTML = '<h3>Bu hesabın dayanakları</h3><p class="aciklama">Hesap yapıldığında listelenir.</p>';
    return;
  }
  const kaynaklar = c.kaynak_idleri.map((id) => kt.kaynaklar.get(id)).filter(Boolean);
  el.innerHTML = `<h3>Bu hesabın dayanakları (${c.secilen_kural_idleri.length} kural)</h3>
    <p class="aciklama">${esc(kt.paket.paket.dogrulama_siniri)}</p>
    <ul class="dayanak-listesi">${c.secilen_kural_idleri
      .map((id) => {
        const o = kt.kuralOzeti(id);
        const [etiket, sinif] = dogrulamaEtiketi(o.dogrulama);
        return `<li>${kuralCipi(id)} ${esc(o.ozet)} ${cip(sinif, etiket)}<div class="ipucu">${o.madde_idleri.map((m) => `<button type="button" class="baglanti" data-madde="${esc(m)}">${esc(m)}</button>`).join(' · ') || esc(o.mevzuat.join(' · '))}</div></li>`;
      })
      .join('')}</ul>
    <details><summary>Kaynaklar (${kaynaklar.length})</summary><ul class="not-listesi">${kaynaklar
      .map((s) => `<li><b>${esc(s.kaynak_id)}</b> ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.baslik)}</a>` : esc(s.baslik)} ${cip(dogrulamaEtiketi(s.dogrulama)[1], dogrulamaEtiketi(s.dogrulama)[0])}</li>`)
      .join('')}</ul></details>`;
}
