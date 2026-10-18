// Suç seçimini kolaylaştırmak için sık karşılaşılan madde başlıkları ve arama.
// Yalnız gösterim amaçlıdır; özel oran ve istisna kapsamı kural tabanındaki
// seçicilerle (kanun/madde/fıkra/bent tam eşleşmesi) belirlenir.
export const TCK_MADDELERI = [
  ['81', 'Kasten öldürme'],
  ['82', 'Kasten öldürmenin nitelikli halleri'],
  ['83', 'Kasten öldürmenin ihmali davranışla işlenmesi'],
  ['85', 'Taksirle öldürme'],
  ['86', 'Kasten yaralama'],
  ['87', 'Neticesi sebebiyle ağırlaşmış yaralama'],
  ['89', 'Taksirle yaralama'],
  ['94', 'İşkence'],
  ['95', 'Neticesi sebebiyle ağırlaşmış işkence'],
  ['96', 'Eziyet'],
  ['102', 'Cinsel saldırı'],
  ['103', 'Çocukların cinsel istismarı'],
  ['104', 'Reşit olmayanla cinsel ilişki'],
  ['105', 'Cinsel taciz'],
  ['106', 'Tehdit'],
  ['108', 'Cebir'],
  ['109', 'Kişiyi hürriyetinden yoksun kılma'],
  ['116', 'Konut dokunulmazlığının ihlali'],
  ['125', 'Hakaret'],
  ['132', 'Haberleşmenin gizliliğini ihlal'],
  ['133', 'Kişiler arasındaki konuşmaların dinlenmesi ve kayda alınması'],
  ['134', 'Özel hayatın gizliliğini ihlal'],
  ['135', 'Kişisel verilerin kaydedilmesi'],
  ['136', 'Verileri hukuka aykırı olarak verme veya ele geçirme'],
  ['137', 'Nitelikli haller (m.135-136)'],
  ['138', 'Verileri yok etmeme'],
  ['141', 'Hırsızlık'],
  ['142', 'Nitelikli hırsızlık'],
  ['148', 'Yağma'],
  ['149', 'Nitelikli yağma'],
  ['151', 'Mala zarar verme'],
  ['155', 'Güveni kötüye kullanma'],
  ['157', 'Dolandırıcılık'],
  ['158', 'Nitelikli dolandırıcılık'],
  ['170', 'Genel güvenliğin kasten tehlikeye sokulması'],
  ['179', 'Trafik güvenliğini tehlikeye sokma'],
  ['188', 'Uyuşturucu veya uyarıcı madde imal ve ticareti'],
  ['191', 'Kullanmak için uyuşturucu veya uyarıcı madde satın almak, kabul etmek veya bulundurmak'],
  ['204', 'Resmî belgede sahtecilik'],
  ['207', 'Özel belgede sahtecilik'],
  ['220', 'Suç işlemek amacıyla örgüt kurma'],
  ['235', 'İhaleye fesat karıştırma'],
  ['245', 'Banka veya kredi kartlarının kötüye kullanılması'],
  ['247', 'Zimmet'],
  ['250', 'İrtikap'],
  ['252', 'Rüşvet'],
  ['265', 'Görevi yaptırmamak için direnme'],
  ['267', 'İftira'],
  ['282', 'Suçtan kaynaklanan malvarlığı değerlerini aklama'],
  ['302', 'Devletin birliğini ve ülke bütünlüğünü bozmak'],
  ['309', 'Anayasayı ihlal'],
  ['314', 'Silahlı örgüt'],
  ['328', 'Siyasal veya askerî casusluk'],
];

// TCK dışındaki sık suçlar: [kanun, madde, ad].
export const DIGER_SUCLAR = [
  [6136, '13', 'Ruhsatsız silah taşıma veya bulundurma (6136)'],
  [5607, '3', 'Kaçakçılık (5607)'],
  [5941, '7', 'Çek Kanunu hapis gerektiren suçlar (5941)'],
  [2863, '74', 'Kültür varlıkları kaçakçılığı (2863)'],
  [4733, '8', 'Tütün ve alkol kaçakçılığı (4733)'],
];

const sade = (s) =>
  String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
    .replace(/\s+/g, ' ')
    .trim();

const KATALOG = [
  ...TCK_MADDELERI.map(([madde, ad]) => ({ kanun: 5237, madde, ad, etiket: `TCK ${madde}` })),
  ...DIGER_SUCLAR.map(([kanun, madde, ad]) => ({ kanun, madde, ad, etiket: `${kanun} s.K. m.${madde}` })),
].map((s) => ({ ...s, anahtar: sade(`${s.ad} ${s.madde} ${s.etiket}`) }));

// "142", "142/1-b", "hırsız", "nitelikli hirsizlik" gibi sorgulara uyan kayıtlar.
export function sucAra(sorgu, sinir = 8) {
  const q = sade(sorgu);
  if (!q) return KATALOG.filter((s) => ['141', '142', '157', '158', '188', '86', '81', '102', '148', '106'].includes(s.madde) && s.kanun === 5237).slice(0, sinir);
  const no = /^(\d+(?:\/[a-z])?)/.exec(q)?.[1];
  const kelimeler = q.split(' ');
  const puanli = KATALOG.map((s) => {
    let p = 0;
    if (no && s.madde.toLowerCase() === no) p += 10;
    if (kelimeler.every((k) => s.anahtar.includes(k))) p += 5;
    if (sade(s.ad).startsWith(q)) p += 2;
    return { s, p };
  }).filter((x) => x.p > 0);
  return puanli.sort((a, b) => b.p - a.p).slice(0, sinir).map((x) => x.s);
}

// Serbest yazılan "142/1-b" → { madde, fikra, bent }.
export function maddeCoz(metin) {
  const m = /^\s*(\d+(?:\/[a-zA-Z])?)\s*(?:\/\s*(\d+))?\s*(?:[-.]?\s*([a-zçğıöşü]))?\s*$/i.exec(String(metin ?? ''));
  if (!m) return null;
  if (/^0+(?:\/|$)/.test(m[1]) || (m[2] && !/^[1-9]\d*$/.test(m[2]))) return null;
  return { madde: m[1].replace(/^0+(?=\d)/, '').toUpperCase(), fikra: m[2] || null, bent: m[3] ? m[3].toLowerCase() : null };
}

export function sucAdi(suc) {
  if (!suc) return null;
  const k = KATALOG.find((s) => s.kanun === suc.kanun && s.madde === suc.madde);
  return k ? k.ad : null;
}

export function maddeEtiketi(suc) {
  if (!suc) return '';
  const alt = `${suc.fikra ? '/' + suc.fikra : ''}${suc.bent ? '-' + suc.bent : ''}`;
  return suc.kanun === 5237 ? `TCK ${suc.madde}${alt}` : `${suc.kanun ?? '?'} s.K. m.${suc.madde}${alt}`;
}
