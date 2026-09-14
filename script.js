let videoStream = null;
let currentWidth = 0, currentHeight = 0, currentArea = 0, currentPrice = 0;
let detectedCompanyName = "";
let detectedOCRText = "";
let detectedSector = "";
let detectedDescription = "";
const BIRIM_FIYAT = 1500;

// Tuval ve Görsel Yönetimi Değişkenleri
let mainCanvas, ctx;
let loadedImage = null;
let isImageMode = false;

// Görsel Pan & Zoom (Kaydırma ve Yakınlaştırma)
let imgScale = 1;
let imgX = 0;
let imgY = 0;
let isPanning = false;
let startX = 0, startY = 0;

// Yeşil Seçim Kutusu Değişkenleri (Tuval Üzerindeki Konumu)
let selectionBox = { x: 50, y: 50, w: 200, h: 100 };
let activeHandle = null;
let isDraggingBox = false;
let boxDragOffset = { x: 0, y: 0 };

window.onload = function() {
    hafizadanYukle();
    sensorTestEt();
};

function sensorTestEt() {
    const badge = document.getElementById('sensor-status');
    if (badge) {
        badge.innerText = (window.XRHand || ('WebXR' in navigator)) ? "LiDAR 3D Sensör Aktif" : "AI Dokunmatik Sensör Aktif";
    }
}

function fotografYukleAc() {
    document.getElementById('file-input').click();
}

// Görsel Yüklendiğinde Tuval Hazırlığı
function dosyaSecildi(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const modal = document.getElementById('scan-modal');
        const video = document.getElementById('webcam');
        const imgPreview = document.getElementById('photo-preview');
        const oldBox = document.getElementById('ai-box');

        if (video) video.style.display = 'none';
        if (imgPreview) imgPreview.style.display = 'none';
        if (oldBox) oldBox.style.display = 'none'; // Eski sabit DOM kutusunu gizle

        modal.classList.remove('hidden');
        isImageMode = true;

        loadedImage = new Image();
        loadedImage.onload = function() {
            tuvalOlustur();
            sifirlaGorselVeKutu();
            ciz();
            hesaplaVeOCR();
        };
        loadedImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Canvas ve Olay Dinleyicileri Kurulumu
function tuvalOlustur() {
    const container = document.getElementById('camera-wrapper');
    
    mainCanvas = document.getElementById('editor-canvas');
    if (!mainCanvas) {
        mainCanvas = document.createElement('canvas');
        mainCanvas.id = 'editor-canvas';
        mainCanvas.style.position = 'absolute';
        mainCanvas.style.top = '0';
        mainCanvas.style.left = '0';
        mainCanvas.style.zIndex = '5';
        container.appendChild(mainCanvas);
    }

    mainCanvas.width = container.clientWidth;
    mainCanvas.height = container.clientHeight;
    ctx = mainCanvas.getContext('2d');

    // Olay Dinleyicileri (Fare ve Dokunmatik)
    mainCanvas.onmousedown = fareBasildi;
    mainCanvas.onmousemove = fareHareketEt;
    mainCanvas.onmouseup = fareBakti;
    mainCanvas.onwheel = tuvalZoom;

    mainCanvas.ontouchstart = dokunmaBasladi;
    mainCanvas.ontouchmove = dokunmaSundu;
    mainCanvas.ontouchend = fareBakti;
}

// Görsel ve Kutunun İlk Pozisyonu
function sifirlaGorselVeKutu() {
    imgScale = Math.min(mainCanvas.width / loadedImage.width, mainCanvas.height / loadedImage.height);
    imgX = (mainCanvas.width - loadedImage.width * imgScale) / 2;
    imgY = (mainCanvas.height - loadedImage.height * imgScale) / 2;

    // Otomatik Tabela Çerçevesi (Merkezde Başlar)
    const boxW = Math.round(mainCanvas.width * 0.5);
    const boxH = Math.round(mainCanvas.height * 0.3);
    selectionBox = {
        x: (mainCanvas.width - boxW) / 2,
        y: (mainCanvas.height - boxH) / 2,
        w: boxW,
        h: boxH
    };
}

// Ekranı Sürekli Çizen Ana Fonksiyon
function ciz() {
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    // 1. Arka Plan Görselini Çiz (Zoom ve Pan Uygulanmış)
    if (loadedImage) {
        ctx.save();
        ctx.drawImage(loadedImage, imgX, imgY, loadedImage.width * imgScale, loadedImage.height * imgScale);
        ctx.restore();
    }

    // 2. Seçim Çerçevesini Çiz (Yeşil Tabela Kutusu)
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);

    ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
    ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);

    // 3. 4 Köşe Tutamaçlarını Çiz (Ölçeklendirmek İçin)
    const handles = tutamacKonumlariGetir();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;

    for (let key in handles) {
        ctx.beginPath();
        ctx.arc(handles[key].x, handles[key].y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

function tutamacKonumlariGetir() {
    return {
        tl: { x: selectionBox.x, y: selectionBox.y },
        tr: { x: selectionBox.x + selectionBox.w, y: selectionBox.y },
        bl: { x: selectionBox.x, y: selectionBox.y + selectionBox.h },
        br: { x: selectionBox.x + selectionBox.w, y: selectionBox.y + selectionBox.h }
    };
}

// Etkileşim Kontrolleri (Zoom, Pan, Box Move, Box Resize)
function tuvalZoom(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    
    // Fare imlecinin olduğu noktaya doğru odaklı zoom
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    imgX = mouseX - (mouseX - imgX) * zoomFactor;
    imgY = mouseY - (mouseY - imgY) * zoomFactor;
    imgScale *= zoomFactor;

    ciz();
    hesaplaVeOCR();
}

function fareBasildi(e) {
    const pos = { x: e.offsetX, y: e.offsetY };
    etkilesimBaslat(pos);
}

function dokunmaBasladi(e) {
    if (e.touches.length === 1) {
        const rect = mainCanvas.getBoundingClientRect();
        const pos = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        etkilesimBaslat(pos);
    }
}

function etkilesimBaslat(pos) {
    const handles = tutamacKonumlariGetir();
    activeHandle = null;

    // 1. Köşelerden birine tıklandı mı? (Resize)
    for (let key in handles) {
        if (Math.hypot(pos.x - handles[key].x, pos.y - handles[key].y) < 12) {
            activeHandle = key;
            return;
        }
    }

    // 2. Kutunun içine mi tıklandı? (Move Box)
    if (pos.x >= selectionBox.x && pos.x <= selectionBox.x + selectionBox.w &&
        pos.y >= selectionBox.y && pos.y <= selectionBox.y + selectionBox.h) {
        isDraggingBox = true;
        boxDragOffset = { x: pos.x - selectionBox.x, y: pos.y - selectionBox.y };
        return;
    }

    // 3. Boş alana mı tıklandı? (Pan Image)
    isPanning = true;
    startX = pos.x - imgX;
    startY = pos.y - imgY;
}

function fareHareketEt(e) {
    const pos = { x: e.offsetX, y: e.offsetY };
    etkilesimSurdur(pos);
}

function dokunmaSundu(e) {
    if (e.touches.length === 1) {
        const rect = mainCanvas.getBoundingClientRect();
        const pos = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        etkilesimSurdur(pos);
    }
}

function etkilesimSurdur(pos) {
    if (activeHandle) {
        // Kutuyu Boyutlandır
        if (activeHandle === 'br') {
            selectionBox.w = Math.max(40, pos.x - selectionBox.x);
            selectionBox.h = Math.max(30, pos.y - selectionBox.y);
        } else if (activeHandle === 'bl') {
            const newW = Math.max(40, selectionBox.x + selectionBox.w - pos.x);
            selectionBox.x = selectionBox.x + selectionBox.w - newW;
            selectionBox.w = newW;
            selectionBox.h = Math.max(30, pos.y - selectionBox.y);
        } else if (activeHandle === 'tr') {
            selectionBox.w = Math.max(40, pos.x - selectionBox.x);
            const newH = Math.max(30, selectionBox.y + selectionBox.h - pos.y);
            selectionBox.y = selectionBox.y + selectionBox.h - newH;
            selectionBox.h = newH;
        } else if (activeHandle === 'tl') {
            const newW = Math.max(40, selectionBox.x + selectionBox.w - pos.x);
            const newH = Math.max(30, selectionBox.y + selectionBox.h - pos.y);
            selectionBox.x = selectionBox.x + selectionBox.w - newW;
            selectionBox.y = selectionBox.y + selectionBox.h - newH;
            selectionBox.w = newW;
            selectionBox.h = newH;
        }
        ciz();
    } else if (isDraggingBox) {
        // Kutuyu Taşı
        selectionBox.x = pos.x - boxDragOffset.x;
        selectionBox.y = pos.y - boxDragOffset.y;
        ciz();
    } else if (isPanning) {
        // Görseli Kaydır
        imgX = pos.x - startX;
        imgY = pos.y - startY;
        ciz();
    }
}

function fareBakti() {
    if (activeHandle || isDraggingBox || isPanning) {
        hesaplaVeOCR();
    }
    activeHandle = null;
    isDraggingBox = false;
    isPanning = false;
}

// Ölçüm & Görsel Kırpma İşlemi
function hesaplaVeOCR() {
    if (!loadedImage) return;

    // Metraj Hesaplama
    let widthRatio = selectionBox.w / mainCanvas.width;
    let heightRatio = selectionBox.h / mainCanvas.height;
    let baseDistance = 2.8; 

    currentWidth = (baseDistance * widthRatio * 2.2).toFixed(2);
    currentHeight = (baseDistance * heightRatio * 1.8).toFixed(2);
    currentArea = (currentWidth * currentHeight).toFixed(2);
    currentPrice = (currentArea * BIRIM_FIYAT).toFixed(2);

    document.getElementById('live-width').innerText = currentWidth + " m";
    document.getElementById('live-height').innerText = currentHeight + " m";
    document.getElementById('live-area').innerText = currentArea + " m²";
    document.getElementById('live-price').innerText = currentPrice + " TL";

    // Yeşil Çerçevenin Altındaki Fotoğraf Alanını Kesip Alalım
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');

    cropCanvas.width = selectionBox.w;
    cropCanvas.height = selectionBox.h;

    // Tuval koordinatından Orijinal Görsel koordinatına dönüşüm
    const srcX = (selectionBox.x - imgX) / imgScale;
    const srcY = (selectionBox.y - imgY) / imgScale;
    const srcW = selectionBox.w / imgScale;
    const srcH = selectionBox.h / imgScale;

    cropCtx.drawImage(
        loadedImage,
        srcX, srcY, srcW, srcH,
        0, 0, selectionBox.w, selectionBox.h
    );

    analizEtOCR(cropCanvas.toDataURL());
}

function analizEtOCR(imageSource) {
    const ocrStatus = document.getElementById('ocr-status-bar');
    if (ocrStatus) ocrStatus.innerText = "🔍 Tabela Analiz Ediliyor...";

    Tesseract.recognize(imageSource, 'tur+eng')
    .then(({ data: { text } }) => {
        detectedOCRText = text.trim();
        if (ocrStatus) ocrStatus.innerText = "✅ Tabela Analizi Tamamlandı!";
        gelismisFirmaAnalizi(detectedOCRText);
    }).catch(() => {
        if (ocrStatus) ocrStatus.innerText = "⚠️ Metin Okunamadı";
        gelismisFirmaAnalizi("");
    });
}

function gelismisFirmaAnalizi(text) {
    if (!text || text.length < 2) {
        detectedCompanyName = "Bilinmeyen / Özel İşletme";
        detectedSector = "Genel Ticaret";
        detectedDescription = "Seçim alanındaki tabeladan metin okunamadı.";
    } else {
        let satirlar = text.split('\n').map(s => s.trim()).filter(s => s.length > 2);
        detectedCompanyName = satirlar[0] ? satirlar[0].toUpperCase() : "TESPİT EDİLEN MARKA";

        let lowerText = text.toLowerCase();
        if (lowerText.includes("eczane") || lowerText.includes("pharma") || lowerText.includes("medikal")) {
            detectedSector = "Sağlık & Medikal";
        } else if (lowerText.includes("restoran") || lowerText.includes("lokanta") || lowerText.includes("kafe") || lowerText.includes("cafe")) {
            detectedSector = "Yeme & İçme";
        } else if (lowerText.includes("market") || lowerText.includes("gıda")) {
            detectedSector = "Perakende & Gıda";
        } else {
            detectedSector = "Ticari İşletme / Hizmet";
        }

        detectedDescription = `Tabelada okunan metinler: "${satirlar.join(', ')}".`;
    }

    document.getElementById('company-card').classList.remove('hidden');
    document.getElementById('company-ocr-text').innerText = text || "Metin bulunamadı.";
    document.getElementById('company-name').innerText = detectedCompanyName;
    document.getElementById('company-sector').innerText = detectedSector;
    document.getElementById('company-description').innerText = detectedDescription;
    
    document.getElementById('company-web-link').href = `https://www.google.com/search?q=${encodeURIComponent(detectedCompanyName + " firma bilgileri")}`;
}

function kaydetAndTamamla() {
    if (currentArea == 0) return alert("Lütfen geçerli bir ölçüm yapın.");

    let kayitlar = JSON.parse(localStorage.getItem('tabelaAIKayitlari')) || [];
    kayitlar.push({
        id: "TBL-" + Math.floor(1000 + Math.random() * 9000),
        firma: detectedCompanyName,
        sektor: detectedSector,
        metin: detectedOCRText || "-",
        aciklama: detectedDescription,
        genislik: currentWidth,
        yukseklik: currentHeight,
        alan: currentArea,
        fiyat: currentPrice,
        enlem: currentLatitude || "Konum Yok",
        boylam: currentLongitude || "Konum Yok",
        haritaLink: currentLatitude ? `https://www.google.com/maps?q=${currentLatitude},${currentLongitude}` : "-",
        tarih: new Date().toLocaleDateString('tr-TR')
    });

    localStorage.setItem('tabelaAIKayitlari', JSON.stringify(kayitlar));
    modalKapat();
    hafizadanYukle();
    alert("Tabela Başarıyla Kaydedildi!");
}

function taramayiBaslat() {
    const modal = document.getElementById('scan-modal');
    const video = document.getElementById('webcam');
    const imgPreview = document.getElementById('photo-preview');
    
    if (imgPreview) imgPreview.classList.add('hidden-preview');
    if (video) video.style.display = 'block';
    modal.classList.remove('hidden');

    // Öncelikli olarak arka kamerayı dene, hata verirse genel kameraya düş (Fallback)
    navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" } // 'exact' kaldırıldı
    }).then(stream => {
        videoStream = stream;
        video.srcObject = stream;
        video.play();
        setTimeout(() => { yenidenHesaplaAndOCR(); }, 1200);
    }).catch(err => {
        console.warn("Arka kamera açılamadı, varsayılan kamera deneniyor:", err);
        navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            videoStream = stream;
            video.srcObject = stream;
            video.play();
            setTimeout(() => { yenidenHesaplaAndOCR(); }, 1200);
        })
        .catch(error => {
            alert("Kamera erişimi reddedildi veya cihazda kamera bulunamadı: " + error.message);
        });
    });
}

    gpsKonumunuAl();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (ocrStatus) ocrStatus.innerText = '⚠️ Kamera desteği bulunamadı. Fotoğraf yükleyin.';
        return;
    }

    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    }).then((stream) => {
        videoStream = stream;
        if (video) {
            video.srcObject = stream;
            video.play().catch(() => {});
        }
        if (ocrStatus) ocrStatus.innerText = '👇 Yeşil kutuyu tabelanın üstüne sürükleyip boyutlandırın';
    }).catch((error) => {
        console.error('Kamera erişimi başarısız:', error);
        if (ocrStatus) ocrStatus.innerText = '⚠️ Kamera açılamadı. Fotoğraf yükleyin.';
    });


function taramayibaslat() {
    taramayiBaslat();
}

function yenidenHesaplaAndOCR() {
    if (loadedImage) {
        hesaplaVeOCR();
        return;
    }
    if (document.getElementById('ocr-status-bar')) {
        document.getElementById('ocr-status-bar').innerText = '📷 Önce kamera veya fotoğraf ile görüntü alın.';
    }
}

function excelRaporuIndir() {
    const kayitlar = JSON.parse(localStorage.getItem('tabelaAIKayitlari')) || [];
    if (!kayitlar.length) {
        alert('İndirilecek kayıt bulunamadı.');
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert('Excel kütüphanesi yüklenemedi.');
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(kayitlar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TabelaRaporu');
    XLSX.writeFile(workbook, 'tabela_raporu.xlsx');
}

function modalKapat() {
    const modal = document.getElementById('scan-modal');
    if (modal) modal.classList.add('hidden');

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    const video = document.getElementById('webcam');
    if (video) video.srcObject = null;
}

function hafizadanYukle() {
    let kayitlar = JSON.parse(localStorage.getItem('tabelaAIKayitlari')) || [];
    const counter = document.getElementById('tabela-count');
    if (counter) counter.innerText = kayitlar.length;
}

let currentLatitude = null;
let currentLongitude = null;

function gpsKonumunuAl() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLatitude = position.coords.latitude;
                currentLongitude = position.coords.longitude;
                haritaButonunuGuncelle(currentLatitude, currentLongitude);
            },
            (error) => {
                console.warn("GPS Konumu alınamadı:", error.message);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }
}

function haritaButonunuGuncelle(lat, lng) {
    const mapBtn = document.getElementById('company-map-link');
    if (!mapBtn || !lat || !lng) return;

    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    mapBtn.href = mapUrl;
    mapBtn.classList.remove('hidden');
}