#!/bin/bash
echo "🚀 INICIANDO PSY PAY BACKEND..."
gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT --timeout 120
