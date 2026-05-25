import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { saveToStorage } from './lib/api';
import LoginPage from './pages/LoginPage';
// Signup removed — only admin-created users can log in
import HomePage from './pages/HomePage';

import AdminLoginPage from './admin/pages/AdminLoginPage';
import AdminDashboard from './admin/pages/AdminDashboard';
import AdminUserSettingsPage from './admin/pages/AdminUserSettingsPage';
import './index.css';
import { NotificationProvider, useNotifications } from './lib/NotificationContext';

function GlobalSystemErrorListenerComponent() {
  const { addNotification } = useNotifications();

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      addNotification({
        title: 'System Error',
        message: e.message || 'An unexpected error occurred.',
        type: 'error'
      });
    };

    const handleRejection = (e: PromiseRejectionEvent) => {
      addNotification({
        title: 'Network or Action Failed',
        message: e.reason?.message || 'An asynchronous action failed.',
        type: 'error'
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addNotification]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min — cached data used on revisit without refetch
      refetchOnWindowFocus: false,   // don't refetch just because user switched tabs
      retry: 1,                      // fail faster (default is 3)
    },
  },
});

function PrivateRoute({ children, fallback = "/login" }: { children: React.ReactNode, fallback?: string }) {
  const { token, user, isLoading } = useAuth();
  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)', color: 'var(--navy)', fontSize: '16px', fontWeight: 500 }}>Authenticating...</div>;
  if (!token) return <Navigate to={fallback} replace />;
  // sheet_admin always goes to workspace directly — no admin dashboard access
  // admin/superadmin go to admin dashboard unless they explicitly clicked "Main Workspace"
  if ((user?.role === 'admin' || user?.role === 'superadmin') && !sessionStorage.getItem('admin_workspace_mode')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, user, isLoading } = useAuth();
  if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)', color: 'var(--navy)', fontSize: '16px', fontWeight: 500 }}>Authenticating...</div>;
  if (!token) return <Navigate to="/admin/login" replace />;
  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

/** Toast notification for save feedback */
function SaveToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="save-toast">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Data saved successfully
    </div>
  );
}

function AppRoutes() {
  const { token, user } = useAuth();
  const isSystemAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  return (
    <Routes>
      {/* ── Public auth routes ── */}
      <Route path="/login" element={token ? (isSystemAdmin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/" replace />) : <LoginPage />} />
      {/* Signup removed — only admin-created users can access */}
      
      {/* ── Admin routes ── */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/login" element={token && isSystemAdmin ? <Navigate to="/admin/dashboard" replace /> : <AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/users/:id" element={<AdminRoute><AdminUserSettingsPage /></AdminRoute>} />

      {/* ── App routes ── */}
      <Route path="/*" element={<PrivateRoute><HomePage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  const [showSaveToast, setShowSaveToast] = useState(false);

  const handleSave = useCallback(() => {
    const ok = saveToStorage();
    if (ok) {
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    }
  }, []);

  // Ctrl+S / Cmd+S global save handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <GlobalSystemErrorListenerComponent />
              <AppRoutes />
              <SaveToast visible={showSaveToast} />
              <Toaster position="top-center" />
            </ErrorBoundary>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
