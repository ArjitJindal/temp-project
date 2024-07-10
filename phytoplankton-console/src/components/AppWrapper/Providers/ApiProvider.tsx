import React, { useContext, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { message } from '@/components/library/Message';
import { ObjectDefaultApi as FlagrightApi } from '@/apis/types/ObjectParamAPI';
import { useAuth0User } from '@/utils/user-utils';
import {
  Configuration,
  IsomorphicFetchHttpLibrary,
  Middleware,
  RequestContext,
  ResponseContext,
  SecurityAuthentication,
  ServerConfiguration,
  AuthorizationAuthentication,
} from '@/apis';
import { PromiseMiddlewareWrapper } from '@/apis/middleware';

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

interface ContextValue {
  api: FlagrightApi;
}

export const ApiContext = React.createContext<ContextValue | null>(null);

interface Props {
  children: React.ReactNode;
}

export default function ApiProvider(props: Props) {
  const auth = useAuth();
  const user = useAuth0User();
  const api = useMemo(() => {
    const apiUrl = API_BASE_PATH || user.tenantConsoleApiUrl || '';
    const apiConfig: Configuration = {
      baseServer: new ServerConfiguration(apiUrl, {}),
      httpApi: new IsomorphicFetchHttpLibrary(),
      middleware: [new PromiseMiddlewareWrapper(new AuthorizationMiddleware(auth))],
      authMethods: { Authorization: auth },
    };
    return new FlagrightApi(apiConfig);
  }, [user, auth]);

  return (
    <ApiContext.Provider
      value={{
        api,
      }}
    >
      {props.children}
    </ApiContext.Provider>
  );
}

export function useAuth(): SecurityAuthentication {
  const { getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  return useMemo(() => {
    const audience = AUTH0_AUDIENCE;
    return new AuthorizationAuthentication({
      getToken: async () => {
        let token;
        try {
          token = await getAccessTokenSilently({
            scope: 'openid profile email',
            audience,
          });
        } catch (silentAuthError) {
          try {
            token = await getAccessTokenWithPopup({
              scope: 'openid profile email',
              audience,
            });
          } catch (popupAuthError) {
            message.error('Failed to authenticate user');
          }
        }
        return token;
      },
    });
  }, [getAccessTokenSilently, getAccessTokenWithPopup]);
}

export function useApiFromContext(): FlagrightApi {
  const context = useContext(ApiContext);
  if (context == null) {
    throw new Error(`ApiContext is not initialized`);
  }
  return context.api;
}
