import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, useSidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppLayout: React.FC = () => {
  const { isOpen, toggle, close } = useSidebar();

  return (
    <div className="app-layout">
      <Sidebar isOpen={isOpen} onClose={close} />
      <div className="main-content">
        <Topbar sidebarOpen={isOpen} onToggleSidebar={toggle} />
        <main className="page-content" id="main-content" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
