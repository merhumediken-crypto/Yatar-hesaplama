// Arayüz yardımcıları: kaçışlama, çip, kalıcı depolama, bildirim.

export const $ = (id) => document.getElementById(id);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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

const chromeApi = globalThis.chrome;
let yazmaSirasi = Promise.resolve();

export const depo = {
  async oku(anahtar) {
    // Eklenti deposunun okunamaması boş dosya anlamına gelmez. Eski bir yerel
    // kayda dönüp sonraki cevapta asıl dosyanın üzerine yazılmasını önle.
    if (chromeApi?.storage?.local) {
      const sonuc = await chromeApi.storage.local.get(anahtar);
      return sonuc[anahtar] ?? null;
    }
    try {
      return JSON.parse(localStorage.getItem(anahtar) || 'null');
    } catch {
      return null;
    }
  },
  yaz(anahtar, deger) {
    const kayit = structuredClone(deger);
    const yazma = async () => {
      if (chromeApi?.storage?.local) {
        // Chrome deposu varsa hatayı yerel depoya gizlice taşımak, sonraki açılışta
        // eski Chrome kaydının geri gelmesine yol açar. Hata çağırana bildirilir.
        await chromeApi.storage.local.set({ [anahtar]: kayit });
      } else localStorage.setItem(anahtar, JSON.stringify(kayit));
    };
    const sonuc = yazmaSirasi.catch(() => {}).then(yazma);
    yazmaSirasi = sonuc;
    return sonuc;
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
