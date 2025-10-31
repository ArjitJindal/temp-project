import { useEffect } from 'react';

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

    // Load the FreshDesk script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://widget.freshworks.com/widgets/${widgetId}.js`;
    script.async = true;
    script.defer = true;

    // Set widget settings
    window.fwSettings = { widget_id: widgetId, locale: 'en' };

    // Create FreshworksWidget function if it doesn't exist
    if (typeof window.FreshworksWidget !== 'function') {
      const n = function (...args: any[]) {
        n.q.push(args);
      } as any;
      n.q = [];
      window.FreshworksWidget = n;
    }

    document.head.appendChild(script);

    if (window.FreshworksWidget) {
      window.FreshworksWidget('hide', 'launcher');
      window.FreshworksWidget.bind;
    }

    // Cleanup script when component is unmounted
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
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
