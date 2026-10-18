// Lemur açılır pencereleri içerik ölçülmeden daraltabiliyor. Hesabı tarayıcının
// açılır pencere kabı yerine doğrudan kendi sekmesinde başlat.
// Sekme oluşturmak için ek bir "tabs" izni gerekmez; dosya depoda korunur.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?tam=1') }).catch((hata) => {
    console.error('Hesap sekmesi açılamadı:', hata.message);
  });
});
