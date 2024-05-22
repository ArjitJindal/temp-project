import { PostHog } from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useAuth0User } from '@/utils/user-utils';

export const PostHogProviderWrapper = ({ children }) => {
  const postHogClient = new PostHog();
  const auth0User = useAuth0User();

  postHogClient.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
  });

  postHogClient.identify('User info', {
    name: auth0User.name,
    email: auth0User.verifiedEmail,
    auth0Id: auth0User.userId,
    role: auth0User.role,
    tenantId: auth0User.tenantId,
    tenantName: auth0User.tenantName,
    region: auth0User.region,
    tenantConsoleApiUrl: auth0User.tenantConsoleApiUrl,
    demoMode: auth0User.demoMode,
  });

  return <PostHogProvider client={postHogClient}>{children}</PostHogProvider>;
};
