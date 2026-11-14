import React, { useState, useCallback, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  User,
  ClipboardList,
  Heart,
  Bell,
  Settings,
  Menu,
  X,
  Hand,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/monitoring', icon: Activity, label: 'Live Monitoring' },
  { to: '/analytics', icon: Activity, label: 'Tremor Analytics' },
  { to: '/profile', icon: User, label: 'Patient Profile' },
  { to: '/sessions', icon: ClipboardList, label: 'Session History' },
  { to: '/rehabilitation', icon: Heart, label: 'Rehabilitation' },
  { to: '/alerts', icon: Bell, label: 'Caregiver Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  // Close mobile sidebar on route change
  useEffect(() => {
    onClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${isOpen ? 'open' : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" aria-hidden="true">
            <Hand size={20} />
          </div>
          <div>
            <h1>NeuroGlove</h1>
            <p>Motor Symptom Monitor</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              aria-current={location.pathname === item.to ? 'page' : undefined}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>NeuroGlove v1.0 — Prototype</p>
          <p style={{ marginTop: '0.25rem' }}>Capstone Project 2026</p>
        </div>
      </aside>
    </>
  );
};

export const MobileMenuButton: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
}> = ({ isOpen, onToggle }) => (
  <button
    className="mobile-menu-btn btn btn-ghost btn-icon"
    onClick={onToggle}
    aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
    aria-expanded={isOpen}
  >
    {isOpen ? <X size={22} /> : <Menu size={22} />}
  </button>
);

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen(v => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  return { isOpen, toggle, close };
}
