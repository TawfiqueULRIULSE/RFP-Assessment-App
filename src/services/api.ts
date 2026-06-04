import type { AppUser } from '../types/domain';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

let activeActor: AppUser | null = null;
let authToken: string | null = null;

export const setApiActor = (actor: AppUser | null) => {
  activeActor = actor;
};

export const setApiAuthToken = (token: string | null) => {
  authToken = token;
};

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const buildHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (activeActor) {
    headers['x-user-id'] = activeActor.id;
    headers['x-role'] = activeActor.role;
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
};

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const parsed = (await response.json()) as { message?: string };
      if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      // Ignore parse errors and keep fallback message.
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
};
