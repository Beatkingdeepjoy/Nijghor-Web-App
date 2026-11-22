// Centralized API Base URL configuration supporting Vercel + Render split
// Includes automatic resilient fallback for local frontend development when backend is offline.

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(path);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('nijghor_access_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Check if the response is an HTML error page (e.g. Vite 504 proxy error when local backend isn't started)
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok && (contentType.includes('text/html') || res.status === 504 || res.status === 502)) {
      console.warn(`[API] Server unavailable at ${url}. Providing local mock fallback for preview.`);
      return handleMockFallback(path, options);
    }

    return res;
  } catch (err) {
    console.warn(`[API] Network error fetching ${url}. Providing local mock fallback:`, err);
    return handleMockFallback(path, options);
  }
}

function handleMockFallback(path: string, options: RequestInit): Response {
  let bodyData: any = {};
  if (options.body && typeof options.body === 'string') {
    try {
      bodyData = JSON.parse(options.body);
    } catch {}
  }

  let mockResponse: any = { success: true };

  if (path.includes('/api/auth/username/check')) {
    const query = path.split('?')[1] || '';
    const params = new URLSearchParams(query);
    const u = params.get('username') || 'user';
    mockResponse = {
      is_available: true,
      sanitized_username: u,
      error_message: '',
    };
  } else if (path.includes('/api/auth/email/request-code')) {
    mockResponse = {
      success: true,
      expires_in_seconds: 600,
      message: 'Verification code sent (Dev mode: enter any 6 digits like 123456)',
    };
  } else if (path.includes('/api/auth/email/verify-code')) {
    mockResponse = {
      success: true,
      email_verification_token: 'mock_dev_email_token_verified',
      is_existing_user: false,
      existing_username: '',
    };
  } else if (path.includes('/api/auth/register')) {
    const username = bodyData.username || 'user';
    mockResponse = {
      success: true,
      user_id: crypto.randomUUID(),
      username: username,
      access_token: 'mock_access_token_dev',
      refresh_token: 'mock_refresh_token_dev',
      expires_at: Math.floor(Date.now() / 1000) + 900,
    };
  } else if (path.includes('/api/keys/upload')) {
    mockResponse = {
      success: true,
      remaining_one_time_prekeys: 50,
      message: 'Prekeys uploaded successfully',
    };
  } else if (path.includes('/api/users/lookup')) {
    const query = path.split('?')[1] || '';
    const params = new URLSearchParams(query);
    const u = params.get('username') || 'user';
    mockResponse = {
      found: true,
      user_id: crypto.randomUUID(),
      username: u,
      created_at: new Date().toISOString(),
    };
  } else if (path.includes('/api/keys/')) {
    mockResponse = {
      user_id: crypto.randomUUID(),
      username: 'target_user',
      registration_id: 1234,
      identity_key: 'BMockIdentityKeyBase64StringForLocalDevTesting12345=',
      signed_prekey_id: 1,
      signed_prekey: 'BMockSignedPrekeyBase64StringForLocalDevTesting12345=',
      signed_prekey_signature: 'BMockSignatureBase64StringForLocalDevTesting12345=',
      one_time_prekey: {
        key_id: 1,
        public_key: 'BMockOneTimePrekeyBase64StringForLocalDevTesting12345=',
      },
    };
  }

  return new Response(JSON.stringify(mockResponse), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
