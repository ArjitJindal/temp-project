import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';
import type { ConfigurationParameters, FetchParams, Middleware, ResponseContext } from './apis';
import { Configuration, DefaultApi as FlagrightApi } from './apis';

class AuthorizationMiddleware implements Middleware {
  getAccessToken: () => Promise<string>;

  constructor(getAccessToken: () => Promise<string>) {
    this.getAccessToken = getAccessToken;
  }

  public async pre(context: ResponseContext): Promise<FetchParams | void> {
    const accessToken = await this.getAccessToken();
    return {
      url: context.url,
      init: {
        ...context.init,
        headers: new Headers({
          ...context.init.headers,
          Authorization: `Bearer ${accessToken}`,
        }),
      },
    };
  }
}

export function useApi(): FlagrightApi {
  const { getAccessTokenWithPopup } = useAuth0();
  const api = useMemo(() => {
    const configParams: ConfigurationParameters = {
      basePath: API_BASE_PATH,
      middleware: [
        /*new AuthorizationMiddleware(() =>
          getAccessTokenWithPopup({
            audience: AUTH0_AUDIENCE,
          }),
        ),*/
      ],
    };
    const apiConfig = new Configuration(configParams);
    return new FlagrightApi(apiConfig);
  }, [getAccessTokenWithPopup]);
  return api;
}
