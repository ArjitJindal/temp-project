import { useEffect } from 'react';
import { CSPScriptLoader } from '@/utils/csp-utils';

declare global {
  interface Window {
    fwSettings?: {
      widget_id: number;
      locale?: string;
    };
    FreshworksWidget?: {
      (...args: any[]): void;
      q?: any[];
    };
  }
}

export const openFreshworksWidget = () => {
  if (window.FreshworksWidget) {
    window.FreshworksWidget('open');
  }
};

export const closeFreshworksWidget = () => {
  if (window.FreshworksWidget) {
    window.FreshworksWidget('close');
  }
};

const FreshworkComponent: React.FC = () => {
  useEffect(() => {
    const widgetId = FRESHWORK_WIDGET_KEY;

    if (!widgetId) {
      console.warn('Freswork widget key is not defined');
      return;
    }

    if (window.FreshworksWidget) {
      window.FreshworksWidget('boot');
      return;
    }

    // Set widget settings before loading script
    window.fwSettings = { widget_id: widgetId, locale: 'en' };

    // Create FreshworksWidget function if it doesn't exist
    if (typeof window.FreshworksWidget !== 'function') {
      const n = function (...args: any[]) {
        n.q.push(args);
      } as any;
      n.q = [];
      window.FreshworksWidget = n;
    }

    // Load Freshworks widget using CSP-compliant method
    CSPScriptLoader.loadFreshworksWidget(widgetId.toString())
      .then(() => {
        if (window.FreshworksWidget) {
          window.FreshworksWidget('hide', 'launcher');
        }
      })
      .catch((error) => {
        console.error('Failed to load Freshworks widget:', error);
      });

    // Cleanup when component is unmounted
    return () => {
      if (window.FreshworksWidget) {
        window.FreshworksWidget('destroy');
      }
      delete window.fwSettings;
      delete window.FreshworksWidget;
    };
  }, []);

  return <></>;
};

export default FreshworkComponent;
