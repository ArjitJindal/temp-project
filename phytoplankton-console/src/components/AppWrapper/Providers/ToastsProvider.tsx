import React from 'react';
import { resolveValue, Toaster } from 'react-hot-toast';

export default function ToastsProvider(props: { children: React.ReactNode }) {
  return (
    <>
      <Toaster
        position={'bottom-right'}
        toastOptions={{
          removeDelay: 300,
        }}
        containerStyle={{
          top: 80,
          bottom: 40,
          right: 40,
        }}
      >
        {(t) => <>{resolveValue(t.message, t)}</>}
      </Toaster>
      {props.children}
    </>
  );
}
