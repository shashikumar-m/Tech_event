const API_URL = 'https://tech-event-uvmv.onrender.com/api';

class ApiService {
    static getToken() {
        return localStorage.getItem('token');
    }

    static async request(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        if (config.body && typeof config.body !== 'string') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API Error');
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    static login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: credentials
        });
    }

    // Quiz APIs
    static getQuestions() {
        return this.request('/quiz/questions');
    }

    static getEventInfo() {
        return this.request('/quiz/event-info');
    }

    static submitMcq(data) {
        return this.request('/quiz/submit-mcq', {
            method: 'POST',
            body: data
        });
    }

    // Code APIs
    static runCode(data) {
        return this.request('/code/run', {
            method: 'POST',
            body: data
        });
    }

    static submitCode(data) {
         return this.request('/code/submit', {
             method: 'POST',
             body: data
         });
    }

    // Leaderboard
    static getLeaderboard(eventId) {
        return this.request(`/leaderboard/${eventId}`);
    }
}
