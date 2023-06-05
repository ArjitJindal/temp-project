import React, { useState } from 'react';

type ExpandMode = 'EXPAND_ALL' | 'COLLAPSE_ALL' | 'MANUAL';

interface ContextValue {
  expandMode: ExpandMode;
  setExpandMode: (mode: ExpandMode) => void;
}

export const ExpandableContext = React.createContext<ContextValue>({
  expandMode: 'MANUAL',
  setExpandMode: () => null,
});

export function ExpandableProvider(props: { children: React.ReactNode }) {
  const [expandMode, setExpandMode] = useState<ExpandMode>('MANUAL');
  return (
    <ExpandableContext.Provider value={{ expandMode, setExpandMode }}>
      {props.children}
    </ExpandableContext.Provider>
  );
}
