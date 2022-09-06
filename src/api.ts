import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';
import jwt_decode from 'jwt-decode';
import { useLocalStorageState } from 'ahooks';
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
  const userIdentityKey = JSON.stringify(user);
  const [jwt, setJwt] = useLocalStorageState<{ [key: string]: string }>('jwt', {});
  const { getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  return useMemo(() => {
    const audience = AUTH0_AUDIENCE ?? user.tenantApiAudience;
    return new AuthorizationAuthentication({
      getToken: async () => {
        const cachedJwt = jwt[userIdentityKey];
        if (cachedJwt) {
          const decodedJwt = jwt_decode<{ exp: number }>(cachedJwt);
          if (decodedJwt.exp > Date.now() / 1000) {
            return cachedJwt;
          }
        }
        let token;
        try {
          token = await getAccessTokenSilently({
            scope: 'openid profile email',
            audience,
          });
        } catch (e) {
          token = await getAccessTokenWithPopup({
            scope: 'openid profile email',
            audience,
          });
        }
        setJwt({
          [userIdentityKey]: token,
        });
        return token;
      },
    });
  }, [
    user.tenantApiAudience,
    jwt,
    userIdentityKey,
    setJwt,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
  ]);
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
