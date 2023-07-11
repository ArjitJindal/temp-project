import cn from 'clsx';
import { NavLink as ReactRouterNavLink } from 'react-router-dom';
import { Popover } from 'antd';
import s from './index.module.less';
import SubMenu, { SubMenuItem } from './SubMenu';
import ChevronDownIcon from './chevron-down.react.svg';

interface Props {
  to: string;
  icon: React.ReactNode;
  children: string;
  isExternal?: boolean;
  isCollapsed?: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
  submenu?: SubMenuItem[];
}

export default function TopLevelLink(props: Props) {
  const { to, icon, children, submenu, isExternal, isCollapsed, isActive, isDisabled } = props;

  const sharedProps = {
    'aria-disabled': isDisabled,
    title: isCollapsed ? children : undefined,
    className: cn(s.root, {
      [s.isDisabled]: isDisabled,
      [s.isActive]: isActive,
      [s.isCollapsed]: isCollapsed,
    }),
  };

  const hasSubmenu = submenu != null && submenu.length > 0;

  const newChildren: React.ReactNode = (
    <>
      <div className={s.left}>
        <div className={s.icon}>{icon}</div>
        <div className={s.title}>{children}</div>
      </div>
      {hasSubmenu && <ChevronDownIcon className={s.chevron} />}
    </>
  );

  let resultEl: JSX.Element;

  if (isDisabled) {
    resultEl = <li {...sharedProps}>{newChildren}</li>;
  } else if (isExternal) {
    resultEl = (
      <a href={to} target="_blank" {...sharedProps}>
        {newChildren}
      </a>
    );
  } else {
    resultEl = (
      <ReactRouterNavLink
        {...sharedProps}
        className={({ isActive }) => cn(sharedProps.className, isActive && s.isActive)}
        to={to}
      >
        {newChildren}
      </ReactRouterNavLink>
    );
  }

  if (!hasSubmenu) {
    return resultEl;
  }

  return (
    <Popover
      overlayClassName={s.popover}
      content={<SubMenu items={submenu} />}
      placement="rightTop"
    >
      <div>{resultEl}</div>
    </Popover>
  );
}
