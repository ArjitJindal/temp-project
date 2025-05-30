import { Feature, Permission } from '@/apis';
import { Resource } from '@/utils/user-utils';

export interface RouteCommonProps {
  path: string;
  position?: 'top' | 'bottom';
}

export interface LeafRouteItem extends RouteCommonProps {
  name: string;
  icon?: string;
  hideInMenu?: boolean;
  component: React.FC<any>; // todo: improve types
  disabled?: boolean;
  permissions?: Permission[];
  associatedFeatures?: Feature[];
  minRequiredResources?: Resource[];
}

export interface TreeRouteItem extends RouteCommonProps {
  name: string;
  icon?: string;
  routes: RouteItem[];
  hideInMenu?: boolean;
  hideChildrenInMenu?: boolean;
  disabled?: boolean;
  permissions?: Permission[];
  associatedFeatures?: Feature[];
  minRequiredResources?: Resource[];
}

export interface RedirectRouteItem extends RouteCommonProps {
  redirect: string;
  disabled?: boolean;
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
