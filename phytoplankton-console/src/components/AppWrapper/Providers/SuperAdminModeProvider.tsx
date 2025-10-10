import React, { useState } from 'react';

export const SuperAdminModeContext = React.createContext<{
  isSuperAdminMode: boolean;
  setIsSuperAdminMode: (value: boolean) => void;
} | null>(null);

export function SuperAdminModeProvider(props: { children: React.ReactNode }) {
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  return (
    <SuperAdminModeContext.Provider value={{ isSuperAdminMode, setIsSuperAdminMode }}>
      {props.children}
    </SuperAdminModeContext.Provider>
  );
}
