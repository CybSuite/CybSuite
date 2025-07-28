// Cookie utility functions for client-side operations
export const cookieUtils = {
  get: (name: string): string | null => {
    if (typeof document === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  },

  set: (name: string, value: string, options: {
    path?: string;
    domain?: string;
    expires?: Date;
    maxAge?: number;
    sameSite?: 'strict' | 'lax' | 'none';
    secure?: boolean;
  } = {}): void => {
    if (typeof document === 'undefined') return;

    const {
      path = '/',
      domain,
      expires,
      maxAge = 365 * 24 * 60 * 60, // 1 year in seconds
      sameSite = 'lax',
      secure = false
    } = options;

    let cookieString = `${name}=${encodeURIComponent(value)}`;

    if (path) cookieString += `; path=${path}`;
    if (domain) cookieString += `; domain=${domain}`;
    if (expires) cookieString += `; expires=${expires.toUTCString()}`;
    if (maxAge) cookieString += `; max-age=${maxAge}`;
    if (sameSite) cookieString += `; samesite=${sameSite}`;
    if (secure) cookieString += `; secure`;

    document.cookie = cookieString;
  },

  remove: (name: string, options: {
    path?: string;
    domain?: string;
  } = {}): void => {
    if (typeof document === 'undefined') return;

    const { path = '/', domain } = options;

    let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    if (path) cookieString += `; path=${path}`;
    if (domain) cookieString += `; domain=${domain}`;

    document.cookie = cookieString;
  }
};
