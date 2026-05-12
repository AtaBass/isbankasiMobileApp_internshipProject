import { Platform } from 'react-native';
import { storage } from './storage';

// Gerçek cihazda kayıt/giriş "Network request failed" oluyorsa: bilgisayarın IP'sini yazın (örn. '192.168.1.100')
const DEV_PC_IP = null;
const getApiBase = () => {
  if (DEV_PC_IP) return `http://${DEV_PC_IP}:4000/api`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000/api';
  if (Platform.OS === 'web') return 'http://localhost:4000/api';
  return 'http://localhost:4000/api';
};
const API_BASE = getApiBase();

async function getToken() {
  return await storage.getItem('token');
}

export async function api(method, path, body) {
  const token = await getToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const auth = {
  login: (email, password) => api('POST', '/auth/login', { email, password }),
  register: (data) => api('POST', '/auth/register', data),
};

export const dashboard = {
  get: () => api('GET', '/dashboard'),
};

export const goals = {
  list: () => api('GET', '/goals'),
  create: (data) => api('POST', '/goals', data),
  update: (id, data) => api('PATCH', `/goals/${id}`, data),
  splits: () => api('GET', '/goals/splits'),
  addSplit: (data) => api('POST', '/goals/splits', data),
};

export const social = {
  groups: () => api('GET', '/social/groups'),
  createGroup: (data) => api('POST', '/social/groups', data),
  addExpense: (groupId, data) => api('POST', `/social/groups/${groupId}/expenses`, data),
  debts: (groupId) => api('GET', `/social/groups/${groupId}/debts`),
};

export const transactions = {
  list: (limit) => api('GET', `/transactions?limit=${limit || 20}`),
  addIncome: (data) => api('POST', '/transactions/income', data),
  addExpense: (data) => api('POST', '/transactions/expense', data),
};

export const reels = {
  list: () => api('GET', '/reels'),
  watch: (id, watchedSeconds) => api('POST', `/reels/${id}/watch`, { watched_seconds: watchedSeconds }),
  myViews: () => api('GET', '/reels/my-views'),
};

export const tasks = {
  list: () => api('GET', '/tasks'),
  complete: (id) => api('POST', `/tasks/${id}/complete`),
};

export const rewards = {
  list: () => api('GET', '/rewards'),
  myPoints: () => api('GET', '/rewards/my-points'),
  redeem: (rewardId) => api('POST', '/rewards/redeem', { reward_id: rewardId }),
  myRedemptions: () => api('GET', '/rewards/my-redemptions'),
};
