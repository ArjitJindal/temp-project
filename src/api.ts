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
import { useAuth0User } from '@/utils/user-utils';

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
export function useAuth(): SecurityAuthentication {
  const user = useAuth0User();
  const { getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  return useMemo(() => {
    const audience = AUTH0_AUDIENCE ?? user.tenantApiAudience;
    return new AuthorizationAuthentication({
      getToken: async () => {
        try {
          return await getAccessTokenSilently({
            scope: 'openid profile email write:tenant',
            audience,
          });
        } catch (e) {
          return await getAccessTokenWithPopup({
            scope: 'openid profile email write:tenant',
            audience,
          });
        }
      },
    });
  }, [user, getAccessTokenSilently, getAccessTokenWithPopup]);
}

export function useApi(): FlagrightApi {
  const auth = useAuth();
  const user = useAuth0User();
  const api = useMemo(() => {
    const apiUrl = API_BASE_PATH ?? user.tenantConsoleApiUrl;
    const apiConfig: Configuration = {
      baseServer: new ServerConfiguration(apiUrl, {}),
      httpApi: new IsomorphicFetchHttpLibrary(),
      middleware: [new PromiseMiddlewareWrapper(new AuthorizationMiddleware(auth))],
      authMethods: { Authorization: auth },
    };
    return new FlagrightApi(apiConfig);
  }, [user, auth]);
  return api;
}
