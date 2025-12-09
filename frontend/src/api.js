import axios from 'axios';

// Create the Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000', 
  withCredentials: true, 
});

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, config } = error.response;

      // 1. Unauthorized (401) - Session expired or invalid login
      if (status === 401) {
        // Don't redirect if we are already on the login page trying to login
        if (config.url.includes('/login')) {
            return Promise.reject(error);
        }
        console.warn("Session expired. Redirecting to login...");
        localStorage.removeItem('sacco_user'); // Correct key
        window.location.href = '/'; 
      }

      // 2. Forbidden (403) - Role mismatch or access denied
      if (status === 403) {
        // FIX: Don't redirect to unauthorized if it's a login attempt error
        if (config.url.includes('/login')) {
            return Promise.reject(error);
        }
        console.warn("Access denied.");
        window.location.href = '/unauthorized';
      }

      // 3. Not Found (404)
      if (status === 404) {
        console.warn("Resource not found.");
      }

      // 4. Server Error (500)
      if (status >= 500) {
        console.error("Server error detected.");
        if (config.method === 'get') {
            // Only redirect full page loads, not background API calls
            // window.location.href = '/server-error'; 
        }
      }
    } else if (error.request) {
      console.error("Network error - server might be down");
    }

    return Promise.reject(error);
  }
);

export default api;