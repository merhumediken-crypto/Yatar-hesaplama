// Tekerrür adayı tespiti (TCK 58; karar düğümleri D100-D106).
//
// Her önceki ilam ayrı değerlendirilir; sabıka adedinden derece türetilmez
// (karar_cozumleme_politikasi.tekerrur_adayi). Sonuç "aday"dır; hükümdeki
// uygulamayla karşılaştırılır, kararı kendiliğinden değiştirmez.

import { yilEkle, karsilastir, cezaKarsilastir, trTarih, cezaMetni } from '../zaman/takvim.js';
import { KAST_GRUBU, sucYasi } from '../baglam/karar-baglami.js';

const DUGUM_ACIKLAMA = {
  D100: { yanlis: 'Önceki hüküm yeni suçtan sonra kesinleşmiş; tekerrüre esas olamaz (TCK 58/1).', belirsiz: 'Kesinleşme ve yeni suç sırası belirsiz (tarih eksik ya da aynı gün; E003).' },
  D101: { yanlis: '18 yaşından önce işlenen suç tekerrüre esas olmaz; yeni suç 18 yaş altındaysa tekerrür uygulanmaz (TCK 58/5).', belirsiz: 'Önceki veya yeni suç tarihindeki yaş bilinmiyor.' },
  D102: { yanlis: 'Kasıtlı suçlarla taksirli suçlar arasında tekerrür uygulanmaz (TCK 58/4).', belirsiz: 'Kast/taksir türü bilinmiyor.' },
  D103: { yanlis: 'Önceki cezanın infazından sonra kanuni tekerrür süresi dolmuş (TCK 58/2).', belirsiz: 'İnfaz durumu veya tekerrür süresinin dolup dolmadığı belirsiz.' },
  D104: { yanlis: 'Tekerrüre esas olmaya engel var (HAGB, CMK 272/3, hukuken ortadan kalkma, sırf askerî suç veya yabancı hüküm; TCK 58/4, CMK 231).', belirsiz: 'HAGB, CMK 272/3, askerî veya yabancı hüküm engeli bilgisi eksik.' },
};

function tekerrurSuresi(kt, onceki, yeniSuc) {
  if (onceki.infaz_durumu !== 'tamamlandi') return { doldu: null };
  if (!onceki.infaz_tamamlanma_tarihi || !yeniSuc) return { doldu: null, neden: 'İnfazın tamamlandığı tarih eksik.' };
  const r11 = kt.p('R011');
  let yil = r11.onceki_hapis_en_fazla_5_yil_sure_yil;
  if (onceki.ceza_turu === 'adli_para') yil = r11.onceki_adli_para_sure_yil;
  else if (onceki.ceza_turu === 'muebbet' || onceki.ceza_turu === 'agirlastirilmis_muebbet') yil = r11.onceki_hapis_5_yildan_fazla_sure_yil;
  else if (onceki.ceza) {
    const ref = onceki.kesinlesme_tarihi || onceki.infaz_tamamlanma_tarihi;
    if (cezaKarsilastir(onceki.ceza, { yil: 5, ay: 0, gun: 0 }, ref) > 0) yil = r11.onceki_hapis_5_yildan_fazla_sure_yil;
  } else return { doldu: null, neden: 'Önceki ceza miktarı eksik; 3/5 yıllık süre seçilemez.' };
  const bitis = yilEkle(onceki.infaz_tamamlanma_tarihi, yil);
  const c = karsilastir(yeniSuc, bitis);
  return {
    yil,
    bitis,
    doldu: c > 0 ? true : c < 0 ? false : null,
    neden: c === 0 ? `Yeni suç ${yil} yıllık sürenin son günü (${trTarih(bitis)}) işlenmiş; sınır günü hukuki inceleme gerektirir.` : `${yil} yıllık tekerrür süresi ${trTarih(bitis)} tarihinde ${c > 0 ? 'dolmuş' : 'dolmamış'}.`,
  };
}

export function oncekiBaglami(kt, vaka, ilam, onceki) {
  const sure = tekerrurSuresi(kt, onceki, ilam.suc_tarihi);
  const askeri = onceki.sirf_askeri_suc === null ? null : !onceki.sirf_askeri_suc;
  const yabanci = onceki.yabanci_mahkeme_karari === null ? null : onceki.yabanci_mahkeme_karari === false ? true : onceki.yabanci_istisna_sucu;
  return {
    baglam: {
      kisi: { suc_yasi: sucYasi(vaka, ilam.suc_tarihi) },
      ilam: { suc_tarihi: ilam.suc_tarihi, kast_grubu: KAST_GRUBU[ilam.kast_turu] ?? null },
      onceki: {
        kesinlesme_tarihi: onceki.kesinlesme_tarihi,
        suc_yasi: onceki.suclunun_o_tarihteki_yasi ?? sucYasi(vaka, onceki.suc_tarihi),
        kast_grubu: KAST_GRUBU[onceki.kast_turu] ?? null,
        infaz_durumu: onceki.infaz_durumu === 'bilinmiyor' ? null : onceki.infaz_durumu,
        kanuni_tekerrur_suresi_doldu: sure.doldu,
        aciklanmamis_HAGB: onceki.karar_turu === null ? null : onceki.karar_turu === 'hagb',
        CMK272_3_engeli: onceki.cmk_272_3_engeli,
        hukuken_ortadan_kalkmis: onceki.infaz_durumu === 'hukuken_kalkti' ? true : onceki.infaz_durumu ? false : null,
        askeri_uyum_sarti_saglandi: askeri,
        yabanci_hukum_sarti_saglandi: yabanci,
        gecerli_tekerrur_uygulanmis_hukum: onceki.tekerrur_uygulanmis_mi,
      },
    },
    sure,
  };
}

export function tekerrurTespit(kt, motor, vaka, ilam) {
  const onceki = vaka.onceki_mahkumiyetler || [];
  const degerlendirmeler = onceki.map((o, i) => {
    const { baglam, sure } = oncekiBaglami(kt, vaka, ilam, o);
    const kosullar = ['D100', 'D101', 'D102', 'D103', 'D104'].map((id) => {
      const s = motor.degerlendir(id, baglam);
      return { dugum_id: id, ad: s.ad, deger: s.deger, belirsiz_alanlar: s.belirsiz_alanlar, aciklama: s.deger === false ? DUGUM_ACIKLAMA[id].yanlis : s.deger === null ? DUGUM_ACIKLAMA[id].belirsiz : null };
    });
    const aday = motor.degerlendir('D105', baglam);
    const zincir = motor.degerlendir('D106', baglam);
    const nedenler = kosullar.filter((k) => k.aciklama).map((k) => ({ dugum_id: k.dugum_id, deger: k.deger, metin: k.aciklama + (k.dugum_id === 'D103' && sure.neden ? ` ${sure.neden}` : '') }));
    if (o.sirf_askeri_suc === true) nedenler.push({ dugum_id: 'D104', deger: null, metin: 'Yeni suçun da sırf askerî suç olmadığı kabul edildi.' });
    return {
      sira: i + 1,
      ilam_id: o.ilam_id,
      sonuc: aday.deger === true ? 'esas' : aday.deger === false ? 'esas_degil' : 'belirsiz',
      ikinci_zincir: zincir.deger,
      kosullar,
      nedenler,
      tekerrur_suresi: sure.bitis ? { yil: sure.yil, bitis: sure.bitis, doldu: sure.doldu } : null,
      onceki: o,
    };
  });

  const yeniYas = sucYasi(vaka, ilam.suc_tarihi);
  const esas = degerlendirmeler.filter((d) => d.sonuc === 'esas');
  const belirsiz = degerlendirmeler.filter((d) => d.sonuc === 'belirsiz');
  const uyarilar = [];
  let aday = null;

  if (yeniYas !== null && yeniYas < 18) {
    aday = 'uygulanmaz';
    uyarilar.push({ kod: 'R013', seviye: 'bilgi', mesaj: 'Yeni suç 18 yaşından önce işlenmiş; tekerrür hükümleri uygulanmaz (TCK 58/5).' });
  } else if (esas.length) {
    const ikinci = esas.some((d) => d.ikinci_zincir === true);
    const ikinciBelirsiz = !ikinci && esas.some((d) => d.ikinci_zincir === null);
    aday = ikinci ? 'ikinci' : ikinciBelirsiz ? 'birinci_veya_ikinci' : 'birinci';
    if (ikinciBelirsiz) uyarilar.push({ kod: 'R014', seviye: 'varsayim', mesaj: 'Tekerrüre esas ilamlarda daha önce geçerli tekerrür uygulanıp uygulanmadığı bilinmiyor; ikinci tekerrür zinciri ayrılamadı.' });
  } else if (belirsiz.length) {
    aday = 'belirsiz';
    uyarilar.push({ kod: 'E002', seviye: 'varsayim', mesaj: 'Hiçbir önceki ilam kesin olarak tekerrüre esas çıkmadı, ancak eksik bilgi var; derece belirsiz.' });
  } else if (degerlendirmeler.length || vaka.onceki_mahkumiyet_kayitlari_tam_mi === true) {
    aday = vaka.onceki_mahkumiyet_kayitlari_tam_mi === true ? 'yok' : 'belirsiz';
    if (aday === 'belirsiz') uyarilar.push({ kod: 'E002', seviye: 'varsayim', mesaj: 'Girilen kayıtlarda tekerrüre esas ilam bulunamadı; ancak adli sicil kaydının tam olduğu teyit edilmedi.' });
  }

  // 108/2: tekerrüre esas alınan en ağır (süreli hapis) ceza
  let enAgir = null;
  let enAgirIlam = null;
  for (const d of esas) {
    const o = d.onceki;
    if (o.ceza_turu !== 'adli_para' && o.ceza && (!enAgir || cezaKarsilastir(o.ceza, enAgir, o.kesinlesme_tarihi || ilam.suc_tarihi) > 0)) {
      enAgir = o.ceza;
      enAgirIlam = o.ilam_id;
    }
  }
  if (esas.length && !enAgir) uyarilar.push({ kod: 'R027', seviye: 'varsayim', mesaj: 'Tekerrüre esas ilamlarda süreli hapis miktarı yok; 108/2 üst sınırı otomatik belirlenemedi.' });

  const hukumde = ilam.hukumdeki_tekerrur;
  let uyusuyor = null;
  if (hukumde && hukumde !== 'belirsiz' && hukumde !== '58_9_ozel_tehlikelilik' && aday && !['belirsiz', 'birinci_veya_ikinci'].includes(aday)) {
    uyusuyor = hukumde === (aday === 'uygulanmaz' ? 'yok' : aday);
    if (!uyusuyor) uyarilar.push({ kod: 'E004', seviye: 'inceleme', mesaj: `Belgelerden aday "${adayMetni(aday)}", hükümde "${adayMetni(hukumde)}". İnfaz kesin hükme göre yapılır; uyuşmazlık hukuki inceleme gerektirir (R014).` });
  }
  if (hukumde === '58_9_ozel_tehlikelilik') uyarilar.push({ kod: 'R016', seviye: 'inceleme', mesaj: 'TCK 58/9 özel tehlikeli suçlu statüsü birinci/ikinci tekerrür etiketiyle aynı değildir; ayrı inceleme gerekir.' });

  return {
    belgelerden_aday_tespit: aday,
    hukumde_uygulanan: hukumde,
    uyusuyor_mu: uyusuyor,
    dayanak_ilamlar: esas.map((d) => d.ilam_id),
    eleme_nedenleri: degerlendirmeler.filter((d) => d.sonuc !== 'esas').map((d) => ({ ilam: d.ilam_id, sonuc: d.sonuc, nedenler: d.nedenler.map((n) => n.metin) })),
    tekerrure_esas_en_agir_ceza: enAgir,
    tekerrure_esas_en_agir_ilam: enAgirIlam,
    tekerrure_esas_en_agir_ceza_metni: enAgir ? cezaMetni(enAgir) : null,
    yeni_sucta_yas: yeniYas,
    degerlendirmeler,
    uyarilar,
  };
}

export function adayMetni(a) {
  return (
    {
      yok: 'Tekerrür yok',
      birinci: 'Birinci tekerrür',
      ikinci: 'İkinci tekerrür',
      birinci_veya_ikinci: 'Birinci veya ikinci tekerrür (belirsiz)',
      belirsiz: 'Belirsiz',
      uygulanmaz: 'Uygulanmaz (18 yaş altı)',
      '58_9_ozel_tehlikelilik': 'TCK 58/9 özel tehlikelilik',
    }[a] || '—'
  );
}
