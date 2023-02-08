import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';

export default function LogoutPage() {
  const navigate = useNavigate();
  const { accessToken, logout } = useAuth();

  useEffect(() => {
    if (accessToken != null) {
      logout();
    } else {
      navigate('/login');
    }
  }, [accessToken, logout, navigate]);

  return <h3>You should be redirected to login page soon</h3>;
}
