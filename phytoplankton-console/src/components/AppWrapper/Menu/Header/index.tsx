import cn from 'clsx';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import CollapseButton from './chevrons-left.react.svg';
import LogoNoText from './logo-no-text.react.svg';
import s from './index.module.less';
import { getBranding, isWhiteLabeled } from '@/utils/branding';

const branding = getBranding();

interface Props {
  isCollapsed: boolean;
  onChangeCollapsed: (isCollapsed: boolean) => void;
}

export default function Header(props: Props) {
  const { isCollapsed, onChangeCollapsed } = props;
  const handleClick = useCallback(() => {
    onChangeCollapsed(!isCollapsed);
  }, [isCollapsed, onChangeCollapsed]);
  return (
    <div className={cn(s.root, isCollapsed && s.isCollapsed)}>
      <div className={cn(s.top)}>
        <div className={s.logoWrapper}>
          <Link to="/">
            <img className={s.logo} src={branding.logoLight} alt="logo" />
          </Link>
        </div>
        <CollapseButton className={s.collapseButton} onClick={handleClick} />
      </div>
      <div className={cn(s.bottom)}>
        {!isWhiteLabeled() && (
          <Link to="/">
            <LogoNoText className={s.logoNoText} />
          </Link>
        )}
      </div>
    </div>
  );
}
