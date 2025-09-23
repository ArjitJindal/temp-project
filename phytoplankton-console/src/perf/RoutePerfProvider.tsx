import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { routeStarted } from './sentryPerf';

interface Props {
  children: React.ReactNode;
}

function normalizePathname(pathname: string): string {
  // Replace path segments that look like IDs with :id to reduce cardinality
  return (
    pathname
      .split('/')
      .map((seg) => (seg && /[0-9a-f-]{6,}|\d{3,}/i.test(seg) ? ':id' : seg))
      .join('/') || '/'
  );
}

export default function RoutePerfProvider(props: Props) {
  const { pathname } = useLocation();
  useEffect(() => {
    routeStarted(normalizePathname(pathname));
  }, [pathname]);
  return <>{props.children}</>;
}
