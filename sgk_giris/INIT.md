# SGK İşe Giriş Dashboard - Proje Başlangıç Dokümantasyonu

## 📋 Proje Özeti

Bu proje, SGK (Sosyal Güvenlik Kurumu) İşe Giriş sürecini takip eden RPA (Robotic Process Automation) sisteminin performans dashboard'udur. Dashboard, işe giriş işlemlerinin detaylı analizi, başarı oranları, hata takibi ve süreç optimizasyonu için geliştirilmiştir.

---

## 🎯 Proje Hedefleri

1. **RPA Performans İzleme**: İşe giriş işlemlerinin başarı/hata oranlarını anlık takip
2. **Zaman Tasarrufu Analizi**: Manuel vs otomatik süreç karşılaştırması
3. **FTE Hesaplama**: Otomasyon ile sağlanan insan kaynağı tasarrufu
4. **Hata Analizi**: Hata tiplerinin ve kaynaklarının detaylı incelenmesi
5. **Veri Görselleştirme**: İnteraktif grafikler ile kolay anlaşılır raporlama

---

## 🏗️ Proje Yapısı

```
SGK_ISE_GIRIS/
├── index.html              # Ana HTML dosyası
├── src/
│   ├── app.js              # Ana JavaScript logic
│   ├── style.css           # Stil dosyası
│   └── data.json           # Veri dosyası (21.047 kayıt)
├── js/                     # Ek JavaScript modülleri
│   ├── queries.js          # Veri sorgulama fonksiyonları
│   ├── store.js            # Veri yönetimi
│   └── utils.js            # Yardımcı fonksiyonlar
├── README.md               # Kullanım kılavuzu
├── DEGISIKLIKLER.md        # Değişiklik geçmişi
└── INIT.md                 # Bu dosya
```

---

## 🔧 Teknoloji Stack

### Frontend
- **HTML5**: Semantik yapı
- **CSS3**: Modern styling, responsive design
- **Vanilla JavaScript**: Framework kullanmadan native JS

### Kütüphaneler
- **Chart.js** (v4.x): Bar ve Pie chartlar
- **JSCharting**: Treemap ve racing bar chartlar
- **Flatpickr**: Tarih seçici widget

### Veri
- **JSON**: data.json dosyasından fetch
- **Format**: Array of objects, 21.047 kayıt

---

## 📊 Dashboard Bileşenleri

### 1. Filtreler
- **Tarih Aralığı**: Flatpickr ile gelişmiş tarih seçimi
- **İşyeri**: Dropdown filtre
- **Departman**: Dropdown filtre
- **Status**: COMPLETED/ERROR
- **Arama**: Genel metin arama (ad, soyad, pozisyon, vb.)

### 2. KPI Kartları (11 Adet)

| # | KPI Adı | Açıklama | Formül |
|---|---------|----------|--------|
| 1 | Toplam Kayıt | Tüm işlemler | `count(*)` |
| 2 | Başarılı İşe Giriş | COMPLETED kayıtlar | `count(status='COMPLETED')` |
| 3 | Hatalı İşe Giriş | ERROR kayıtlar | `count(status='ERROR')` |
| 4 | Başarı Oranı | Yüzde hesabı | `(completed/total)*100` |
| 5 | Toplam Süre | RPA süresi (saat) | `sum(duration_sec)/3600` |
| 6 | Avg İşlem Süresi | Ortalama (saniye) | `avg(duration_sec)` |
| 7 | Toplam Başarısız Süresi | ERROR süreleri | `sum(error_durations)/3600` |
| 8 | Toplam Başarılı Süresi | COMPLETED süreleri | `sum(success_durations)/3600` |
| 9 | Günlük Ort. İşe Giriş | Tarih filtresine göre | `total/unique_dates` |
| 10 | **FTE Tasarrufu** ⭐ | Full-Time Equivalent | `(manuel-rpa)/633600` |
| 11 | **Manuel Kazanılan Zaman** ⭐ | Zaman tasarrufu (saat) | `(total*240-rpa_total)/3600` |

### 3. Grafikler

#### A) Günlük Trend (Line Chart)
- **Tip**: Custom SVG line chart
- **Veri**: Günlük toplam ve hata sayıları
- **Özellikler**:
  - İnteraktif tooltip
  - 4 zaman aralığı: Son 7/15/30/Tümü
  - Yatay grid çizgileri
  - Yükseklik: 270px
  - Gradient fill (mavi/kırmızı)

#### B) İşlem Yoğunluğu (Bar Chart)
- **Tip**: Chart.js Bar Chart
- **Veri**: Saatlik işlem dağılımı (00:00-23:00)
- **Özellikler**:
  - 24 saat görünümü
  - Yatay grid çizgileri
  - Hover tooltip

#### C) Pozisyon Dağılımı (Treemap)
- **Tip**: JSCharting Treemap
- **Veri**: Top 30 pozisyon
- **Renk Paleti**: Turuncu → Mor (#F8C1A8 → #33104A)
- **Kısaltma**: Pozisyon kodları (baş harfler)
- **KPI**: En Yoğun Pozisyon

#### D) Departman Dağılımı (Treemap)
- **Tip**: JSCharting Treemap
- **Veri**: Top 30 departman
- **Renk Paleti**: Açık Yeşil → Koyu Yeşil (#C8E6C9 → #2E7D32)
- **Kısaltma**: Departman kodları (baş harfler)
- **KPI**: En Yoğun Departman

#### E) Hastane Giriş Değişimi (Racing Bar)
- **Tip**: JSCharting Animated Horizontal Bar
- **Veri**: Tarihlere göre hastane bazlı kümülatif giriş
- **Özellikler**:
  - Otomatik animasyon
  - Play/Pause kontrol
  - Slider ile tarih seçimi
  - Top 10 hastane

#### F) Hata Analizi (3 Bölüm)
1. **Yoğun Hata Nedenleri**: Horizontal bar chart
2. **Top 10 Hatalı İşyeri**: Pie chart
3. **Top 10 Başarılı İşyeri**: Pie chart

---

## 🔢 FTE ve Manuel Tasarruf Hesaplamaları

### Sabitler (app.js)

```javascript
const MANUAL_TIME_SECONDS = 240;              // 4 dakika manuel işlem varsayımı
const WORKING_HOURS_PER_DAY = 8;              // Günlük çalışma saati
const WORKING_DAYS_PER_MONTH = 22;            // Aylık çalışma günü
const SECONDS_PER_HOUR = 3600;
const TOTAL_WORKING_SECONDS_PER_MONTH = 633600; // 8*22*3600
```

### FTE Tasarrufu Formülü

```javascript
Manuel Toplam Süre = İşlem Sayısı × 240 saniye
RPA Toplam Süre = Σ(duration_sec)
Kazanılan Zaman = Manuel Toplam - RPA Toplam
FTE Tasarrufu = Kazanılan Zaman ÷ 633,600 saniye
```

**Örnek Hesaplama:**
```
İşlem Sayısı: 21,047
Manuel Toplam: 21,047 × 240 = 5,051,280 sn (1,403 saat)
RPA Toplam: 663,110 sn (184 saat)
Kazanılan Zaman: 4,388,170 sn (1,219 saat)
FTE Tasarrufu: 4,388,170 ÷ 633,600 = 6.93 FTE
```

### Manuel Kazanılan Zaman

```javascript
Kazanılan Zaman (saat) = (İşlem Sayısı × 240 sn - Σ duration_sec) ÷ 3600
```

---

## 🎨 Tasarım Kılavuzu

### Renk Paleti

```css
/* Light Mode */
--bg2: #f5f7fb;         /* Arka plan */
--card2: #ffffff;       /* Kart arka planı */
--text2: #0b1220;       /* Ana metin */
--muted2: #5b6b86;      /* İkincil metin */
--line2: #e7ecf5;       /* Çizgiler */
--accent: #4da3ff;      /* Vurgu rengi */
--ok: #24d18f;          /* Başarı (yeşil) */
--bad: #ff5a7a;         /* Hata (kırmızı) */
--warn: #ffcc66;        /* Uyarı (sarı) */
```

### Tipografi

```css
font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;

/* Başlıklar */
h1: 38px, font-weight: 750
.card-title: 16px, font-weight: 750

/* KPI Değerleri */
.value: 28px, font-weight: 750, letter-spacing: -0.4px

/* Genel Metin */
body: 14px
```

### Grid Layout

```css
/* KPI Kartları */
grid-template-columns: repeat(4, minmax(0, 1fr));
gap: 14px;

/* Responsive: <980px */
grid-template-columns: repeat(2, minmax(0, 1fr));
```

---

## 📦 Veri Yapısı

### data.json Format

```json
{
  "tc_masked": "XXX***XX",
  "ad": "Ad",
  "soyad": "Soyad",
  "ise_giris_tarihi": "DD/MM/YYYY HH:MM:SS",
  "departman": "Departman Adı",
  "departman_clean": "Temiz Departman",
  "isyeri": "İşyeri",
  "pozisyon": "Pozisyon",
  "pozisyon_clean": "Temiz Pozisyon",
  "unvan": "Ünvan",
  "status": "COMPLETED|ERROR",
  "start_date": "YYYY-MM-DDTHH:MM:SS",
  "end_date": "YYYY-MM-DDTHH:MM:SS",
  "date_key": "YYYY-MM-DD",
  "duration_sec": 27,
  "error_comment": "Hata mesajı",
  "uyruk": "Türk|Yabancı",
  "meslek_kodu": "9112.01",
  "bordro": "Bordrolu|Bordrosuz",
  "egitim": "Lise|Üniversite|...",
  "calisan_kategori": "Normal|Kısmi|...",
  "gorev_kategori": "Tam Zamanli|Yarı Zamanli"
}
```

### Veri Temizleme (utils.js)

```javascript
// Departman temizleme
"ULU.Teknik Hizmetler Müdürlüğü" → "Teknik Hizmetler Müdürlüğü"

// Pozisyon temizleme
"ULU.Elektrik Teknisyeni." → "Elektrik Teknisyeni"
```

---

## 🚀 Kurulum ve Kullanım

### Gereksinimler
- Modern web tarayıcı (Chrome, Firefox, Safari, Edge)
- Yerel web sunucusu (isteğe bağlı)
- `data.json` dosyası `src/` klasöründe

### Kurulum

1. **Dosyaları İndirin**
   ```bash
   # Proje klasörünü bilgisayarınıza indirin
   ```

2. **Tarayıcıda Açın**
   ```
   index.html dosyasını çift tıklayarak açın
   VEYA
   Yerel sunucu ile çalıştırın:
   python -m http.server 8000
   ```

3. **Dashboard Kullanımı**
   - Filtreler otomatik yüklenir
   - Grafiklere tıklanabilir
   - CSV export butonu ile veri indirilebilir

### Veri Güncelleme

```bash
# Yeni data.json dosyasını src/ klasörüne kopyalayın
cp yeni_data.json src/data.json

# Tarayıcıyı yenileyin (Ctrl+F5)
```

---

## 🔄 Yapılan Güncellemeler

### v2.0 (Şubat 2026)

#### ❌ Kaldırılan Özellikler
1. **Error Rate KPI** - Gereksiz tekrar
2. **Kayıtlar Tablosu** - Performans optimizasyonu
3. **Bubble Grid Chart** - Treemap'e dönüştürüldü

#### ✅ Eklenen Özellikler
1. **FTE Tasarrufu KPI**
   - Manuel işlem varsayımı: 240 saniye
   - Aylık çalışma saati: 176 saat
   - Dinamik hesaplama

2. **Manuel Kazanılan Zaman KPI**
   - Saat ve saniye gösterimi
   - Filtrelere duyarlı

3. **Pozisyon Treemap**
   - Top 30 pozisyon
   - Turuncu-mor renk paleti
   - Pozisyon kısaltmaları

4. **Departman Treemap**
   - Top 30 departman
   - Yeşil renk paleti
   - Departman kısaltmaları

5. **Günlük Trend İyileştirmeleri**
   - Yatay grid çizgileri
   - Yükseklik artışı (270px)
   - İyileştirilmiş tooltip

6. **Tam Genişlik Layout**
   - Container max-width kaldırıldı
   - Geniş ekranlarda tam genişlik

---

## 🎯 KPI Performans Metrikleri

### Başarı Kriterleri

| Metrik | Hedef | Mevcut | Durum |
|--------|-------|--------|-------|
| Başarı Oranı | >90% | 92.5% | ✅ |
| Ortalama Süre | <35 sn | 32.58 sn | ✅ |
| FTE Tasarrufu | >5 FTE | 6.93 FTE | ✅ |
| Manuel Tasarruf | >1000 saat | 1,218.94 saat | ✅ |

---

## 🐛 Bilinen Sorunlar ve Çözümler

### Sorun 1: Tarih Filtresi Uygulanmıyor
**Çözüm**: Flatpickr onChange event'i applyFilters() çağırıyor

### Sorun 2: Chart.js Hover Tooltip Eksik
**Çözüm**: defaultPoint_tooltip ayarları kontrol edin

### Sorun 3: JSCharting Yüklenmiyor
**Çözüm**: CDN bağlantısını kontrol edin
```html
<script src="https://code.jscharting.com/latest/jscharting.js"></script>
```

---

## 🔐 Güvenlik Notları

### Veri Maskeleme
- TC Kimlik No: `XXX***XX` formatında maskeli
- Kişisel veriler KVKK uyumlu

### CORS Politikası
- Yerel dosya sisteminde çalışır
- Production için web sunucusu gerekli

---

## 📈 Gelecek Planlar

### Kısa Vadeli (1-3 Ay)
- [ ] SGK Çıkış Dashboard entegrasyonu
- [ ] Özet Dashboard (Giriş + Çıkış birleşik)
- [ ] Export to PDF özelliği
- [ ] Email rapor gönderimi

### Orta Vadeli (3-6 Ay)
- [ ] Gerçek zamanlı veri akışı
- [ ] Kullanıcı yetkilendirmesi
- [ ] Özelleştirilebilir KPI'lar
- [ ] Dark mode desteği

### Uzun Vadeli (6-12 Ay)
- [ ] Makine öğrenmesi tahminleri
- [ ] Anomali tespiti
- [ ] Mobil uygulama
- [ ] API entegrasyonu

---

## 👥 Ekip ve Katkıda Bulunanlar

### Geliştirme Ekibi
- **Dashboard Geliştirme**: RPA Dashboard Team
- **Veri Analizi**: Data Science Team
- **UI/UX Tasarım**: Design Team
- **Test**: QA Team

---

## 📚 Referanslar ve Kaynaklar

### Kütüphane Dokümantasyonları
- [Chart.js](https://www.chartjs.org/docs/)
- [JSCharting](https://jscharting.com/documentation/)
- [Flatpickr](https://flatpickr.js.org/)

### İlgili Projeler
- SGK İşten Çıkış Dashboard (geliştirilme aşamasında)
- SGK Özet Dashboard (planlama aşamasında)

---

## 📝 Değişiklik Geçmişi

Detaylı değişiklik geçmişi için `DEGISIKLIKLER.md` dosyasına bakınız.

---

## 📞 Destek ve İletişim

Sorun bildirimi veya öneriler için:
- **Email**: rpa-team@company.com
- **Slack**: #rpa-dashboard
- **Jira**: RPA-DASHBOARD projesi

---

## ⚖️ Lisans

Bu proje şirket içi kullanım için geliştirilmiştir.
Tüm hakları saklıdır © 2026

---

**Son Güncelleme**: 11 Şubat 2026  
**Versiyon**: 2.0  
**Durum**: Production Ready ✅
