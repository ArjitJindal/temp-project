import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  },
});

export default function (props: Props) {
  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}
