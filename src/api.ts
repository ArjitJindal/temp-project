import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';
import {
  AuthorizationAuthentication,
  Configuration,
  IsomorphicFetchHttpLibrary,
  Middleware,
  RequestContext,
  ResponseContext,
  SecurityAuthentication,
  ServerConfiguration,
} from './apis';
import { PromiseMiddlewareWrapper } from './apis/middleware';
import { ObjectDefaultApi as FlagrightApi } from './apis/types/ObjectParamAPI';

class AuthorizationMiddleware implements Middleware {
  auth: SecurityAuthentication;

  constructor(auth: SecurityAuthentication) {
    this.auth = auth;
  }

  public async pre(context: RequestContext): Promise<RequestContext> {
    await this.auth.applySecurityAuthentication(context);
    return context;
  }

  public async post(context: ResponseContext): Promise<ResponseContext> {
    return context;
  }
}

export function useApi(): FlagrightApi {
  const { getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  const api = useMemo(() => {
    const auth = new AuthorizationAuthentication({
      getToken: async () => {
        try {
          return await getAccessTokenSilently({
            scope: 'openid profile email write:tenant',
            audience: `${AUTH0_AUDIENCE}`,
          });
        } catch (e) {
          return await getAccessTokenWithPopup({
            scope: 'openid profile email write:tenant',
            audience: `${AUTH0_AUDIENCE}`,
          });
        }
      },
    });
    const apiConfig: Configuration = {
      baseServer: new ServerConfiguration(API_BASE_PATH, {}),
      httpApi: new IsomorphicFetchHttpLibrary(),
      middleware: [new PromiseMiddlewareWrapper(new AuthorizationMiddleware(auth))],
      authMethods: { Authorization: auth },
    };
    return new FlagrightApi(apiConfig);
  }, [getAccessTokenSilently, getAccessTokenWithPopup]);
  return api;
}
