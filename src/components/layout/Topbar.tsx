import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Wifi, WifiOff, AlertTriangle, Database, LogOut, UserCircle } from 'lucide-react';
import { MobileMenuButton } from './Sidebar';
import { settingsService, notificationService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/utils';
import type { AppNotification } from '@/types';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/monitoring': 'Live Monitoring',
  '/profile': 'Patient Profile',
  '/sessions': 'Session History',
  '/rehabilitation': 'Rehabilitation',
  '/alerts': 'Caregiver Alerts',
  '/settings': 'Settings',
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
  const settings = settingsService.getSettings();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(
    notificationService.getNotifications()
  );
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = useCallback(() => {
    notificationService.markAllAsRead();
    setNotifications(notificationService.getNotifications());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotifications(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="topbar" role="banner">
      <div className="flex items-center gap-3">
        <MobileMenuButton isOpen={sidebarOpen} onToggle={onToggleSidebar} />
        <h2 className="topbar-title">{getPageTitle(location.pathname)}</h2>
      </div>

      <div className="topbar-actions">
        {/* Data mode indicator */}
        <div
          className="badge badge-warning flex items-center gap-1.5"
          role="status"
          aria-label={`Data mode: ${settings.dataMode}`}
          title="Data source mode"
        >
          <Database size={12} aria-hidden="true" />
          <span className="hidden sm:inline">{settings.dataMode === 'demo' ? 'Demo Data' : settings.dataMode === 'live' ? 'Live' : 'Historical'}</span>
          <span className="sm:hidden">{settings.dataMode === 'demo' ? 'Demo' : settings.dataMode === 'live' ? 'Live' : 'Hist.'}</span>
        </div>

        {/* Connection indicator */}
        <div
          className="badge badge-neutral flex items-center gap-1.5"
          role="status"
          aria-label="Device not connected"
          title="Device connection status"
        >
          <WifiOff size={12} aria-hidden="true" />
          <span className="hidden sm:inline">Not Connected</span>
        </div>

        {/* Notifications */}
        <div className="dropdown" ref={notifRef}>
          <button
            className="btn btn-ghost btn-icon relative"
            onClick={() => setShowNotifications(v => !v)}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notif-dot" aria-hidden="true">{unreadCount}</span>
            )}
          </button>

          <div
            className={`dropdown-menu ${showNotifications ? 'open' : ''}`}
            role="menu"
            aria-label="Notifications"
            style={{ width: '340px', right: 0 }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-semibold text-text-primary">Notifications</span>
              {unreadCount > 0 && (
                <button
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium bg-transparent border-none cursor-pointer"
                  onClick={handleMarkAllRead}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-6">No notifications</p>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`dropdown-item flex-col items-start gap-0.5 ${!n.read ? 'bg-navy-50/50' : ''}`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2 w-full">
                      {n.type === 'warning' && <AlertTriangle size={14} className="text-warning-500 shrink-0" />}
                      {n.type === 'error' && <WifiOff size={14} className="text-danger-500 shrink-0" />}
                      {n.type === 'success' && <Wifi size={14} className="text-success-500 shrink-0" />}
                      <span className="font-medium text-sm">{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-teal-500 ml-auto shrink-0" aria-label="Unread" />}
                    </div>
                    <p className="text-xs text-text-secondary pl-5">{n.message}</p>
                    <p className="text-xs text-text-tertiary pl-5">{formatDateTime(n.timestamp)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
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
