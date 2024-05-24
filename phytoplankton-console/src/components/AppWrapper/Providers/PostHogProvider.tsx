import { PostHog, PostHogProvider } from 'posthog-js/react';
import { isAutoCaptureDisabled } from '../../../utils/postHog';
import { isFlagrightInternalUser, useAuth0User } from '@/utils/user-utils';
import { postHogClient } from '@/utils/postHog';

export const PostHogProviderWrapper = ({ children }) => {
  const auth0User = useAuth0User();

  const disableCapture =
    isFlagrightInternalUser(auth0User) || auth0User.tenantName.includes('Cypress');

  postHogClient.init(disableCapture ? '' : POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: isAutoCaptureDisabled(auth0User)
      ? false
      : {
          capture_copied_text: false,
          element_allowlist: ['button'],
          dom_event_allowlist: ['click', 'submit'],
        },
    capture_pageleave: false,
    loaded: (ph: PostHog) => {
      if (disableCapture) {
        ph.opt_out_capturing();
      }
    },
  });

  postHogClient.identify(
    auth0User.userId,
    {
      name: auth0User.name,
      email: auth0User.verifiedEmail,
      auth0Id: auth0User.userId,
      role: auth0User.role,
      tenantId: auth0User.tenantId,
      tenantName: auth0User.tenantName,
      region: auth0User.region,
      tenantConsoleApiUrl: auth0User.tenantConsoleApiUrl,
      demoMode: auth0User.demoMode,
    },
    {
      // One time properties (useful for tracking user properties that change over time)
      $role: auth0User.role,
      $demoMode: auth0User.demoMode,
    },
  );

  postHogClient.featureFlags;

  return <PostHogProvider client={postHogClient}>{children}</PostHogProvider>;
};
