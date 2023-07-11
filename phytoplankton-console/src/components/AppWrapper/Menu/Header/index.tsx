import cn from 'clsx';
import React, { useCallback } from 'react';
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
          <img className={s.logo} src={branding.logoUrl} alt="logo" />
        </div>
        <CollapseButton className={s.collapseButton} onClick={handleClick} />
      </div>
      <div className={cn(s.bottom)}>
        {!isWhiteLabeled() && <LogoNoText className={s.logoNoText} />}
      </div>
    </div>
  );
}
