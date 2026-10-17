// Tekerrür adayı tespiti (TCK 58; R010-R016). Yazılım tekerrürü "uygulamaz"; önceki
// mahkûmiyet belgelerinden aday zinciri kurar ve hükümdeki uygulamayla karşılaştırır.
// Mahkûmiyet sayısı tekerrür derecesi değildir (R014).

import { gecerliTarih, karsilastir, yilEkle, cezaKarsilastir, yasHesapla, trTarih } from './tarih.js';

const KAST_GRUBU = { kasit: 'kast', olasi_kast: 'kast', taksir: 'taksir', bilincli_taksir: 'taksir' };

function neden(kural_id, metin, etki) {
  return { kural_id, metin, etki }; // etki: 'eler' | 'belirsiz' | 'kabul' | 'bilgi'
}

// Tek bir önceki mahkûmiyetin yeni suç bakımından tekerrüre esas olup olamayacağı.
export function oncekiMahkumiyetDegerlendir(kt, onceki, yeni) {
  const n = [];
  const r11 = kt.p('R011');
  const yeniSuc = yeni.suc_tarihi;

  // HAGB ve tekerrüre esas alınamayan kararlar (R015)
  if (onceki.karar_turu === 'hagb') {
    n.push(neden('R015', 'Hükmün açıklanmasının geri bırakılması kararı mahkûmiyet değildir; sabıka sayısı olarak kullanılamaz (CMK 231).', 'eler'));
  }
  if (onceki.tekerrure_esas_olamaz === true) {
    n.push(neden('R015', 'Tekerrüre esas alınamayacağına ilişkin karar/engel bildirildi (CMK 272/3, af, uyarlama vb.).', 'eler'));
  } else if (onceki.tekerrure_esas_olamaz == null) {
    n.push(neden('R015', 'CMK 272/3, af veya uyarlama gibi bir tekerrür engeli bulunmadığı varsayıldı; belgeyle teyit edilmeli.', 'varsayim'));
  }

  // Kesinleşme sırası (R010)
  if (!gecerliTarih(onceki.kesinlesme_tarihi)) {
    n.push(neden('R010', 'Önceki hükmün kesinleşme tarihi yok (E003).', 'belirsiz'));
  } else if (!gecerliTarih(yeniSuc)) {
    n.push(neden('R010', 'Yeni suç tarihi yok.', 'belirsiz'));
  } else {
    const c = karsilastir(onceki.kesinlesme_tarihi, yeniSuc);
    if (c > 0) {
      n.push(neden('R010', `Önceki hüküm ${trTarih(onceki.kesinlesme_tarihi)} tarihinde, yani yeni suçtan (${trTarih(yeniSuc)}) sonra kesinleşmiş; tekerrüre esas olamaz (TCK 58/1).`, 'eler'));
    } else if (c === 0) {
      n.push(neden('R010', 'Kesinleşme ile yeni suç aynı gün; sıra belgeyle belirlenmeli (hukuki inceleme).', 'belirsiz'));
    } else {
      n.push(neden('R010', `Önceki hüküm yeni suçtan önce (${trTarih(onceki.kesinlesme_tarihi)}) kesinleşmiş; cezanın çekilmiş olması şart değildir.`, 'kabul'));
    }
  }

  // 18 yaş (R013, TCK 58/5)
  let yas = null;
  if (gecerliTarih(yeni.dogum_tarihi) && gecerliTarih(onceki.suc_tarihi)) {
    yas = yasHesapla(yeni.dogum_tarihi, onceki.suc_tarihi);
  } else if (Number.isInteger(onceki.suclunun_o_tarihteki_yasi)) {
    yas = onceki.suclunun_o_tarihteki_yasi;
  }
  if (yas === null) {
    n.push(neden('R013', 'Önceki suç tarihindeki yaş bilinmiyor; 18 yaş ve üzeri olduğu varsayıldı.', 'varsayim'));
  } else if (yas < 18) {
    n.push(neden('R013', `Önceki suç ${yas} yaşında işlenmiş; 18 yaşından önce işlenen suç tekerrüre esas olmaz (TCK 58/5).`, 'eler'));
  }

  // Kast / taksir (R012, TCK 58/4)
  const g1 = KAST_GRUBU[onceki.kast_turu];
  const g2 = KAST_GRUBU[yeni.kast_turu];
  if (!g1 || !g2) {
    n.push(neden('R012', 'Önceki veya yeni suçun kast/taksir türü bilinmiyor.', 'belirsiz'));
  } else if (g1 !== g2) {
    n.push(neden('R012', 'Kasıtlı suçlarla taksirli suçlar arasında tekerrür uygulanmaz (TCK 58/4).', 'eler'));
  }

  if (onceki.sirf_askeri_suc === true) {
    n.push(neden('R012', 'Sırf askerî suç ile diğer suçlar arasında tekerrür uygulanmaz (TCK 58/4).', 'eler'));
  }

  if (onceki.yabanci_mahkeme_karari === true) {
    if (onceki.yabanci_istisna_sucu === true) {
      n.push(neden('R012', 'Yabancı mahkeme kararı; TCK 58/4 istisna suçlarından (kasten öldürme, kasten yaralama, yağma, dolandırıcılık, uyuşturucu imal/ticaret, para veya kıymetli damga sahteciliği) olduğu bildirildi.', 'kabul'));
    } else if (onceki.yabanci_istisna_sucu === false) {
      n.push(neden('R012', 'Yabancı mahkeme kararları, istisna suçlar dışında tekerrüre esas olmaz (TCK 58/4).', 'eler'));
    } else {
      n.push(neden('R012', 'Yabancı mahkeme kararının TCK 58/4 istisna suçlarından olup olmadığı bilinmiyor.', 'belirsiz'));
    }
  }

  // Tekerrür süresi (R011, TCK 58/2)
  const durum = onceki.infaz_durumu;
  if (durum === 'baslamadi' || durum === 'suruyor') {
    n.push(neden('R011', 'Önceki cezanın infazı tamamlanmamış; tekerrür süresi işlemeye başlamamıştır (önceki cezanın çekilmemiş olması tek başına eleme nedeni değildir).', 'kabul'));
  } else if (durum === 'tamamlandi') {
    if (!gecerliTarih(onceki.infaz_tamamlanma_tarihi)) {
      n.push(neden('R011', 'İnfaz tamamlandı bildirildi ancak hukuken tamamlanma tarihi yok.', 'belirsiz'));
    } else {
      let sureYil = r11.onceki_hapis_en_fazla_5_yil_sure_yil;
      if (onceki.ceza_turu === 'adli_para') {
        sureYil = r11.onceki_adli_para_sure_yil;
      } else if (onceki.ceza_turu === 'muebbet' || onceki.ceza_turu === 'agirlastirilmis_muebbet') {
        sureYil = r11.onceki_hapis_5_yildan_fazla_sure_yil;
      } else if (onceki.ceza) {
        const ref = gecerliTarih(onceki.kesinlesme_tarihi) ? onceki.kesinlesme_tarihi : onceki.infaz_tamamlanma_tarihi;
        if (cezaKarsilastir(onceki.ceza, { yil: 5, ay: 0, gun: 0 }, ref) > 0) sureYil = r11.onceki_hapis_5_yildan_fazla_sure_yil;
      } else {
        n.push(neden('R011', 'Önceki cezanın miktarı yok; 3/5 yıllık süre belirlenemez.', 'belirsiz'));
      }
      if (onceki.ceza_turu === 'adli_para' || onceki.ceza) {
        const bitis = yilEkle(onceki.infaz_tamamlanma_tarihi, sureYil);
        const c = gecerliTarih(yeniSuc) ? karsilastir(yeniSuc, bitis) : null;
        if (c === null) {
          n.push(neden('R011', 'Yeni suç tarihi olmadan tekerrür süresi sınanamaz.', 'belirsiz'));
        } else if (c > 0) {
          n.push(neden('R011', `Tekerrür süresi (${sureYil} yıl) ${trTarih(bitis)} tarihinde dolmuş; yeni suç bu tarihten sonra işlenmiş (TCK 58/2).`, 'eler'));
        } else if (c === 0) {
          n.push(neden('R011', `Yeni suç, ${sureYil} yıllık tekerrür süresinin son günü (${trTarih(bitis)}) işlenmiş; sınır günü hukuki inceleme gerektirir.`, 'belirsiz'));
        } else {
          n.push(neden('R011', `Yeni suç, ${sureYil} yıllık tekerrür süresi içinde (bitiş ${trTarih(bitis)}).`, 'kabul'));
        }
      }
    }
  } else if (durum === 'hukuken_kalkti') {
    n.push(neden('R015', 'Önceki ceza hukuken ortadan kalkmış (af, uyarlama vb.); tekerrüre esas olup olmadığı hukuki inceleme gerektirir.', 'belirsiz'));
  } else {
    n.push(neden('R011', 'Önceki cezanın infaz durumu bilinmiyor (E002).', 'belirsiz'));
  }

  const sonuc = n.some((x) => x.etki === 'eler') ? 'esas_degil' : n.some((x) => x.etki === 'belirsiz') ? 'belirsiz' : 'esas';
  return { ilam_id: onceki.ilam_id || null, sonuc, nedenler: n, onceki };
}

// Bütün önceki mahkûmiyetlerden aday derece. Dönüş: aday 'yok'|'birinci'|'ikinci'|
// 'birinci_veya_ikinci'|'belirsiz'|'uygulanmaz'|null (veri yok).
export function tekerrurTespit(kt, vaka) {
  const ilam = vaka.ilam || {};
  const onceki = Array.isArray(vaka.onceki_mahkumiyetler) ? vaka.onceki_mahkumiyetler : [];
  const yeni = {
    suc_tarihi: ilam.suc_tarihi,
    kast_turu: ilam.kast_turu,
    dogum_tarihi: vaka.dogum_tarihi,
  };
  const degerlendirmeler = onceki.map((o, i) => ({
    ...oncekiMahkumiyetDegerlendir(kt, o, yeni),
    sira: i + 1,
  }));
  const uyarilar = [];
  let aday = null;

  const yeniYas = gecerliTarih(vaka.dogum_tarihi) && gecerliTarih(ilam.suc_tarihi) ? yasHesapla(vaka.dogum_tarihi, ilam.suc_tarihi) : null;

  const esas = degerlendirmeler.filter((d) => d.sonuc === 'esas');
  const belirsiz = degerlendirmeler.filter((d) => d.sonuc === 'belirsiz');

  if (yeniYas !== null && yeniYas < 18) {
    aday = 'uygulanmaz';
    uyarilar.push({ kod: 'R013', mesaj: 'Yeni suç 18 yaşından önce işlenmiş; tekerrür hükümleri uygulanmaz (TCK 58/5).' });
  } else if (esas.length) {
    const ikinci = esas.some((d) => d.onceki.tekerrur_uygulanmis_mi === true);
    const ikinciBelirsiz = !ikinci && esas.some((d) => d.onceki.tekerrur_uygulanmis_mi == null);
    aday = ikinci ? 'ikinci' : ikinciBelirsiz ? 'birinci_veya_ikinci' : 'birinci';
    if (ikinciBelirsiz) {
      uyarilar.push({ kod: 'R014', mesaj: 'Tekerrüre esas ilamlarda daha önce tekerrür uygulanıp uygulanmadığı bilinmiyor; ikinci tekerrür ayrımı yapılamadı.' });
    }
  } else if (belirsiz.length) {
    aday = 'belirsiz';
  } else if (degerlendirmeler.length || vaka.onceki_mahkumiyet_kayitlari_tam_mi === true) {
    aday = vaka.onceki_mahkumiyet_kayitlari_tam_mi === true ? 'yok' : 'belirsiz';
    if (vaka.onceki_mahkumiyet_kayitlari_tam_mi !== true) {
      uyarilar.push({ kod: 'E002', mesaj: 'Girilen kayıtlarda tekerrüre esas ilam bulunamadı; ancak sabıka kaydının tam olduğu teyit edilmedi.' });
    }
  }

  // 108/2 için tekerrüre esas en ağır hapis cezası
  let enAgir = null;
  let enAgirIlam = null;
  for (const d of esas) {
    const o = d.onceki;
    if (o.ceza_turu === 'sureli_hapis' && o.ceza) {
      const ref = gecerliTarih(o.kesinlesme_tarihi) ? o.kesinlesme_tarihi : ilam.suc_tarihi;
      if (!enAgir || cezaKarsilastir(o.ceza, enAgir, ref) > 0) {
        enAgir = o.ceza;
        enAgirIlam = o.ilam_id || `#${d.sira}`;
      }
    }
  }
  if (esas.length && !enAgir) {
    uyarilar.push({ kod: 'R027', mesaj: 'Tekerrüre esas ilamlarda süreli hapis cezası miktarı yok; 108/2 üst sınırı otomatik belirlenemedi.' });
  }

  const hukumde = ilam.hukumdeki_tekerrur ?? null;
  let uyusuyor = null;
  if (hukumde && hukumde !== 'belirsiz' && aday && !['belirsiz', 'birinci_veya_ikinci'].includes(aday)) {
    const h = hukumde === '58_9_ozel_tehlikelilik' ? null : hukumde;
    const a = aday === 'uygulanmaz' ? 'yok' : aday;
    if (h !== null) uyusuyor = h === a;
    if (uyusuyor === false) {
      uyarilar.push({ kod: 'E004', mesaj: `Belgelerden aday "${adayMetni(aday)}", hükümde "${adayMetni(hukumde)}". İnfaz kesin hükme göre yapılır; uyuşmazlık hukuki inceleme gerektirir (R014).` });
    }
  }
  if (hukumde === '58_9_ozel_tehlikelilik') {
    uyarilar.push({ kod: 'R016', mesaj: 'TCK 58/9 özel tehlikeli suçlu statüsü birinci/ikinci tekerrür etiketiyle aynı değildir; ayrı inceleme gerekir.' });
  }

  return {
    belgelerden_aday_tespit: aday,
    hukumde_uygulanan: hukumde,
    uyusuyor_mu: uyusuyor,
    dayanak_ilamlar: esas.map((d) => d.ilam_id || `#${d.sira}`),
    eleme_nedenleri: degerlendirmeler
      .filter((d) => d.sonuc !== 'esas')
      .map((d) => ({ ilam: d.ilam_id || `#${d.sira}`, sonuc: d.sonuc, nedenler: d.nedenler.filter((x) => x.etki === 'eler' || x.etki === 'belirsiz').map((x) => x.metin) })),
    tekerrure_esas_en_agir_ceza: enAgir,
    tekerrure_esas_en_agir_ilam: enAgirIlam,
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
