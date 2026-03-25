const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = {
    getToken: () => localStorage.getItem('token'),
    setToken: (token) => localStorage.setItem('token', token),

    request: async (endpoint, options = {}) => {
        const token = api.getToken();
        const headers = { ...options.headers };

        if (!options.isBlob) {
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
                window.dispatchEvent(new Event('psy pay_unauthorized'));
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
    async post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
    async put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    async delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
};

export default api;
