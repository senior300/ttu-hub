import axios from 'axios';
import { auth } from '../lib/firebase';

export const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function extractErrorMessage(err: unknown, fallback = 'Request failed.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
