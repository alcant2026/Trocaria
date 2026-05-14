const productionUrl = 'https://peer-5gq5.onrender.com/api';
const viteUrl = import.meta.env.VITE_API_URL;
const androidDevUrl = import.meta.env.VITE_API_URL_ANDROID || 'http://10.0.2.2:8000/api';

const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

// Garante que a URL base sempre termine com /api
function normalizarUrl(url) {
    if (!url) return url;
    const u = url.replace(/\/+$/, '');
    return u.endsWith('/api') ? u : u + '/api';
}

export const BASE_URL = normalizarUrl(viteUrl) || (import.meta.env.DEV 
    ? (isCapacitor ? androidDevUrl : '/api') 
    : productionUrl);

// ============================================================================
// CACHE EM MEMÓRIA PARA REDUZIR REQUISIÇÕES (Render Free Tier)
// ============================================================================
const cacheMemoria = new Map();
const CACHE_TTL = 30000; // 30 segundos de cache para GETs

function getCacheKey(endpoint, method) {
    return `${method}:${endpoint}`;
}

function getFromCache(key) {
    const item = cacheMemoria.get(key);
    if (!item) return null;
    if (Date.now() > item.expiraEm) {
        cacheMemoria.delete(key);
        return null;
    }
    return item.dados;
}

function setCache(key, dados, ttl = CACHE_TTL) {
    cacheMemoria.set(key, {
        dados,
        expiraEm: Date.now() + ttl
    });
}

function limparCache() {
    const agora = Date.now();
    for (const [key, item] of cacheMemoria) {
        if (agora > item.expiraEm) {
            cacheMemoria.delete(key);
        }
    }
}

// Limpa cache expirado a cada 5 minutos
setInterval(limparCache, 300000);

const api = {
    getToken: () => localStorage.getItem('token'),
    setToken: (token) => localStorage.setItem('token', token),

    // Invalida cache quando usuário faz login/logout
    limparCache: () => cacheMemoria.clear(),

    request: async (endpoint, options = {}) => {
        const token = api.getToken();
        const headers = { ...options.headers };

        if (!options.isBlob && !options.isMultipart) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const isGET = options.method === 'GET' || !options.method;
        const cacheKey = getCacheKey(endpoint, options.method || 'GET');

        // Tenta buscar do cache (apenas para GETs)
        if (isGET && !options.noCache) {
            const cached = getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        // Retry automático em falhas de rede (Render Free cold start)
        const maxRetries = options.noRetry ? 0 : 2;
        let lastError;
        
        for (let tentativa = 0; tentativa <= maxRetries; tentativa++) {
            try {
                const response = await fetch(`${BASE_URL}${endpoint}`, {
                    ...options,
                    headers,
                    credentials: 'include',
                });

                if (!response.ok) {
                    let errorMessage = 'Erro na requisição';
                    let errorData = {};
                    try {
                        errorData = await response.json();
                        errorMessage = errorData.detail || errorMessage;
                    } catch {
                        const text = await response.text().catch(() => '');
                        if (text) errorMessage = text;
                    }

                    // Só faz logout automático se for erro de SESSÃO (token ausente/expirado)
                    if (response.status === 401) {
                        const errosDeNegocio = ['2fa', 'código', 'inválido', 'expirado'];
                        const ehErroNegocio = errosDeNegocio.some(termo => 
                            errorMessage.toLowerCase().includes(termo)
                        );
                        if (!ehErroNegocio) {
                            window.dispatchEvent(new Event('psypay_unauthorized'));
                        }
                    }

                    throw new Error(errorMessage);
                }

                let resultado;
                if (options.isBlob) {
                    resultado = await response.blob();
                } else {
                    resultado = await response.json();
                }

                // Guarda no cache (apenas GETs com sucesso)
                if (isGET && !options.noCache) {
                    setCache(cacheKey, resultado);
                }

                return resultado;

            } catch (err) {
                lastError = err;
                
                // Se for erro de rede (Render cold start), tenta de novo
                const ehErroDeRede = err.message?.includes('fetch') || 
                                    err.message?.includes('network') ||
                                    err.message?.includes('Failed to fetch');
                
                if (ehErroDeRede && tentativa < maxRetries) {
                    const delay = 1000 * (tentativa + 1); // 1s, 2s
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                
                throw err;
            }
        }
        
        throw lastError;
    },

    async get(endpoint, options = {}) { return this.request(endpoint, { method: 'GET', ...options }); },
    async getBlob(endpoint) { return this.request(endpoint, { method: 'GET', isBlob: true }); },
    async post(endpoint, body, options = {}) { 
        const isFormData = body instanceof FormData;
        return this.request(endpoint, { 
            method: 'POST', 
            body: isFormData ? body : JSON.stringify(body),
            isMultipart: isFormData,
            ...options 
        }); 
    },
    async put(endpoint, body, options = {}) { 
        const isFormData = body instanceof FormData;
        return this.request(endpoint, { 
            method: 'PUT', 
            body: isFormData ? body : JSON.stringify(body),
            isMultipart: isFormData,
            ...options 
        }); 
    },
    async delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
    async patch(endpoint, body, options = {}) { 
        const isFormData = body instanceof FormData;
        return this.request(endpoint, { 
            method: 'PATCH', 
            body: isFormData ? body : JSON.stringify(body),
            isMultipart: isFormData,
            ...options 
        }); 
    },

    // Posts com warmup silencioso (evita timeout no Render cold start)
    async postWithWarmup(endpoint, body, options = {}) {
        try {
            await fetch(`${BASE_URL}/__warmup`, { 
                signal: AbortSignal.timeout(15000) 
            });
        } catch {}
        const isFormData = body instanceof FormData;
        return this.request(endpoint, { 
            method: 'POST', 
            body: isFormData ? body : JSON.stringify(body),
            isMultipart: isFormData,
            noRetry: true,
            ...options 
        }); 
    },
};

export default api;