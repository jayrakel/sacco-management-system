import axios from 'axios';

// Create the Axios instance
const api = axios.create({
  // Use Vite environment variable for URL, fallback to localhost
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
      const { status } = error.response;

      // 1. Unauthorized (401) - Session expired or invalid login
      if (status === 401) {
        console.warn("Session expired. Redirecting to login...");
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/'; 
      }

      // 2. Forbidden (403) - Role mismatch or access denied
      if (status === 403) {
        console.warn("Access denied.");
        window.location.href = '/unauthorized';
      }

      // 3. Not Found (404) - API endpoint missing (rare in production)
      if (status === 404) {
        console.warn("Resource not found.");
        // Optional: redirect to /not-found if critical data is missing
      }

      // 4. Server Error (500) - Backend crash
      if (status >= 500) {
        console.error("Server error detected.");
        // We only redirect to the error page for GET requests to avoid disrupting forms
        if (error.config.method === 'get') {
            window.location.href = '/server-error';
        }
      }
    } else if (error.request) {
      // Network Error (Server down / No internet)
      console.error("Network error - server might be down");
      // Optional: window.location.href = '/server-error';
    }

    return Promise.reject(error);
  }
);

export default api;