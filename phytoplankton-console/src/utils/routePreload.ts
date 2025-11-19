import type { ComponentType, LazyExoticComponent } from 'react';
import { useRoutes } from '@/services/routing';
import { isLeaf, RouteItem } from '@/services/routing/types';

type LazyComponent = LazyExoticComponent<ComponentType<any>>;

let globalRoutes: RouteItem[] | null = null;
const pendingPreloadPaths = new Set<string>();

export function setRoutesRegistry(routes: RouteItem[]): void {
  globalRoutes = routes;
  if (pendingPreloadPaths.size > 0) {
    pendingPreloadPaths.forEach((path) => {
      preloadFromRoutes(path, routes);
    });
    pendingPreloadPaths.clear();
  }
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

function preloadFromRoutes(path: string, routes: RouteItem[]): void {
  const component = findComponentForPath(routes, path);
  if (component) {
    preloadLazyComponent(component);
  }
}

export function usePreloadRoute() {
  const routes = useRoutes();

  return (path: string): void => {
    preloadFromRoutes(path, routes);
  };
}

export function preloadRoute(path: string): void {
  if (!globalRoutes) {
    pendingPreloadPaths.add(path);
    return;
  }

  preloadFromRoutes(path, globalRoutes);
}
