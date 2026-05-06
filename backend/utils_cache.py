"""
Cache em memória simples com TTL para otimizar queries no Render Free Tier.
Reduz carga no banco Neon e melhora velocidade das respostas.
"""
import time
from typing import Any, Optional

class MemoryCache:
    """Cache em memória com TTL (Time To Live)."""
    
    def __init__(self):
        self._cache = {}
        # estrutura: {key: (valor, expira_em_timestamp)}
    
    def get(self, key: str) -> Optional[Any]:
        """Busca valor do cache se ainda não expirou."""
        if key not in self._cache:
            return None
        
        valor, expira_em = self._cache[key]
        if time.time() > expira_em:
            # Expirou, remove
            del self._cache[key]
            return None
        
        return valor
    
    def set(self, key: str, valor: Any, ttl_segundos: int = 60):
        """Armazena valor no cache com TTL."""
        expira_em = time.time() + ttl_segundos
        self._cache[key] = (valor, expira_em)
    
    def delete(self, key: str):
        """Remove chave do cache."""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """Limpa todo o cache."""
        self._cache.clear()
    
    def limpar_expirados(self):
        """Remove entradas expiradas (rodar periodicamente)."""
        agora = time.time()
        expirados = [k for k, (_, exp) in self._cache.items() if agora > exp]
        for k in expirados:
            del self._cache[k]
        return len(expirados)
    
    def stats(self) -> dict:
        """Retorna estatísticas do cache."""
        self.limpar_expirados()
        return {
            "chaves_ativas": len(self._cache),
            "memoria_estimada_kb": len(self._cache) * 2  # estimativa保守
        }

# Instância global do cache
cache = MemoryCache()

def cached_query(ttl_segundos: int = 60):
    """
    Decorator para cachear resultados de funções.
    Uso:
        @cached_query(ttl_segundos=30)
        def minha_funcao(db, usuario_id):
            return db.query(...).all()
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Gera chave baseada no nome da função e argumentos
            chave = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Tenta buscar do cache
            cached = cache.get(chave)
            if cached is not None:
                return cached
            
            # Executa e armazena no cache
            resultado = func(*args, **kwargs)
            cache.set(chave, resultado, ttl_segundos)
            return resultado
        
        return wrapper
    return decorator