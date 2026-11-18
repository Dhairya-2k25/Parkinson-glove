import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Auth pages — eager loaded (small, needed immediately)
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';

// App pages — lazy loaded
const DashboardPage      = lazy(() => import('@/pages/DashboardPage'));
const LiveMonitoringPage = lazy(() => import('@/pages/LiveMonitoringPage'));
const PatientProfilePage = lazy(() => import('@/pages/PatientProfilePage'));
const SessionHistoryPage = lazy(() => import('@/pages/SessionHistoryPage'));
const SessionDetailPage  = lazy(() => import('@/pages/SessionDetailPage'));
const RehabilitationPage = lazy(() => import('@/pages/RehabilitationPage'));
const AlertsPage         = lazy(() => import('@/pages/AlertsPage'));
const SettingsPage       = lazy(() => import('@/pages/SettingsPage'));

function PageLoader() {
  return (
    <div style={{ padding: '2rem' }}>
      <div className="skeleton" style={{ height: '2rem', width: '12rem', marginBottom: '1.5rem' }} />
      <div className="card">
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="skeleton" style={{ height: '6rem' }} />
          <div className="skeleton" style={{ height: '6rem' }} />
          <div className="skeleton" style={{ height: '6rem' }} />
        </div>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <Routes>
      {/* ── Public auth routes ── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* ── Protected app routes ── */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
        <Route path="monitoring" element={<Suspense fallback={<PageLoader />}><LiveMonitoringPage /></Suspense>} />
        <Route path="profile" element={<Suspense fallback={<PageLoader />}><PatientProfilePage /></Suspense>} />
        <Route path="sessions" element={<Suspense fallback={<PageLoader />}><SessionHistoryPage /></Suspense>} />
        <Route path="sessions/:sessionId" element={<Suspense fallback={<PageLoader />}><SessionDetailPage /></Suspense>} />
        <Route path="rehabilitation" element={<Suspense fallback={<PageLoader />}><RehabilitationPage /></Suspense>} />
        <Route path="alerts" element={<Suspense fallback={<PageLoader />}><AlertsPage /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
