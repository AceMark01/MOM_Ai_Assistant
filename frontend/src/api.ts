import axios from 'axios';
import { useAuthStore } from './store';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor – attach Bearer token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  const hasAuth = config.headers.Authorization || config.headers.authorization;
  if (token && !hasAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor – auto logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      // Don't logout if already on login/forgot-password page
      if (currentPath !== '/login' && currentPath !== '/forgot-password') {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
