import { PostHog, PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { identifyUser, internalPostHogClient, isAutoCaptureDisabled } from '../../../utils/postHog';
import { isFlagrightInternalUser, useAuth0User } from '@/utils/user-utils';
import { postHogClient } from '@/utils/postHog';

export const PostHogProviderWrapper = ({ children }) => {
  const auth0User = useAuth0User();

  useEffect(() => {
    const disableCapture = isAutoCaptureDisabled(auth0User);

    if (!auth0User || disableCapture) {
      if (isFlagrightInternalUser(auth0User) && process.env.ENV_NAME === 'sandbox') {
        internalPostHogClient.init(INTERNAL_POSTHOG_API_KEY, {
          api_host: POSTHOG_HOST,
          autocapture: false,
          capture_pageleave: false,
          capture_pageview: false,
        });

        identifyUser(internalPostHogClient, auth0User);
      }
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

    identifyUser(postHogClient, auth0User);
  }, [auth0User]);

  return <PostHogProvider client={postHogClient}>{children}</PostHogProvider>;
};
