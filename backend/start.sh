#!/bin/bash
echo "🚀 INICIANDO PSY PAY BACKEND..."
mkdir -p uploads
gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT --timeout 120
