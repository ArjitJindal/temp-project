import cn from 'clsx';
import { NavLink as ReactRouterNavLink } from 'react-router-dom';
import s from './index.module.less';
import SubMenu, { SubMenuItem } from './SubMenu';
import ChevronDownIcon from './chevron-down.react.svg';
import Popover from '@/components/ui/Popover';
import { getBranding } from '@/utils/branding';
import { preloadRoute } from '@/utils/routePreload';

interface Props {
  to?: string;
  icon: React.ReactNode;
  children: string;
  isExternal?: boolean;
  isCollapsed?: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
  submenu?: SubMenuItem[];
  disabledByFeature?: boolean;
  onClick?: () => void;
  isActiveHighlightingEnabled?: boolean;
  testName?: string;
}

export default function TopLevelLink(props: Props) {
  const {
    to,
    icon,
    children,
    submenu,
    isExternal,
    isCollapsed,
    isActive,
    isDisabled,
    disabledByFeature,
    onClick,
    isActiveHighlightingEnabled = false,
    testName,
  } = props;
  const branding = getBranding();
  const disabledMessage = disabledByFeature ? (
    <div>
      Please <a href={`mailto:${branding.supportEmail}`}>contact us</a> to access this feature.
    </div>
  ) : (
    <div>
      You do not have access to this module. Please contact your team manager to get access.
    </div>
  );
  const sharedProps = {
    'aria-disabled': isDisabled,
    title: isCollapsed ? children : undefined,
    className: cn(s.root, {
      [s.isDisabled]: isDisabled,
      [s.isActive]: isActive && !isActiveHighlightingEnabled,
      [s.isCollapsed]: isCollapsed,
    }),
  };

  const hasSubmenu = submenu != null && submenu.length > 0;

  const handleMouseEnter = () => {
    if (to && !isDisabled && !isExternal) {
      preloadRoute(to);
    }
  };

  const newChildren: React.ReactNode = (
    <>
      <div className={s.left} data-cy={testName}>
        <div className={s.icon}>{icon}</div>
        <div className={s.title}>{children}</div>
      </div>
      {hasSubmenu && <ChevronDownIcon className={s.chevron} />}
    </>
  );

  let resultEl: JSX.Element;

  if (isDisabled) {
    resultEl = (
      <Popover content={disabledMessage} placement="left">
        <li {...sharedProps}>{newChildren}</li>
      </Popover>
    );
  } else if (isExternal) {
    resultEl = (
      <a href={to} target="_blank" {...sharedProps}>
        {newChildren}
      </a>
    );
  } else if (to != null) {
    resultEl = (
      <ReactRouterNavLink
        {...sharedProps}
        onMouseEnter={handleMouseEnter}
        className={({ isActive }) =>
          cn(sharedProps.className, isActive && !isActiveHighlightingEnabled && s.isActive)
        }
        to={to}
      >
        {newChildren}
      </ReactRouterNavLink>
    );
  } else {
    resultEl = (
      <div {...sharedProps} onClick={onClick}>
        {newChildren}
      </div>
    );
  }

  if (!hasSubmenu) {
    return resultEl;
  }

  return (
    <Popover
      hideArrow
      disableInnerPadding
      hideBoxShadow
      hideBackground
      content={<SubMenu items={submenu} />}
      placement="rightTop"
    >
      <div>{resultEl}</div>
    </Popover>
  );
}
