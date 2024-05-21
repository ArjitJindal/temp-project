import { PostHogProvider } from 'posthog-js/react';

export const PostHogProviderWrapper = ({ children }) => {
  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY}
      options={{
        api_host: POSTHOG_HOST,
      }}
    >
      {children}
    </PostHogProvider>
  );
};
