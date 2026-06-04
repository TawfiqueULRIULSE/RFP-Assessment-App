import type { AppUser } from '../types/domain';
import { apiRequest, setApiAuthToken } from './api';

interface AuthUsersResponse {
  users: AppUser[];
}

interface LoginResponse {
  token: string;
  user: AppUser;
}

interface SessionResponse {
  user: AppUser;
}

const AUTH_STORAGE_KEY = 'rfp-auth-token';

export const fetchAuthUsers = async (): Promise<AppUser[]> => {
  const response = await apiRequest<AuthUsersResponse>('/auth/users');
  return response.users;
};

export const loginAsUser = async (userId: string): Promise<AppUser> => {
  const response = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

  localStorage.setItem(AUTH_STORAGE_KEY, response.token);
  setApiAuthToken(response.token);
  return response.user;
};

export const restoreSession = async (): Promise<AppUser | null> => {
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!token) {
    setApiAuthToken(null);
    return null;
  }

  setApiAuthToken(token);

  try {
    const response = await apiRequest<SessionResponse>('/auth/session');
    return response.user;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setApiAuthToken(null);
    return null;
  }
};

export const logoutSession = async (): Promise<void> => {
  try {
    await apiRequest<{ ok: true }>('/auth/logout', { method: 'POST' });
  } catch {
    // No-op to ensure local cleanup always happens.
  } finally {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setApiAuthToken(null);
  }
};
