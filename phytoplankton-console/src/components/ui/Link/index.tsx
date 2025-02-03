import React from 'react';
import { Link as ReactRouterLink, LinkProps } from 'react-router-dom';

type Props = Omit<LinkProps, 'to'> &
  React.RefAttributes<HTMLAnchorElement> & {
    to: string;
  };

export default function Link(props: Props) {
  const { children, to, ...rest } = props;
  if (!to.startsWith('/')) {
    return (
      <a href={to} target={'_blank'} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <ReactRouterLink to={to} {...rest}>
      {children}
    </ReactRouterLink>
  );
}
