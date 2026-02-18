#!/bin/bash
# SGK Dashboard – Flask Server Başlatıcı
# Kullanım (proje kökünden):  bash python_server/start.sh

set -e
cd "$(dirname "$0")/.."   # proje kökü

echo ""
echo "======================================================"
echo "  SGK Dashboard Flask Server"
echo "======================================================"
echo ""
echo "  [1/2] Bağımlılıklar yükleniyor..."
pip3 install flask flask-cors openai -q

echo "  [2/2] Server başlatılıyor..."
echo ""
echo "  Dashboard    →  http://localhost:5500"
echo "  AI Sohbet    →  http://localhost:5500/ai/interpreter.html"
echo ""
echo "  Durdurmak için Ctrl+C"
echo "======================================================"
echo ""

python3 python_server/server.py
