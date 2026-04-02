from slowapi import Limiter
from fastapi import Request

def get_real_ip(request: Request):
    # Tenta pegar o IP real do Render/Proxy, se falhar usa o padrão, se for OPTIONS retorna nulo (ignora)
    if request.method == "OPTIONS":
        return None
    return request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for") or request.client.host or "unknown"

limiter = Limiter(key_func=get_real_ip)
