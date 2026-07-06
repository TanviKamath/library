import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <div className={styles['app-layout']}>
      <Sidebar collapsed={collapsed} toggleCollapse={toggleCollapse} />
      <main className={`${styles['app-main']} ${collapsed ? styles.collapsed : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
