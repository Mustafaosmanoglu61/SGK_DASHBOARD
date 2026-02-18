"""
SGK Dashboard – Birleşik Flask Server
======================================
Tek komutla çalıştır (proje kökünden):
    python python_server/server.py

Veya start.sh ile:
    bash python_server/start.sh

Endpoint'ler:
    GET  /                      → sgk_giris/index.html
    GET  /ai/interpreter.html   → AI Yorumlayıcı
    GET  /api/data/giris        → data.json (ham)
    GET  /api/data/cikis        → datacikis.json (ham)
    POST /api/chat              → Giriş verisi AI sohbet
    POST /api/chat/cikis        → Çıkış verisi AI sohbet
    POST /api/chat/combined     → Her ikisi + OpenAI
"""

import json
import os
from datetime import datetime
from math import isfinite

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

# ---------------------------------------------------------------------------
# Yollar (server.py → python_server/ → proje kökü)
# ---------------------------------------------------------------------------
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SERVER_DIR)

GIRIS_DIR        = os.path.join(ROOT_DIR, "sgk_giris")
CIKIS_DIR        = os.path.join(ROOT_DIR, "sgk_cıkıs")
AI_DIR           = os.path.join(ROOT_DIR, "ai")

GIRIS_DATA_PATH  = os.path.join(GIRIS_DIR, "src", "data.json")
CIKIS_DATA_PATH  = os.path.join(CIKIS_DIR, "src", "datacikis.json")
SUMMARY_PATH     = os.path.join(GIRIS_DIR, "src", "monthly_summary.txt")

# ---------------------------------------------------------------------------
# Sabitler
# ---------------------------------------------------------------------------
MANUAL_TIME_SECONDS             = 240
WORKING_HOURS_PER_DAY           = 8
WORKING_DAYS_PER_MONTH          = 22
SECONDS_PER_HOUR                = 3600
TOTAL_WORKING_SECONDS_PER_MONTH = (
    WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH * SECONDS_PER_HOUR
)
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

# ---------------------------------------------------------------------------
# Flask
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# Yardımcı fonksiyonlar
# ---------------------------------------------------------------------------

def safe_float(v):
    try:
        n = float(v)
        return n if isfinite(n) else 0.0
    except Exception:
        return 0.0


def clean_departman(d):
    if not d or not isinstance(d, str):
        return ""
    t = d.strip()
    i = t.find(".")
    return t[i + 1:].strip() if 0 < i < len(t) - 1 else t


def clean_pozisyon(p):
    if not p or not isinstance(p, str):
        return ""
    c = p.strip()
    i = c.find(".")
    if 0 < i < len(c) - 1:
        c = c[i + 1:].strip()
    return c.rstrip(".")


def classify_error(comment):
    s = (comment or "").strip()
    if not s:
        return "Bilinmeyen hata"
    if s.startswith(("SYS", "BUS")):
        idx = s.find(":")
        return s[idx + 1:].strip() if idx != -1 else s
    i = s.find(". ")
    if i != -1 and i < 60:
        return s[:i + 1]
    return (s[:57] + "...") if len(s) > 60 else s


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[UYARI] {path} okunamadı: {e}")
        return []


def enrich(rows):
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        r = dict(r)
        r["departman_clean"] = clean_departman(r.get("departman"))
        r["pozisyon_clean"]  = clean_pozisyon(r.get("pozisyon"))
        out.append(r)
    return out


def top_counts(rows, key, n=5):
    m = {}
    for r in rows:
        k = r.get(key) or "—"
        m[k] = m.get(k, 0) + 1
    return sorted(m.items(), key=lambda x: x[1], reverse=True)[:n]


def compute_stats(rows):
    total     = len(rows)
    completed = sum(1 for r in rows if r.get("status") == "COMPLETED")
    error     = sum(1 for r in rows if r.get("status") == "ERROR")

    durs      = [d for d in (safe_float(r.get("duration_sec")) for r in rows) if d > 0]
    total_sec = sum(durs)
    avg_sec   = total_sec / len(durs) if durs else 0

    dates     = sorted(r.get("date_key") for r in rows if r.get("date_key"))
    date_min  = dates[0]  if dates else None
    date_max  = dates[-1] if dates else None
    daily_avg = total / len(set(dates)) if dates else total

    saved_sec   = total * MANUAL_TIME_SECONDS - total_sec
    fte         = saved_sec / TOTAL_WORKING_SECONDS_PER_MONTH

    err_types = {}
    for r in rows:
        if r.get("status") != "ERROR":
            continue
        lbl = classify_error(r.get("error_comment"))
        err_types[lbl] = err_types.get(lbl, 0) + 1

    return {
        "total":            total,
        "completed":        completed,
        "error":            error,
        "success_rate":     completed / total * 100 if total else 0,
        "total_sec":        total_sec,
        "avg_sec":          avg_sec,
        "date_min":         date_min,
        "date_max":         date_max,
        "daily_avg":        daily_avg,
        "fte_saved":        fte,
        "saved_time_hours": saved_sec / SECONDS_PER_HOUR,
        "top_departman":    top_counts(rows, "departman_clean"),
        "top_pozisyon":     top_counts(rows, "pozisyon_clean"),
        "top_isyeri":       top_counts(rows, "isyeri"),
        "top_errors":       sorted(err_types.items(), key=lambda x: x[1], reverse=True)[:5],
    }


def build_context(stats, label=""):
    def ft(items):
        return ", ".join(f"{k}({v})" for k, v in items) or "-"
    p = f"[{label}] " if label else ""
    return (
        f"{p}Toplam:{stats['total']} Başarılı:{stats['completed']} Hatalı:{stats['error']} "
        f"Oran:{stats['success_rate']:.1f}%\n"
        f"Tarih:{stats['date_min']}→{stats['date_max']} "
        f"OrtSüre:{stats['avg_sec']:.0f}sn GünlükOrt:{stats['daily_avg']:.0f}\n"
        f"Departmanlar:{ft(stats['top_departman'])}\n"
        f"Pozisyonlar:{ft(stats['top_pozisyon'])}\n"
        f"İşyerleri:{ft(stats['top_isyeri'])}\n"
        f"Hatalar:{ft(stats['top_errors'])}"
    )


def quick_answer(q, rows, stats, isyeri_list, dept_list, poz_list):
    ql = q.lower()

    def find(vals):
        m = [v for v in vals if v and v.lower() in ql]
        return max(m, key=len) if m else None

    def sub(key, val):
        s = [r for r in rows if r.get(key) == val]
        t, c, e = len(s), sum(1 for r in s if r.get("status") == "COMPLETED"), sum(1 for r in s if r.get("status") == "ERROR")
        return f"{val}: toplam {t}, başarılı {c}, hatalı {e}.", True

    if any(k in ql for k in ("isyeri", "işyeri", "hastane")):
        v = find(isyeri_list)
        if v:
            return sub("isyeri", v)

    if "departman" in ql:
        v = find(dept_list)
        if v:
            return sub("departman_clean", v)

    if "pozisyon" in ql:
        v = find(poz_list)
        if v:
            return sub("pozisyon_clean", v)

    if "toplam" in ql and ("kayıt" in ql or "kayit" in ql):
        return f"Toplam kayıt: {stats['total']}", True
    if "başarı oran" in ql:
        return f"Başarı oranı: %{stats['success_rate']:.1f}", True
    if "fte" in ql:
        return f"FTE tasarrufu: {stats['fte_saved']:.2f}", True
    if "hata" in ql and any(k in ql for k in ("neden", "sebep", "tip")):
        lines = "\n".join(f"  • {k} ({v})" for k, v in stats["top_errors"])
        return f"Hata nedenleri:\n{lines}", True
    if "en yoğun departman" in ql or ("departman" in ql and "en" in ql):
        t = stats["top_departman"][0] if stats["top_departman"] else ("-", 0)
        return f"En yoğun departman: {t[0]} ({t[1]} kayıt)", True
    if "en yoğun işyeri" in ql or (("işyeri" in ql or "isyeri" in ql) and "en" in ql):
        t = stats["top_isyeri"][0] if stats["top_isyeri"] else ("-", 0)
        return f"En yoğun işyeri: {t[0]} ({t[1]} kayıt)", True

    return None, False


# ---------------------------------------------------------------------------
# Veri yükle
# ---------------------------------------------------------------------------
print("\n[SGK Server] Veriler yükleniyor...")

GIRIS_RAW   = load_json(GIRIS_DATA_PATH)
GIRIS_DATA  = enrich(GIRIS_RAW)
GIRIS_STATS = compute_stats(GIRIS_DATA)
GIRIS_IY    = sorted({r.get("isyeri") for r in GIRIS_DATA if r.get("isyeri")})
GIRIS_DEPT  = sorted({r.get("departman_clean") for r in GIRIS_DATA if r.get("departman_clean")})
GIRIS_POZ   = sorted({r.get("pozisyon_clean")  for r in GIRIS_DATA if r.get("pozisyon_clean")})

CIKIS_RAW   = load_json(CIKIS_DATA_PATH)
CIKIS_DATA  = enrich(CIKIS_RAW)
CIKIS_STATS = compute_stats(CIKIS_DATA)
CIKIS_IY    = sorted({r.get("isyeri") for r in CIKIS_DATA if r.get("isyeri")})
CIKIS_DEPT  = sorted({r.get("departman_clean") for r in CIKIS_DATA if r.get("departman_clean")})
CIKIS_POZ   = sorted({r.get("pozisyon_clean")  for r in CIKIS_DATA if r.get("pozisyon_clean")})

try:
    MONTHLY_SUMMARY = open(SUMMARY_PATH, encoding="utf-8").read().strip()
except Exception:
    MONTHLY_SUMMARY = ""

ENV_CLIENT = OpenAI() if OpenAI and os.getenv("OPENAI_API_KEY") else None

print(f"[SGK Server] Giriş: {len(GIRIS_DATA)} kayıt | Çıkış: {len(CIKIS_DATA)} kayıt")
print(f"[SGK Server] OpenAI env: {'✓' if ENV_CLIENT else '✗ (tarayıcıdan key girilebilir)'}\n")

# ---------------------------------------------------------------------------
# Sayfa route'ları
# ---------------------------------------------------------------------------

@app.get("/")
def serve_index():
    return send_from_directory(GIRIS_DIR, "index.html")

@app.get("/ai/interpreter.html")
def serve_interpreter():
    return send_from_directory(AI_DIR, "interpreter.html")

# Statik dosyalar
@app.get("/sgk_giris/<path:path>")
def serve_giris_static(path):
    return send_from_directory(GIRIS_DIR, path)

@app.get("/sgk_cikis/<path:path>")
def serve_cikis_static(path):
    return send_from_directory(CIKIS_DIR, path)

@app.get("/ai/<path:path>")
def serve_ai_static(path):
    return send_from_directory(AI_DIR, path)

# ---------------------------------------------------------------------------
# API: Ham veri
# ---------------------------------------------------------------------------

@app.get("/api/data/giris")
def api_giris_data():
    return jsonify(GIRIS_RAW)

@app.get("/api/data/cikis")
def api_cikis_data():
    return jsonify(CIKIS_RAW)

# ---------------------------------------------------------------------------
# API: Chat (ortak yardımcı)
# ---------------------------------------------------------------------------

def _chat(rows, stats, iy, dept, poz, label):
    body     = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    api_key  = (body.get("api_key")  or "").strip()

    if not question:
        return jsonify({"answer": "Soru boş olamaz."}), 400

    answer, confident = quick_answer(question, rows, stats, iy, dept, poz)
    used_openai  = False
    openai_error = None

    if not confident:
        # API key: önce request'ten, sonra env
        ai = None
        if OpenAI:
            try:
                ai = OpenAI(api_key=api_key) if api_key else ENV_CLIENT
            except Exception as e:
                openai_error = str(e)

        if ai:
            ctx    = build_context(stats, label)
            system = (
                "Sen SGK RPA dashboard verilerini analiz eden Türkçe bir asistansın. "
                "Verilen istatistiklere dayanarak kısa ve net yanıt ver."
            )
            try:
                resp   = ai.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user",   "content": f"Veri:\n{ctx}\n\nSoru: {question}"},
                    ],
                    max_tokens=800,
                )
                answer      = resp.choices[0].message.content.strip()
                used_openai = True
            except Exception as e:
                openai_error = str(e)
                if not answer:
                    answer = "Veri yetersiz veya OpenAI hatası oluştu."
        else:
            if not answer:
                answer = (
                    "Bu soruyu yanıtlamak için yeterli veri bulunamadı. "
                    "Sidebar'dan OpenAI API key girerek daha detaylı yanıt alabilirsiniz."
                )

    return jsonify({
        "answer":       answer or "Yanıt üretilemedi.",
        "used_openai":  used_openai,
        "openai_error": openai_error,
    })


@app.post("/api/chat")
def api_chat_giris():
    return _chat(GIRIS_DATA, GIRIS_STATS, GIRIS_IY, GIRIS_DEPT, GIRIS_POZ, "İşe Giriş")

@app.post("/api/chat/cikis")
def api_chat_cikis():
    return _chat(CIKIS_DATA, CIKIS_STATS, CIKIS_IY, CIKIS_DEPT, CIKIS_POZ, "İşten Çıkış")

@app.post("/api/chat/combined")
def api_chat_combined():
    all_rows  = GIRIS_DATA + CIKIS_DATA
    all_stats = compute_stats(all_rows)
    all_iy    = list(set(GIRIS_IY + CIKIS_IY))
    all_dept  = list(set(GIRIS_DEPT + CIKIS_DEPT))
    all_poz   = list(set(GIRIS_POZ + CIKIS_POZ))
    return _chat(all_rows, all_stats, all_iy, all_dept, all_poz, "Giriş+Çıkış")

# ---------------------------------------------------------------------------
# Başlat
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 52)
    print("  SGK Dashboard  →  http://localhost:5500")
    print("  AI Yorumlayıcı →  http://localhost:5500/ai/interpreter.html")
    print("=" * 52)
    app.run(host="0.0.0.0", port=5500, debug=True)
