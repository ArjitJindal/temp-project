export function makeUrl(
  route: string,
  params: { [key: string]: string | number | null | undefined } = {},
  query: { [key: string]: string | number | null | undefined } = {},
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

  return '/' + result + queryString;
}
