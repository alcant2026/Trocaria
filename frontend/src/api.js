const productionUrl = 'https://peer-5gq5.onrender.com/api';
const viteUrl = import.meta.env.VITE_API_URL;
const androidDevUrl = import.meta.env.VITE_API_URL_ANDROID || 'http://10.0.2.2:8000/api';

const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

// Prioriza URL de variável de ambiente se definida (mesmo em dev se quisermos forçar o apontamento remoto)
export const BASE_URL = viteUrl || (import.meta.env.DEV 
    ? (isCapacitor ? androidDevUrl : '/api') 
    : productionUrl);

const api = {
    getToken: () => localStorage.getItem('token'),
    setToken: (token) => localStorage.setItem('token', token),

    request: async (endpoint, options = {}) => {
        const token = api.getToken();
        const headers = { ...options.headers };

        if (!options.isBlob && !options.isMultipart) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Identificação de Plataforma (Web vs Android/iOS)
        const platform = isCapacitor ? (window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'mobile') : 'web';
        headers['X-Platform'] = platform;

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
            // NÃO fazer logout para erros de validação de negócio (ex: código 2FA inválido)
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

        if (options.isBlob) {
            return response.blob();
        }

        return response.json();
    },

    async get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
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
};

export default api;
