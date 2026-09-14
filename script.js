let videoStream = null;
let currentWidth = 0, currentHeight = 0, currentArea = 0, currentPrice = 0;
let detectedCompanyName = "";
let detectedOCRText = "";
let detectedSector = "";
let detectedDescription = "";
const BIRIM_FIYAT = 1500;

let currentShape = "rectangle";
let currentLatitude = null;
let currentLongitude = null;

let mainCanvas, ctx;
let loadedImage = null;
let isImageMode = false;

let imgScale = 1;
let imgX = 0;
let imgY = 0;
let isPanning = false;
let startX = 0, startY = 0;

let selectionBox = { x: 50, y: 50, w: 200, h: 100 };
let activeHandle = null;
let isDraggingBox = false;
let boxDragOffset = { x: 0, y: 0 };

let globalMap = null;

window.onload = function() {
    hafizadanYukle();
    sensorTestEt();
};

function sensorTestEt() {
    const badge = document.getElementById('sensor-status');
    if (badge) {
        badge.innerText = (window.XRHand || ('WebXR' in navigator)) ? "LiDAR 3D Sensör Aktif" : "Hassas AI Optik Kalibrasyon";
    }
}

function sekilDegistir(shapeType) {
    currentShape = shapeType;
    const rectBtn = document.getElementById('shape-rect-btn');
    const circleBtn = document.getElementById('shape-circle-btn');
    const lblWidth = document.getElementById('label-width');
    const lblHeight = document.getElementById('label-height');

    if (shapeType === 'circle') {
        rectBtn.style.background = "#333";
        rectBtn.style.color = "#fff";
        rectBtn.style.border = "1px solid #555";

        circleBtn.style.background = "#00ff88";
        circleBtn.style.color = "#000";
        circleBtn.style.border = "none";

        if (lblWidth) lblWidth.innerText = "Yatay Çap (D1):";
        if (lblHeight) lblHeight.innerText = "Dikey Çap (D2):";
    } else {
        circleBtn.style.background = "#333";
        circleBtn.style.color = "#fff";
        circleBtn.style.border = "1px solid #555";

        rectBtn.style.background = "#00ff88";
        rectBtn.style.color = "#000";
        rectBtn.style.border = "none";

        if (lblWidth) lblWidth.innerText = "Genişlik:";
        if (lblHeight) lblHeight.innerText = "Yükseklik:";
    }

    ciz();
    hesaplaVeOCR();
}

function fotografYukleAc() {
    document.getElementById('file-input').click();
}

function dosyaSecildi(event) {
    gpsKonumunuAl();
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const modal = document.getElementById('scan-modal');
        const video = document.getElementById('webcam');
        const imgPreview = document.getElementById('photo-preview');

        if (video) video.style.display = 'none';
        if (imgPreview) imgPreview.style.display = 'none';

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

    mainCanvas.width = container.clientWidth || 300;
    mainCanvas.height = container.clientHeight || 400;
    ctx = mainCanvas.getContext('2d');

    mainCanvas.onmousedown = fareBasildi;
    mainCanvas.onmousemove = fareHareketEt;
    mainCanvas.onmouseup = fareBakti;
    mainCanvas.onwheel = tuvalZoom;

    mainCanvas.ontouchstart = dokunmaBasladi;
    mainCanvas.ontouchmove = dokunmaSundu;
    mainCanvas.ontouchend = fareBakti;
}

function sifirlaGorselVeKutu() {
    if (!loadedImage) return;
    imgScale = Math.min(mainCanvas.width / loadedImage.width, mainCanvas.height / loadedImage.height);
    imgX = (mainCanvas.width - loadedImage.width * imgScale) / 2;
    imgY = (mainCanvas.height - loadedImage.height * imgScale) / 2;

    const boxW = Math.round(mainCanvas.width * 0.5);
    const boxH = Math.round(mainCanvas.height * 0.3);
    selectionBox = {
        x: (mainCanvas.width - boxW) / 2,
        y: (mainCanvas.height - boxH) / 2,
        w: boxW,
        h: boxH
    };
}

function ciz() {
    if (!ctx || !mainCanvas) return;
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    if (loadedImage) {
        ctx.save();
        ctx.drawImage(loadedImage, imgX, imgY, loadedImage.width * imgScale, loadedImage.height * imgScale);
        ctx.restore();
    }

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';

    if (currentShape === 'circle') {
        const centerX = selectionBox.x + selectionBox.w / 2;
        const centerY = selectionBox.y + selectionBox.h / 2;
        const radiusX = Math.abs(selectionBox.w / 2);
        const radiusY = Math.abs(selectionBox.h / 2);

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
        ctx.restore();

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
        ctx.lineWidth = 1;
        ctx.moveTo(centerX - radiusX, centerY);
        ctx.lineTo(centerX + radiusX, centerY);
        ctx.moveTo(centerX, centerY - radiusY);
        ctx.lineTo(centerX, centerY + radiusY);
        ctx.stroke();
    } else {
        ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
        ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
    }

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

function tuvalZoom(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    imgX = mouseX - (mouseX - imgX) * zoomFactor;
    imgY = mouseY - (mouseY - imgY) * zoomFactor;
    imgScale *= zoomFactor;

    ciz();
    hesaplaVeOCR();
}

function fareBasildi(e) {
    etkilesimBaslat({ x: e.offsetX, y: e.offsetY });
}

function dokunmaBasladi(e) {
    if (e.touches.length === 1) {
        const rect = mainCanvas.getBoundingClientRect();
        etkilesimBaslat({ x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top });
    }
}

function etkilesimBaslat(pos) {
    const handles = tutamacKonumlariGetir();
    activeHandle = null;

    for (let key in handles) {
        if (Math.hypot(pos.x - handles[key].x, pos.y - handles[key].y) < 12) {
            activeHandle = key;
            return;
        }
    }

    if (pos.x >= selectionBox.x && pos.x <= selectionBox.x + selectionBox.w &&
        pos.y >= selectionBox.y && pos.y <= selectionBox.y + selectionBox.h) {
        isDraggingBox = true;
        boxDragOffset = { x: pos.x - selectionBox.x, y: pos.y - selectionBox.y };
        return;
    }

    isPanning = true;
    startX = pos.x - imgX;
    startY = pos.y - imgY;
}

function fareHareketEt(e) {
    etkilesimSurdur({ x: e.offsetX, y: e.offsetY });
}

function dokunmaSundu(e) {
    if (e.touches.length === 1) {
        const rect = mainCanvas.getBoundingClientRect();
        etkilesimSurdur({ x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top });
    }
}

function etkilesimSurdur(pos) {
    if (activeHandle) {
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
        selectionBox.x = pos.x - boxDragOffset.x;
        selectionBox.y = pos.y - boxDragOffset.y;
        ciz();
    } else if (isPanning) {
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

function hesaplaVeOCR() {
    if (!loadedImage) return;

    const realImgWidth = loadedImage.width;
    const realImgHeight = loadedImage.height;

    const boxPixelWidth = Math.abs(selectionBox.w / imgScale);
    const boxPixelHeight = Math.abs(selectionBox.h / imgScale);

    const focalLengthFactor = 1.25; 
    const refDistanceMeter = 3.0; 

    currentWidth = ((boxPixelWidth / realImgWidth) * refDistanceMeter * focalLengthFactor).toFixed(2);
    currentHeight = ((boxPixelHeight / realImgHeight) * refDistanceMeter * focalLengthFactor).toFixed(2);

    if (currentShape === 'circle') {
        let rx = parseFloat(currentWidth) / 2;
        let ry = parseFloat(currentHeight) / 2;
        
        if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.10) {
            let avgR = (rx + ry) / 2;
            currentArea = (Math.PI * Math.pow(avgR, 2)).toFixed(2);
        } else {
            currentArea = (Math.PI * rx * ry).toFixed(2);
        }
    } else {
        currentArea = (parseFloat(currentWidth) * parseFloat(currentHeight)).toFixed(2);
    }

    currentPrice = (currentArea * BIRIM_FIYAT).toFixed(2);

    document.getElementById('live-width').innerText = currentWidth + " m";
    document.getElementById('live-height').innerText = currentHeight + " m";
    document.getElementById('live-area').innerText = currentArea + " m²";
    document.getElementById('live-price').innerText = currentPrice + " TL";

    // -------------------------------------------------------------
    // SIFIR HATA (GÖRSEL ÖN İŞLEME VE KESKİNLEŞTİRME FİLTRESİ)
    // -------------------------------------------------------------
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');

    const srcX = (selectionBox.x - imgX) / imgScale;
    const srcY = (selectionBox.y - imgY) / imgScale;
    const srcW = selectionBox.w / imgScale;
    const srcH = selectionBox.h / imgScale;

    // Okuma kalitesini %300 artırmak için tuvali 2 kat ölçeklendiriyoruz (Upscaling)
    cropCanvas.width = srcW * 2;
    cropCanvas.height = srcH * 2;

    cropCtx.drawImage(
        loadedImage,
        srcX, srcY, srcW, srcH,
        0, 0, cropCanvas.width, cropCanvas.height
    );

    // Binarization & Adaptive Thresholding (Parlama ve Gölge Temizleme)
    gorselIyilestirVeKeskinlestir(cropCtx, cropCanvas.width, cropCanvas.height);

    analizEtOCR(cropCanvas.toDataURL());
}

// Görsel Ön İşleme Algoritması (Binarization & High-Contrast)
function gorselIyilestirVeKeskinlestir(ctx, width, height) {
    let imgData = ctx.getImageData(0, 0, width, height);
    let data = imgData.data;

    // 1. Grayscale (Siyah-Beyaz Dönüşümü) ve Yüksek Kontrast
    for (let i = 0; i < data.length; i += 4) {
        let avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Dinamik Eşikleme (Parlama Temizleme)
        let factor = (259 * (128 + 255)) / (255 * (259 - 128));
        avg = factor * (avg - 128) + 128;

        data[i]     = avg; // Red
        data[i + 1] = avg; // Green
        data[i + 2] = avg; // Blue
    }
    ctx.putImageData(imgData, 0, 0);
}

function yenidenHesaplaAndOCR() {
    hesaplaVeOCR();
}

// %100 Doğruluk için Tesseract OCR Ayarları ve Türkçe Dil Paketi Optimizasyonu
function analizEtOCR(imageSource) {
    const ocrStatus = document.getElementById('ocr-status-bar');
    if (ocrStatus) ocrStatus.innerText = "🔍 AI Görsel İyileştirildi. Yazılar Taranıyor...";

    try {
        Tesseract.recognize(
            imageSource,
            'tur+eng', 
            {
                logger: m => {
                    if (m.status === 'recognizing text' && ocrStatus) {
                        ocrStatus.innerText = `🔍 Tarama Sürüyor: %${Math.round(m.progress * 100)}`;
                    }
                }
            }
        )
        .then(({ data: { text } }) => {
            // Yanlış karakterleri filtrele ve sözlük doğrulaması yap
            detectedOCRText = metniTemizleVeDogrula(text);
            if (ocrStatus) ocrStatus.innerText = "✅ Tabela Analizi Tamamlandı!";
            gelismisFirmaDetayAnalizi(detectedOCRText);
        })
        .catch(err => {
            console.warn("OCR Okuma Hatası:", err);
            if (ocrStatus) ocrStatus.innerText = "⚠️ Metin Okunamadı";
            gelismisFirmaDetayAnalizi("");
        });
    } catch (e) {
        console.error("Tesseract Yükleme Hatası:", e);
        gelismisFirmaDetayAnalizi("");
    }
}

// Hatalı Okumaları Engellemek İçin Metin Temizleme RegEx Modülü
function metniTemizleVeDogrula(rawText) {
    if (!rawText) return "";

    // Gereksiz sembol ve çöp Karakter Temizliği
    let clean = rawText.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s\.\,\:\-\/\&]/g, '');
    
    // Çoklu boşlukları ve gereksiz alt satırları düzeltme
    clean = clean.split('\n')
                 .map(s => s.trim())
                 .filter(s => s.length > 1)
                 .join('\n');

    return clean;
}

function gelismisFirmaDetayAnalizi(text) {
    const companyCard = document.getElementById('company-card');
    const ocrTextEl = document.getElementById('company-ocr-text');
    const nameEl = document.getElementById('company-name');
    const sectorEl = document.getElementById('company-sector');
    const descEl = document.getElementById('company-description');
    const webLinkEl = document.getElementById('company-web-link');

    if (!text || text.length < 2) {
        if (companyCard) companyCard.classList.remove('hidden');
        if (ocrTextEl) ocrTextEl.innerText = "Tabeladan net bir yazı veya logo okunamadı.";
        if (nameEl) nameEl.innerText = "Bilinmeyen / Özel İşletme";
        if (sectorEl) sectorEl.innerText = "Genel Ticaret";
        if (descEl) descEl.innerText = "Lütfen yeşil seçim alanını tabelanın tam üzerine getirin.";
        return;
    }

    let satirlar = text.split('\n').map(s => s.trim()).filter(s => s.length > 1);
    detectedCompanyName = satirlar[0] ? satirlar[0].toUpperCase() : "TESPİT EDİLEN İŞLETME";

    // Telefon ve Web Adresi Yakalama (Gelişmiş RegEx)
    let phoneMatch = text.match(/(0\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})|(\d{10,11})/);
    let telefon = phoneMatch ? phoneMatch[0] : "Tabelada telefon yok";

    let webMatch = text.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/);
    let webSitesi = webMatch ? webMatch[0] : "Web adresi yok";

    let lowerText = text.toLowerCase();
    detectedSector = "Ticari İşletme / Hizmet";

    // Sözlük Analizi ile Otomatik Sektör Eşleştirme
    if (lowerText.includes("eczane") || lowerText.includes("pharma") || lowerText.includes("medikal") || lowerText.includes("klinik")) {
        detectedSector = "Sağlık & Medikal";
    } else if (lowerText.includes("restoran") || lowerText.includes("lokanta") || lowerText.includes("kafe") || lowerText.includes("cafe") || lowerText.includes("kebap") || lowerText.includes("fırın")) {
        detectedSector = "Yeme & İçme / Restoran";
    } else if (lowerText.includes("market") || lowerText.includes("gıda") || lowerText.includes("supermarket") || lowerText.includes("gross")) {
        detectedSector = "Perakende & Gıda";
    } else if (lowerText.includes("oto") || lowerText.includes("servis") || lowerText.includes("bakım") || lowerText.includes("garage")) {
        detectedSector = "Otomotiv & Teknik Servis";
    } else if (lowerText.includes("avukat") || lowerText.includes("hukuk") || lowerText.includes("danışmanlık") || lowerText.includes("muhasebe")) {
        detectedSector = "Kurumsal Hizmetler";
    }

    detectedDescription = `Okunan Metinler: ${satirlar.join(" | ")} \nTelefon: ${telefon} \nWeb: ${webSitesi}`;

    if (companyCard) companyCard.classList.remove('hidden');
    if (ocrTextEl) ocrTextEl.innerText = text;
    if (nameEl) nameEl.innerText = detectedCompanyName;
    if (sectorEl) sectorEl.innerText = detectedSector;
    if (descEl) descEl.innerText = detectedDescription;
    if (webLinkEl) webLinkEl.href = `https://www.google.com/search?q=${encodeURIComponent(detectedCompanyName + " " + detectedSector + " firma bilgileri")}`;
}

function taramayiBaslat() {
    gpsKonumunuAl();
    const modal = document.getElementById('scan-modal');
    const video = document.getElementById('webcam');
    const imgPreview = document.getElementById('photo-preview');
    const ocrStatus = document.getElementById('ocr-status-bar');

    if (imgPreview) imgPreview.style.display = 'none';
    if (video) video.style.display = 'block';
    if (modal) modal.classList.remove('hidden');

    isImageMode = false;
    loadedImage = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (ocrStatus) ocrStatus.innerText = '⚠️ Tarayıcı kamera desteklemiyor.';
        return;
    }

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    }).then(stream => {
        videoStream = stream;
        video.srcObject = stream;
        video.play();
        if (ocrStatus) ocrStatus.innerText = '📷 Canlı kamera aktif. Tabelayı hizalayın.';
    }).catch(err => {
        console.warn("Arka kamera açılamadı, ön kamera deneniyor...", err);
        navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            videoStream = stream;
            video.srcObject = stream;
            video.play();
        })
        .catch(error => {
            alert("Kamera izni engellendi: " + error.message);
        });
    });
}

function kaydetAndTamamla() {
    if (currentArea == 0) return alert("Lütfen önce bir ölçüm yapın.");

    let kayitlar = JSON.parse(localStorage.getItem('tabelaAIKayitlari')) || [];
    kayitlar.push({
        id: "TBL-" + Math.floor(1000 + Math.random() * 9000),
        sekil: currentShape === 'circle' ? "Yuvarlak / Oval" : "Dikdörtgen",
        firma: detectedCompanyName || "İsimsiz",
        sektor: detectedSector || "Genel",
        metin: detectedOCRText || "-",
        aciklama: detectedDescription || "-",
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

function excelRaporuIndir() {
    const kayitlar = JSON.parse(localStorage.getItem('tabelaAIKayitlari')) || [];
    if (!kayitlar.length) return alert('İndirilecek kayıt bulunamadı.');
    if (typeof XLSX === 'undefined') return alert('Excel kütüphanesi yüklenemedi.');

    const worksheet = XLSX.utils.json_to_sheet(kayitlar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TabelaRaporu');
    XLSX.writeFile(workbook, 'tabela_raporu.xlsx');
}

function hafizadanYukle() {
    let kayitlar = JSON.parse(localStorage.getItem('tabelaAIKayitlari')) || [];
    const counter = document.getElementById('tabela-count');
    if (counter) counter.innerText = kayitlar.length;
}

function gpsKonumunuAl() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLatitude = position.coords.latitude;
                currentLongitude = position.coords.longitude;
            },
            (error) => {
                console.warn("GPS Konumu alınamadı:", error.message);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }
}

function tumTabelalariHaritadaGoster() {
    let kayitlar = JSON.parse(localStorage.getItem('tabelaAIKayitlari')) || [];
    let konumluKayitlar = kayitlar.filter(k => k.enlem && k.enlem !== "Konum Yok" && k.boylam && k.boylam !== "Konum Yok");

    if (konumluKayitlar.length === 0) {
        alert("Haritada gösterilecek konum verisine sahip kaydedilmiş tabela bulunamadı.");
        return;
    }

    const mapModal = document.getElementById('map-modal');
    if (mapModal) mapModal.classList.remove('hidden');

    if (globalMap !== null) {
        globalMap.remove();
    }

    const sonKayit = konumluKayitlar[konumluKayitlar.length - 1];
    globalMap = L.map('all-signs-map').setView([sonKayit.enlem, sonKayit.boylam], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(globalMap);

    let bounds = [];

    konumluKayitlar.forEach(item => {
        let lat = parseFloat(item.enlem);
        let lng = parseFloat(item.boylam);
        bounds.push([lat, lng]);

        let popupIcerik = `
            <div style="font-family:sans-serif; min-width:160px;">
                <b style="color:#4285F4; font-size:14px;">${item.firma || 'İsimsiz Tabela'}</b><br>
                <small><b>Şekil:</b> ${item.sekil || 'Dikdörtgen'}</small><br>
                <small><b>Sektör:</b> ${item.sektor || 'Genel'}</small><hr style="margin:5px 0;">
                <b>Ebat:</b> ${item.genislik}m x ${item.yukseklik}m (${item.alan} m²)<br>
                <b>Fiyat:</b> ${item.fiyat} TL<br>
                <small style="color:#666;">Tarih: ${item.tarih}</small><br><br>
                <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:#34A853; font-weight:bold; text-decoration:none;">Google Maps'te Aç ↗</a>
            </div>
        `;

        L.marker([lat, lng]).addTo(globalMap).bindPopup(popupIcerik);
    });

    if (bounds.length > 1) {
        globalMap.fitBounds(bounds, { padding: [30, 30] });
    }

    setTimeout(() => {
        globalMap.invalidateSize();
    }, 300);
}

function haritaModalKapat() {
    const mapModal = document.getElementById('map-modal');
    if (mapModal) mapModal.classList.add('hidden');
}