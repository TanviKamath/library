import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved !== null ? saved === 'true' : true;
  });
  const [isHovered, setIsHovered] = useState(false);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const isExpanded = !collapsed || isHovered;

  return (
    <div className={styles['app-layout']}>
      <Sidebar 
        collapsed={collapsed} 
        toggleCollapse={toggleCollapse} 
        isHovered={isHovered}
        setIsHovered={setIsHovered}
      />
      <main className={`${styles['app-main']} ${!isExpanded ? styles.collapsed : ''}`}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
