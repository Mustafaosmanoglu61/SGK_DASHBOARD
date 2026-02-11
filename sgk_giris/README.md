# SGK İşe Giriş Dashboard

Bu proje, SGK işe giriş süreçlerini izlemek için hazırlanmış bir dashboard ve sohbet (chat) arayüzüdür.  
Dashboard ve chat aynı sunucu üzerinden çalışır; veri kaynağı `src/data.json` dosyasıdır.

## Özellikler
- KPI kartları ve görselleştirmeler
- Filtreleme (tarih, işyeri, departman, status)
- Chat arayüzü (özet metrikler + isteğe bağlı OpenAI)
- “Bu Ayın Özeti” butonu (data.json analiziyle oluşturulan statik özet metin)

## Gereksinimler
- Python 3.x
- `pip`

## Kurulum
```bash
cd "/Users/mustafa/Desktop/vs local repo/SGK_DASHBOARD/sgk_giris"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Çalıştırma
```bash
python3 server.py
```

Tarayıcı:
- Dashboard: `http://127.0.0.1:8000/`
- Chat: `http://127.0.0.1:8000/chat`

## OpenAI (Opsiyonel)
OpenAI yanıtlarını etkinleştirmek için:
```bash
export OPENAI_API_KEY="YOUR_KEY"
python3 server.py
```

> Not: API kotası/bütçesi yoksa yalnızca temel metrikler yanıtlanır.

## “Bu Ayın Özeti”
`src/monthly_summary.txt` dosyası, `src/data.json` analiz edilerek **tek sefer** üretilir ve chat üzerinden gösterilir.  
Güncellemek için istersen tekrar analiz çalıştırılabilir.

## Proje Yapısı
```
sgk_giris/
├── index.html
├── chat.html
├── server.py
├── requirements.txt
├── src/
│   ├── app.js
│   ├── chat.js
│   ├── style.css
│   ├── data.json
│   ├── monthly_summary.txt
│   ├── queries.js
│   ├── store.js
│   └── utils.js
└── INIT.md
```

## Notlar
- Chat tarafındaki hata mesajları, API çağrısı başarısız olursa “Sistem” mesajı olarak görünür.
- Veri güncellemesi için `src/data.json` dosyası değiştirilir.
