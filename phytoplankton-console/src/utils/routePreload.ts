import { useRoutes } from '@/services/routing';
import { isLeaf, RouteItem } from '@/services/routing/types';

type LazyComponent = React.LazyExoticComponent<React.ComponentType<any>>;

let globalRoutes: RouteItem[] | null = null;

export function setRoutesRegistry(routes: RouteItem[]): void {
  globalRoutes = routes;
}

function findComponentForPath(routes: RouteItem[], path: string): LazyComponent | null {
  const normalizedPath = path.split('?')[0].split('#')[0];

  const findFirstComponent = (routeList: RouteItem[]): LazyComponent | null => {
    for (const route of routeList) {
      if (isLeaf(route) && 'component' in route) {
        return route.component as LazyComponent;
      }
      if ('routes' in route && route.routes) {
        const found = findFirstComponent(route.routes);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  const findInRoutes = (routeList: RouteItem[]): LazyComponent | null => {
    for (const route of routeList) {
      const routeMatches =
        route.path === normalizedPath ||
        (route.path !== '*' &&
          new RegExp(
            '^' +
              route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[^/]+/g, '[^/]+') +
              '$',
          ).test(normalizedPath));

      if (routeMatches) {
        if (isLeaf(route) && 'component' in route) {
          return route.component as LazyComponent;
        }
        if ('routes' in route && route.routes) {
          const found = findFirstComponent(route.routes);
          if (found) {
            return found;
          }
        }
      }

      if ('routes' in route && route.routes) {
        const found = findInRoutes(route.routes);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  return findInRoutes(routes);
}

function preloadLazyComponent(component: LazyComponent): void {
  if ((component as any).preload && typeof (component as any).preload === 'function') {
    (component as any).preload().catch(() => {});
  }
}

export function usePreloadRoute() {
  const routes = useRoutes();

  return (path: string): void => {
    const component = findComponentForPath(routes, path);
    if (component) {
      preloadLazyComponent(component);
    }
  };
}

export function preloadRoute(path: string): void {
  if (!globalRoutes) {
    return;
  }

  const component = findComponentForPath(globalRoutes, path);
  if (!component) {
    return;
  }

  preloadLazyComponent(component);
}
