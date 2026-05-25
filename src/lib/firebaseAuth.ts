/**
 * Express REST API-based Auth, User Management, Activity Logs & Download Requests.
 * Connects securely to the Neon PostgreSQL backend.
 */

// --- User Types ---
export interface AppUser {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: 'superadmin' | 'admin' | 'sheet_admin' | 'user';
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDownload: boolean;
    isAdmin: boolean;
    canCreateSheets?: boolean;
    viewRestrictions?: Record<string, number[]> | null;
    editRestrictions?: Record<string, number[]> | null;
    downloadRestrictions?: Record<string, number[]> | null;
    createRestrictions?: Record<string, boolean> | null;
    rowViewRestrictions?: Record<string, { start?: number; end?: number }> | null;
    rowEditRestrictions?: Record<string, { start?: number; end?: number }> | null;
    rowDownloadRestrictions?: Record<string, { start?: number; end?: number }> | null;
    fullSheetAccess?: boolean;
    allowedRegisters?: string[];
    allowedFolders?: string[];
  };
}

let bootstrapped = false;

// --- Bootstrap: Ensure default admin exists ---
export async function ensureDefaultAdmin(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    await fetch('/api/auth/ensure-default-admin', { method: 'POST' });
  } catch (err) {
    console.error('Failed to ensure default admin:', err);
  }
}

// --- Auth ---
export async function firebaseLogin(email: string, password: string) {
  await ensureDefaultAdmin();
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Invalid email or password');
  }

  return res.json() as Promise<{ token: string; user: AppUser }>;
}

export async function firebaseAdminLogin(email: string, password: string) {
  await ensureDefaultAdmin();
  const res = await fetch('/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Invalid admin credentials');
  }

  return res.json() as Promise<{ token: string; user: AppUser }>;
}

export async function firebaseLogout(): Promise<void> {
  // Client-side logout is handled by clearing tokens in auth context
  return Promise.resolve();
}

export async function firebaseGetMe(token: string): Promise<AppUser> {
  const res = await fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch user profile');
  }

  const data = await res.json();
  return data.user as AppUser;
}

/**
 * Real-time subscription helper.
 * Since standard HTTP doesn't have open persistent listeners, we use a robust polling
 * model that calls our lightweight /api/auth/me endpoint periodically.
 */
export function subscribeToMe(
  token: string,
  onUpdate: (user: AppUser) => void,
  onError: (err: any) => void
) {
  let active = true;
  
  const poll = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Session validation failed');
      const data = await res.json();
      if (active) onUpdate(data.user as AppUser);
    } catch (err) {
      if (active) onError(err);
    }
  };

  // Immediate check
  poll();

  // Poll every 8 seconds
  const interval = setInterval(poll, 8000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

// --- Admin System Logs & Users ---
export async function firebaseGetActivity(token: string): Promise<any[]> {
  const res = await fetch('/api/auth/activity', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch activity log');
  return res.json();
}

function getToken(): string {
  return sessionStorage.getItem('recordbook_token') || localStorage.getItem('recordbook_token') || '';
}

export async function firebaseGetUsers(token?: string): Promise<{ users: AppUser[] }> {
  const t = token || getToken();
  const res = await fetch('/api/auth/users', {
    headers: { 'Authorization': `Bearer ${t}` }
  });
  if (!res.ok) throw new Error('Failed to fetch users list');
  const users = await res.json();
  return { users };
}

export async function firebaseCreateUser(userData: { name: string; email: string; password?: string; role: string }): Promise<void> {
  const token = getToken();
  const res = await fetch('/api/auth/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(userData)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create user');
  }
}

export async function firebaseDeleteUser(userId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/auth/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to delete user');
  }
}

export async function firebaseUpdateUserStatus(userId: string, status: 'active' | 'inactive'): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/auth/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update user status');
  }
}

// --- Admin Request Management ---
export async function firebaseGetAllDownloadRequests(token?: string): Promise<any[]> {
  const t = token || getToken();
  const res = await fetch('/api/auth/download-requests', {
    headers: { 'Authorization': `Bearer ${t}` }
  });
  if (!res.ok) throw new Error('Failed to fetch download requests');
  return res.json();
}

export async function firebaseRespondRequest(
  token: string | undefined,
  requestId: string,
  data: { status: 'approved' | 'rejected'; responseNote?: string }
): Promise<void> {
  const t = token || getToken();
  const res = await fetch(`/api/auth/download-requests/${requestId}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to respond to request');
}

// --- User Profile & Permissions Settings ---
export async function firebaseUpdatePermissions(
  token: string | undefined,
  userId: string,
  permissions: any
): Promise<void> {
  const t = token || getToken();
  const res = await fetch(`/api/auth/users/${userId}/permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t}`
    },
    body: JSON.stringify({ permissions })
  });
  if (!res.ok) throw new Error('Failed to update permissions');
}

export async function firebaseAdminChangePassword(
  token: string | undefined,
  userId: string,
  passwordHash: string
): Promise<void> {
  const t = token || getToken();
  const res = await fetch(`/api/auth/users/${userId}/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t}`
    },
    body: JSON.stringify({ password: passwordHash })
  });
  if (!res.ok) throw new Error('Failed to change password');
}

export async function firebaseUpdateUser(
  token: string | undefined,
  userId: string,
  data: { name: string; role: string; status: string }
): Promise<void> {
  const t = token || getToken();
  const res = await fetch(`/api/auth/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update user profile');
}

// --- Download Request Modal ---
export async function firebaseCreateRequest(token: string | undefined, requestData: any): Promise<void> {
  const t = token || getToken();
  const res = await fetch('/api/auth/download-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${t}`
    },
    body: JSON.stringify(requestData)
  });
  if (!res.ok) throw new Error('Failed to submit download request');
}

// --- Realtime Register Action Logger ---
export async function firebaseLogWorkspaceAction(token: string | undefined, actionData: any): Promise<void> {
  try {
    const t = token || getToken();
    await fetch('/api/auth/activity/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${t}`
      },
      body: JSON.stringify(actionData)
    });
  } catch (err) {
    console.error('Failed to log action:', err);
  }
}
