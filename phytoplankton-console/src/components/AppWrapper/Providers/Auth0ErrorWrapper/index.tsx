import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { AccountMessage } from '@/components/AccountMessage';

export const Auth0ErrorWrapper = ({ children }: { children: JSX.Element }) => {
  const { error } = useAuth0();

  const errorMessage = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('error_description');
  }, []);

  return error && errorMessage ? (
    <AccountMessage
      title={humanizeConstant(errorMessage)}
      message={
        errorMessage.includes('PASSWORD_EXPIRED')
          ? 'Your password has expired. Please reset your password using the link in the email we sent you.'
          : 'Please contact a system administrator to unlock your account.'
      }
    />
  ) : (
    children
  );
};
