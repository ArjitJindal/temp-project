import React from 'react';
import { Link as ReactRouterLink, LinkProps } from 'react-router-dom';
import { preloadRoute } from '@/utils/routePreload';

type Props = LinkProps;

const Link = React.forwardRef<HTMLAnchorElement, Props>((props, ref) => {
  const { children, to, onMouseEnter, target, rel, reloadDocument, replace, state, ...rest } =
    props;

  const handleInternalMouseEnter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (typeof to === 'string' && to.startsWith('/')) {
      preloadRoute(to);
    }
  };

  const isExternalString = typeof to === 'string' && !to.startsWith('/');

  if (isExternalString) {
    const externalTarget = target ?? '_blank';
    const externalRel =
      rel ??
      (externalTarget != null && externalTarget.toLowerCase() === '_blank'
        ? 'noopener noreferrer'
        : undefined);

    return (
      <a
        {...rest}
        ref={ref}
        href={to}
        target={externalTarget}
        rel={externalRel}
        onMouseEnter={onMouseEnter}
      >
        {children}
      </a>
    );
  }

  return (
    <ReactRouterLink
      {...rest}
      to={to}
      reloadDocument={reloadDocument}
      replace={replace}
      state={state}
      target={target}
      rel={rel}
      onMouseEnter={handleInternalMouseEnter}
      ref={ref}
    >
      {children}
    </ReactRouterLink>
  );
});

Link.displayName = 'Link';

export default Link;
