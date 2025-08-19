import { useLocation, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '@/api';

export default function ActiveSessionProvider(props: { children: React.ReactNode }) {
  const api = useApi();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const navigate = useNavigate();
  const isPostLogin =
    location.pathname.includes('post-login') &&
    // NOTE: We only want to refresh active sessions right after Auth0 login.
    // Navigating to /post-login manually should be noop
    searchParams.get('code') &&
    searchParams.get('state');
  useEffect(() => {
    if (isPostLogin) {
      navigate('/');
      api.getPostLogin();
    }
  }, [navigate, api, isPostLogin]);

  return props.children;
}
