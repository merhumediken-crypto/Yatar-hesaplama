// 5941 sayılı Çek Kanunu modülü (cek_modulu; R100-R114; D002, D003, D040-D045).
//
// Çek dosyasında önce doğru rejim seçilir: m.5/1 karşılıksız çek adli parası
// (ödenmezse m.5/11 ile doğrudan hapse çevrilir; KS ve 105/A yok) ile m.7
// suçlarının hapis cezası (genel süreli hapis yolu) birbirinden ayrılır.
// Ödeme ve vazgeçme yolları birbirinden bağımsız izlenir; hiçbiri otomatik tahliye üretmez.

export function cekDegerlendir(kt, motor, baglam) {
  if (baglam.ilam.kanun !== 5941) return null;
  const d = (id) => motor.degerlendir(id, baglam);
  const ozel = d('D002');
  const genel = d('D003');
  const m6 = d('D040');
  const vazgecme = d('D041');
  const g5 = d('D042');
  const aksama1 = d('D043');
  const aksama2 = d('D044');
  const devlet = d('D045');

  let yol = 'belirsiz';
  if (ozel.deger === true) yol = 'cek_5_11';
  else if (genel.deger === true) yol = 'genel_sureli_hapis';
  else if (baglam.ilam.madde === '5' && baglam.ilam.ceza_turu === 'adli_para') yol = 'adli_para';

  const talepler = [];
  if (m6.deger === true) talepler.push({ dugum_id: 'D040', metin: `Mahkemeden istenebilecek: ${m6.sonuc_adayi.mahkemeden_istenebilecek}. Otomatik tahliye yok.`, kural: 'R106' });
  if (vazgecme.deger === true) talepler.push({ dugum_id: 'D041', metin: `Mahkemeden istenebilecek: ${vazgecme.sonuc_adayi.mahkemeden_istenebilecek}. Yalnız sözlü beyanla sonuç doğmaz.`, kural: 'R107' });
  if (devlet.deger === true) talepler.push({ dugum_id: 'D045', metin: 'Kalan infaz günlerinin karşılığı devlete ödendi: 5275 m.106/8 sonuçları incelenir; çek borcu kendiliğinden sona ermez.', kural: 'R105' });

  const gecis = [];
  if (g5.deger === true) gecis.push({ dugum_id: 'D042', metin: 'Suç tarihi 30/04/2021 ve öncesi: geçici m.5 tarih kapsamında. 30/06/2022 onda bir ödemesi ve kararlar ayrıca doğrulanır; bugün yeni ödeme planı başlatılmaz.', kural: 'R109' });
  else if (g5.deger === false && baglam.ilam.madde === '5') gecis.push({ dugum_id: 'D042', metin: 'Suç tarihi 30/04/2021 sonrası: geçici m.5 kapsamı dışında.', kural: 'R109' });
  if (aksama1.deger === true) gecis.push({ dugum_id: 'D043', metin: 'İlk taksit aksaması: eksik taksit planın sonuna eklenir; karar ve plan denetimi gerekir.', kural: 'R110' });
  if (aksama2.deger === true) gecis.push({ dugum_id: 'D044', metin: 'İkinci aksama: alacaklı şikâyeti ve mahkemenin infaza devam kararı incelenir; kendiliğinden cezaevine dönüş yok.', kural: 'R110' });

  const r106 = kt.p('R106');
  const r108 = kt.p('R108');
  return {
    yol,
    dugumler: [ozel, genel, m6, vazgecme, g5, aksama1, aksama2, devlet].map(({ iz, ...s }) => s),
    talepler,
    gecis,
    bilgiler: [
      { metin: `m.6/1 tam ödeme: çek bedeli + ${r106.faiz_turu} faizi (${r106.faiz_baslangici} itibarıyla). Faiz oran tablosu pakette olmadığından tutar hesaplanmaz.`, kural: 'R106' },
      { metin: 'm.5/1 alt sınırındaki AYM iptali, m.6/1 faizini kendiliğinden kaldırmaz.', kural: 'R113' },
      { metin: `Çek düzenleme yasağının kaldırılması: tam infazdan sonra ${r108.tam_infazdan_sonra_yil} yıl ve her hâlde yasağın konulmasından ${r108.yasagin_konulmasindan_her_halde_yil} yıl; mahkeme talep ve kararı gerekir.`, kural: 'R108' },
    ],
    kurallar: kt.paket.cek_modulu.dayanak_kurallar,
  };
}
