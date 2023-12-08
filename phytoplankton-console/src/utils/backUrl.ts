import { useLocation } from 'react-router';
import { makeUrl, parseQueryString, parseRoute } from '@/utils/routing';

const PARAMETER_NAME = 'backUrl';

export function addBackUrlToRoute(route: string | undefined): string | undefined {
  if (route == null) {
    return undefined;
  }
  const { pathname, queryParams } = parseRoute(route);
  queryParams[PARAMETER_NAME] = `${location.pathname}${location.search}`;
  return makeUrl(pathname, {}, queryParams);
}

/*
  Add back url from current location to route. Useful when need to change location and keep back url at the same time
 */
export function keepBackUrl(route: string): string {
  const { queryParams } = parseRoute(location.href);
  const backUrl = queryParams[PARAMETER_NAME];
  return makeUrl(
    route,
    {},
    {
      [PARAMETER_NAME]: backUrl,
    },
  );
}

export function useBackUrl(): string | null {
  const { search } = useLocation();
  const parsed = parseQueryString(search);
  return parsed[PARAMETER_NAME] ?? null;
}
