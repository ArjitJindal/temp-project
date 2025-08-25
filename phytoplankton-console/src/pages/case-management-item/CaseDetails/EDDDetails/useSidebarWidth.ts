import { useState, useEffect } from 'react';

export const useSidebarWidth = () => {
  const [sidebarWidth, setSidebarWidth] = useState(220);

  useEffect(() => {
    const updateSidebarWidth = () => {
      const sidebar = document.querySelector('[class*="aside"]') as HTMLElement;
      if (sidebar) {
        setSidebarWidth(sidebar.offsetWidth);
      }
    };

    updateSidebarWidth();

    // Listen for window resize
    window.addEventListener('resize', updateSidebarWidth);

    // Listen for sidebar width changes (collapse/expand)
    const sidebar = document.querySelector('[class*="aside"]') as HTMLElement;
    if (sidebar) {
      const resizeObserver = new ResizeObserver(() => {
        updateSidebarWidth();
      });
      resizeObserver.observe(sidebar);

      return () => {
        window.removeEventListener('resize', updateSidebarWidth);
        resizeObserver.disconnect();
      };
    }

    return () => window.removeEventListener('resize', updateSidebarWidth);
  }, []);

  return sidebarWidth;
};
