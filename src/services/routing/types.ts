export interface RouteCommonProps {
  path: string;
}

export interface LeafRouteItem extends RouteCommonProps {
  name: string;
  icon?: string;
  hideInMenu?: boolean;
  component: React.FC<any>; // todo: improve types
}

export interface TreeRouteItem extends RouteCommonProps {
  name: string;
  icon?: string;
  routes: RouteItem[];
  hideInMenu?: boolean;
  hideChildrenInMenu?: boolean;
}

export interface RedirectRouteItem extends RouteCommonProps {
  redirect: string;
}

export type RouteItem = LeafRouteItem | TreeRouteItem | RedirectRouteItem;
export type RouteWithPath = LeafRouteItem | TreeRouteItem;

export function isTree(route: RouteItem): route is TreeRouteItem {
  return 'routes' in route;
}

export function isRedirect(route: RouteItem): route is RedirectRouteItem {
  return 'redirect' in route;
}

export function isLeaf(route: RouteItem): route is LeafRouteItem {
  return !isRedirect(route) && !isTree(route);
}

export function hasName(route: RouteItem): route is LeafRouteItem | TreeRouteItem {
  return isLeaf(route) || isTree(route);
}
