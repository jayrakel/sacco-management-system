import axios from 'axios';

// Centralized API configuration
const api = axios.create({
  baseURL: 'http://localhost:5000', // Your Backend URL
  withCredentials: true, // CRITICAL: This ensures cookies are sent/received
});

// Global Error Handler (Optional but recommended)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.error("Session expired or unauthorized.");
      // You could trigger a logout here if you had a global store
    }
    return Promise.reject(error);
  }
);

export default api;