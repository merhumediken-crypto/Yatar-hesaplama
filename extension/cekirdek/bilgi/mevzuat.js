// Mevzuat tam metin deposu. Kanun/yönetmelik dosyaları (~2,5 MB) yalnız
// istendiğinde yüklenir; yükleyici ortama göre verilir (tarayıcıda fetch,
// Node'da dosya okuma).

export class MevzuatDeposu {
  constructor(kt, yukleyici) {
    this.kt = kt;
    this.yukleyici = yukleyici;
    this.onbellek = new Map();
  }

  metin(kaynakId) {
    if (!this.onbellek.has(kaynakId)) {
      const kayit = this.kt.mevzuatListesi.find((m) => m.kaynak_id === kaynakId);
      if (!kayit) return Promise.reject(new Error('Tanımsız mevzuat kaynağı: ' + kaynakId));
      const yukleme = Promise.resolve(this.yukleyici(kayit.dosya)).then((veri) => {
        if (veri.metin_sha256 !== kayit.metin_sha256) throw new Error(`${kaynakId} metin özeti paketle uyuşmuyor`);
        veri.maddeHaritasi = new Map(veri.maddeler.map((a) => [a.madde_id, a]));
        return veri;
      });
      this.onbellek.set(kaynakId, yukleme);
      yukleme.catch(() => this.onbellek.delete(kaynakId));
    }
    return this.onbellek.get(kaynakId);
  }

  async madde(maddeId) {
    const kaynakId = maddeId.split(':')[0];
    const m = await this.metin(kaynakId);
    const madde = m.maddeHaritasi.get(maddeId);
    if (!madde) return null;
    return {
      madde,
      kaynak: { kaynak_id: m.kaynak_id, ad: m.ad, mevzuat_numarasi: m.mevzuat_numarasi, tur: m.tur },
      dipnotlar: madde.dipnot_idleri.map((id) => ({ id, metin: m.dipnotlar[id] })).filter((d) => d.metin),
      degisiklikler: m.degisiklik_isaretleri[maddeId] || [],
      kurallar: this.kt.maddeKurallari.get(maddeId) || [],
    };
  }

  async kanit(kanitId) {
    const k = this.kt.kanitlar.get(kanitId);
    if (!k) return null;
    const m = await this.metin(k.kaynak_id);
    return { ...k, metin: m.kanitlar[kanitId]?.metin ?? null };
  }

  // Madde numarası ("105/A", "gecici_6") veya metin içinde arama.
  async ara(kaynakId, sorgu, sinir = 30) {
    const m = await this.metin(kaynakId);
    const q = String(sorgu || '').trim();
    if (!q) return m.maddeler.slice(0, sinir);
    const no = q.replace(/^(m\.?|madde)\s*/i, '').replace(/^geçici\s*/i, 'gecici_').toUpperCase();
    const tam = m.maddeler.filter((a) => a.madde_no.toUpperCase() === no);
    if (tam.length) return tam;
    const kucuk = q.toLocaleLowerCase('tr');
    return m.maddeler.filter((a) => a.metin.toLocaleLowerCase('tr').includes(kucuk) || (a.baslik || '').toLocaleLowerCase('tr').includes(kucuk)).slice(0, sinir);
  }
}

// Tarayıcıda SubtleCrypto ile kanıt metninin özetini yeniden doğrular.
export async function sha256Hex(metin) {
  const c = globalThis.crypto?.subtle;
  if (!c) return null;
  const ozet = await c.digest('SHA-256', new TextEncoder().encode(metin));
  return [...new Uint8Array(ozet)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
