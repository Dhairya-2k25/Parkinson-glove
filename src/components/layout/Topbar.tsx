import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, LogOut, UserCircle } from 'lucide-react';
import { MobileMenuButton } from './Sidebar';
import { sensorService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/monitoring': 'Live Monitoring',
  '/profile': 'Patient Profile',
  '/sessions': 'Session History',
  '/rehabilitation': 'Rehabilitation',
  '/alerts': 'Caregiver Alerts',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/sessions/')) return 'Session Details';
  return PAGE_TITLES[pathname] || 'NeuroGlove';
}

interface TopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ sidebarOpen, onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [streamStatus, setStreamStatus] = useState(sensorService.getConnectionStatus());

  useEffect(() => sensorService.onStatusChange((status) => {
    setStreamStatus(status);
  }), []);

  return (
    <header className="topbar" role="banner">
      <div className="flex items-center gap-3">
        <MobileMenuButton isOpen={sidebarOpen} onToggle={onToggleSidebar} />
        <h2 className="topbar-title">{getPageTitle(location.pathname)}</h2>
      </div>

      <div className="topbar-actions">
        {/* Shared stream/device status */}
        <div
          className={`badge flex items-center gap-1.5 ${streamStatus === 'connected' ? 'badge-success' : 'badge-neutral'}`}
          role="status"
          aria-label={streamStatus === 'connected' ? 'Device Connected' : 'Device Not Connected'}
          title={streamStatus === 'connected' ? 'Device Connected' : 'Device Not Connected'}
        >
          {streamStatus === 'connected' ? <Wifi size={12} aria-hidden="true" /> : <WifiOff size={12} aria-hidden="true" />}
          <span className="hidden sm:inline">{streamStatus === 'connected' ? 'Connected' : 'Not Connected'}</span>
        </div>

        {/* User chip + Logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="hidden md:flex items-center gap-1.5">
              <UserCircle size={18} className="text-text-tertiary" aria-hidden="true" />
              <span className="text-sm font-medium text-text-primary max-w-[120px] truncate">
                {user.name}
              </span>
              <span className="badge badge-neutral text-xs capitalize">{user.role}</span>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
