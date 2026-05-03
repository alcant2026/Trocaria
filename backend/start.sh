#!/bin/bash
echo "INICIANDO PSY PAY BACKEND (512MB Free)..."
mkdir -p uploads
gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app \
  --bind 0.0.0.0:$PORT \
  --timeout 30 \
  --max-requests 500 \
  --max-requests-jitter 50 \
  --log-level warning
