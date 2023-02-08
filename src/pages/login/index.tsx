import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';

export default function LoginPage() {
  const navigate = useNavigate();
  const { accessToken, login } = useAuth();

  useEffect(() => {
    if (accessToken != null) {
      navigate('/');
    } else {
      login();
    }
  }, [accessToken, navigate, login]);

  return <></>;
}
