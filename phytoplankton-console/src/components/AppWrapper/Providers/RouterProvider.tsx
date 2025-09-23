import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import RoutePerfProvider from '@/perf/RoutePerfProvider';

interface Props {
  children: React.ReactNode;
}

export default function RouterProvider(props: Props) {
  return (
    <BrowserRouter>
      <RoutePerfProvider>{props.children}</RoutePerfProvider>
    </BrowserRouter>
  );
}
