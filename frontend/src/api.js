const BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.dispatchEvent(new Event('psypay_unauthorized'));
            }
            let errorMessage = 'Erro na requisição';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch {
                const text = await response.text().catch(() => '');
                if (text) errorMessage = text;
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
};

export default api;
