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
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro na requisição');
        }

        if (options.isBlob) {
            return response.blob();
        }

        return response.json();
    },

    get: (endpoint) => api.request(endpoint, { method: 'GET' }),
    getBlob: (endpoint) => api.request(endpoint, { method: 'GET', isBlob: true }),
    post: (endpoint, body) => api.request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
};

export default api;
