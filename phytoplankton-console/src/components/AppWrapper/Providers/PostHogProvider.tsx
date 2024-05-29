import { PostHog, PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { isAutoCaptureDisabled } from '../../../utils/postHog';
import { useAuth0User } from '@/utils/user-utils';
import { postHogClient } from '@/utils/postHog';

export const PostHogProviderWrapper = ({ children }) => {
  const auth0User = useAuth0User();

  useEffect(() => {
    const disableCapture = isAutoCaptureDisabled(auth0User);

    if (!auth0User || disableCapture) {
      return;
    }

    postHogClient.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: {
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
  }, [auth0User]);

  return <PostHogProvider client={postHogClient}>{children}</PostHogProvider>;
};
