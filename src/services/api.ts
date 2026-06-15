import type { AppUser } from '../types/domain';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

let authToken: string | null = null;

/** @deprecated Identity is now established solely via the bearer token. */
export const setApiActor = (_actor: AppUser | null) => {
  // No-op: x-user-id / x-role headers are no longer sent.
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
