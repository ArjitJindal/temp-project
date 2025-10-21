import React, { useCallback, useEffect, createContext, useContext } from 'react';
import { useIdleTimer } from 'react-idle-timer';
import { useAuth0 } from '@auth0/auth0-react';
import { useSettings } from './SettingsProvider';

interface SessionTimeoutContextType {
  reset: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | undefined>(undefined);

export const useSessionTimeout = () => {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  }
  return context;
};

export const SessionTimeoutProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}): JSX.Element => {
  const settings = useSettings();
  const { logout } = useAuth0();

  const handleOnIdle = useCallback(() => {
    logout({
      returnTo: window.location.origin,
    });
  }, [logout]);

  const disabled = !settings.sessionTimeoutMinutes || settings.sessionTimeoutMinutes <= 0;
  const timeoutMinutes = Math.max(1, settings.sessionTimeoutMinutes ?? 60); // Ensure positive value
  const { reset } = useIdleTimer({
    timeout: disabled ? undefined : timeoutMinutes * 60 * 1000,
    onIdle: handleOnIdle,
    debounce: 500,
    crossTab: true,
    disabled,
  });

  useEffect(() => {
    // Reset the timer when the timeout setting changes
    reset();
  }, [settings.sessionTimeoutMinutes, reset]);

  return (
    <SessionTimeoutContext.Provider value={{ reset }}>{children}</SessionTimeoutContext.Provider>
  );
};

export default SessionTimeoutProvider;
