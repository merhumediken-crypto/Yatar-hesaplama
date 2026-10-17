// Test ortak yükleyicileri. Kaynak kural tabanı yalnız bir kez okunur.
import fs from 'node:fs';
import { KuralTabani, MevzuatDeposu } from '../extension/cekirdek/index.js';

const kok = new URL('..', import.meta.url);
const oku = (yol) => JSON.parse(fs.readFileSync(new URL(yol, kok), 'utf8'));

export const KAYNAK_METNI = fs.readFileSync(new URL('kaynak/kural_tabani.json', kok), 'utf8');
export const KAYNAK = JSON.parse(KAYNAK_METNI);
export const PAKET = oku('extension/veri/paket.json');
export const kt = new KuralTabani(PAKET);
export const mevzuat = new MevzuatDeposu(kt, (dosya) => oku(`extension/veri/${dosya}`));
export const IZINLI = PAKET.hesap_politikasi.bu_paket_ile_izin_verilen_sonuc;
export const HESAP = '2026-10-17';

// Testlerde kullanılan tam bilgili "olağan" vaka.
export function vaka(ilam = {}, ek = {}) {
  return {
    hesap_tarihi: HESAP,
    infaza_baslama_tarihi: '2026-01-01',
    mahsup_kayitlari: [],
    dogum_tarihi: '1990-01-01',
    cinsiyet: 'erkek',
    iyi_hal: true,
    ds_talebi: true,
    ...ek,
    suclar_ve_ilamlar: [
      {
        suc_tarihi: '2025-07-01',
        hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 },
        kast_turu: 'kasit',
        hukumdeki_ceza_turu: 'sureli_hapis',
        para_cezasindan_cevrilme: false,
        teror_kanunu_kapsami: false,
        orgut_faaliyeti: false,
        orgut_kurma_yonetme: false,
        orgut_uyelik: false,
        ks_geri_alindi: false,
        ozel_ks_yasagi: false,
        kesinlesme_tarihi: '2025-12-01',
        kanun_madde_fikra_bent: { kanun: 5237, madde: '141' },
        ...ilam,
      },
    ],
  };
}

export function onceki(ek = {}) {
  return {
    ilam_id: 'O1',
    suc_tarihi: '2015-01-01',
    kesinlesme_tarihi: '2016-01-01',
    kast_turu: 'kasit',
    ceza_turu: 'sureli_hapis',
    ceza: { yil: 1, ay: 0, gun: 0 },
    infaz_durumu: 'tamamlandi',
    infaz_tamamlanma_tarihi: '2024-01-01',
    tekerrur_uygulanmis_mi: false,
    karar_turu: 'mahkumiyet',
    cmk_272_3_engeli: false,
    yabanci_mahkeme_karari: false,
    sirf_askeri_suc: false,
    ...ek,
  };
}

export const senaryo = (c, anahtar = 'yok') => c.senaryolar[anahtar];
export const dugum = (S, id) => S.karar_dugumu_sonuclari.find((d) => d.dugum_id === id);
