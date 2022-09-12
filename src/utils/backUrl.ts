import { useLocation } from 'react-router';
import { makeUrl, parseQueryString, parseRoute } from '@/utils/routing';

const PARAMETER_NAME = 'backUrl';

export function addBackUrlToRoute(route: string): string {
  const { pathname, queryParams } = parseRoute(route);
  queryParams[PARAMETER_NAME] = `${location.pathname}${location.search}`;
  return makeUrl(pathname, {}, queryParams);
}

export function useBackUrl(): string | null {
  const { search } = useLocation();
  const parsed = parseQueryString(search);
  return parsed[PARAMETER_NAME] ?? null;
}
