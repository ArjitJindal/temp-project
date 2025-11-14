import React from 'react';
import { Link as ReactRouterLink, LinkProps } from 'react-router-dom';
import { preloadRoute } from '@/utils/routePreload';

type Props = Omit<LinkProps, 'to'> &
  React.RefAttributes<HTMLAnchorElement> & {
    to: string;
  };

export default function Link(props: Props) {
  const { children, to, ...rest } = props;

  const handleMouseEnter = () => {
    if (to.startsWith('/')) {
      preloadRoute(to);
    }
  };

  if (!to.startsWith('/')) {
    return (
      <a href={to} target={'_blank'} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <ReactRouterLink to={to} onMouseEnter={handleMouseEnter} {...rest}>
      {children}
    </ReactRouterLink>
  );
}
