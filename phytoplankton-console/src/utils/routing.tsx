export type RawQueryParams = { [key: string]: string | number | null | undefined };
export type RawParsedQuery = { [key: string]: string | undefined };

export type Serializer<T> = (query: T) => RawQueryParams;
export type Deserializer<T> = (raw: RawParsedQuery) => T;
export type Adapter<T> = {
  serializer: Serializer<T>;
  deserializer: Deserializer<T>;
};

export function makeUrl(
  route: string,
  params: RawQueryParams = {},
  query: RawQueryParams = {},
  hash?: string,
) {
  const match = route.match(/^\/?(.*?)\/?$/);
  if (match == null) {
    throw new Error(`Wrong route format: "${route}"`);
  }
  const [_, cleanRoute] = match;
  const result = cleanRoute
    .split('/')
    .map((part) => {
      if (part[0] === ':') {
        const name = part.substring(1);
        const value = params[name];
        if (value == null) {
          throw new Error(
            `Unable to build url: missing parameter "${name}" required in route "${route}"`,
          );
        }
        return encodeURIComponent(value);
      }
      return part;
    })
    .join('/');

  let queryString: string = Object.entries(query)
    .filter(([_, value]) => value != null && value != '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || '')}`)
    .join('&');
  queryString = queryString !== '' ? `?${queryString}` : queryString;
  queryString += hash ? `#${hash}` : '';

  return '/' + result + queryString;
}

export function parseQueryString(queryString: string): RawParsedQuery {
  if (queryString == '' || !queryString.startsWith('?')) {
    return {};
  }
  return queryString
    .substring(1)
    .split('&')
    .map((part) => part.split('='))
    .reduce(
      (acc, [key, value]) => ({ ...acc, [decodeURIComponent(key)]: decodeURIComponent(value) }),
      {},
    );
}

export function parseRoute(route: string): {
  pathname: string;
  queryParams: RawParsedQuery;
} {
  const index = route.indexOf('?');
  if (index !== -1) {
    const pathname = route.substring(0, index);
    const queryParams = parseQueryString(route.substring(index));
    return { pathname, queryParams };
  }
  return { pathname: route, queryParams: {} };
}

export const getCurrentDomain = () => {
  return window.location.origin;
};

export const getAlertUrl = (caseId: string, alertId: string, alertPageEnabled: boolean) => {
  if (alertPageEnabled) {
    return makeUrl(`/case-management/alerts/:alertId`, { alertId });
  }

  return makeUrl(
    `/case-management/case/:caseId/:tab`,
    { caseId, tab: 'alerts' },
    { expandedAlertId: alertId },
  );
};

export const getCaseUrl = (caseId: string, tab?: string) => {
  if (tab != null) {
    return makeUrl(`/case-management/case/:caseId/:tab`, { caseId, tab });
  }
  return makeUrl(`/case-management/case/:caseId`, { caseId });
};
