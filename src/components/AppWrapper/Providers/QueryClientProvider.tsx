import React from 'react';
import {
  QueryClient,
  QueryClientProvider as ReactQueryQueryClientProvider,
} from '@tanstack/react-query';

interface Props {
  children: React.ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20000,
      networkMode: 'always',
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      retry: false,
    },
    mutations: {
      networkMode: 'always',
    },
  },
});

export default function QueryClientProvider(props: Props) {
  return (
    <ReactQueryQueryClientProvider client={queryClient}>
      {props.children}
    </ReactQueryQueryClientProvider>
  );
}
