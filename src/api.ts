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
import { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';

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
export function useSecurityAuthentication(): SecurityAuthentication {
  const { accessToken } = useAuth();
  return useMemo(() => {
    return new AuthorizationAuthentication({
      getToken: async () => {
        if (accessToken == null) {
          throw new Error(`accessToken should not be null at this point`);
        }
        return accessToken;
      },
    });
  }, [accessToken]);
}

export function useApi(): FlagrightApi {
  const auth = useSecurityAuthentication();
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
