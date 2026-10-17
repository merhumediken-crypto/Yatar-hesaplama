// Arayüz yardımcıları: kaçışlama, biçimlendirme, kalıcı depolama.
import { takvim as T } from '../cekirdek/index.js';

export const $ = (id) => document.getElementById(id);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const trT = (s) => (s ? T.trTarih(s) : '—');

export const DURUM_ETIKETI = {
  varsayimli_senaryo: 'Varsayımlı senaryo',
  hukuki_inceleme_gerekli: 'Hukuki inceleme gerekli',
  eksik_veri: 'Eksik veri',
  uygulanamaz: 'Uygulanamaz',
};

export const SEVIYE_ETIKETI = { inceleme: 'Hukuki inceleme', varsayim: 'Varsayım', bilgi: 'Bilgi', eksik: 'Eksik veri' };

export const DOGRULAMA_ETIKETI = {
  resmi_metin: ['Resmî metin', 'tamam'],
  sunulan_tam_metin: ['Tam metin', 'tamam'],
  sunulan_tam_metin_ve_onceki_arastirma: ['Tam metin', 'tamam'],
  resmi_indeks: ['Resmî indeks', 'varsayim'],
  hukuki_modelleme: ['Hukuki modelleme', 'varsayim'],
  erisilemedi: ['Erişilemedi', 'inceleme'],
  karar_gerektirir: ['Karar gerektirir', 'inceleme'],
};

export function dogrulamaEtiketi(d) {
  return DOGRULAMA_ETIKETI[d] || [String(d || '').replace(/_/g, ' '), 'bilgi'];
}

export function cip(sinif, metin, { baslik = '', veri = null } = {}) {
  const v = veri ? Object.entries(veri).map(([k, d]) => ` data-${k}="${esc(d)}"`).join('') : '';
  return `<span class="cip ${esc(sinif)}"${baslik ? ` title="${esc(baslik)}"` : ''}${v}>${esc(metin)}</span>`;
}

export function deger3(d) {
  return d === true ? '<span class="d3 dogru" title="doğru">✓</span>' : d === false ? '<span class="d3 yanlis" title="yanlış">✗</span>' : '<span class="d3 belirsiz" title="belirsiz">?</span>';
}

export function gunMetni(n) {
  return n >= 60 ? T.gunMetni(n) : '';
}

const chromeApi = globalThis.chrome;

export const depo = {
  async oku(anahtar) {
    try {
      if (chromeApi?.storage?.local) return (await chromeApi.storage.local.get(anahtar))[anahtar] ?? null;
    } catch {}
    try {
      return JSON.parse(localStorage.getItem(anahtar) || 'null');
    } catch {
      return null;
    }
  },
  async yaz(anahtar, deger) {
    try {
      if (chromeApi?.storage?.local) return await chromeApi.storage.local.set({ [anahtar]: deger });
    } catch {}
    try {
      localStorage.setItem(anahtar, JSON.stringify(deger));
    } catch {}
  },
};

export function sayfaAc(sorgu) {
  const yol = `popup.html?${sorgu}`;
  if (chromeApi?.tabs?.create && chromeApi?.runtime?.getURL) chromeApi.tabs.create({ url: chromeApi.runtime.getURL(yol) });
  else window.open(yol, '_blank');
}

export function bildir(metin) {
  const el = document.createElement('div');
  el.className = 'bildirim';
  el.setAttribute('role', 'status');
  el.textContent = metin;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

export function dosyaIndir(ad, icerik, tur = 'application/json') {
  const blob = new Blob([icerik], { type: tur });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ad;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
