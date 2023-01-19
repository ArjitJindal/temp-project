import React from 'react';
import { Link } from 'react-router-dom';
import cn from 'clsx';
import RightContent from './RightContent';
import s from './index.module.less';
import LogoSvg from '@/flagright-console-logo.svg';
import LogoSvg2 from '@/flagright-console-logo-2.svg';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';

export const HEADER_HEIGHT = 48;

interface Props {
  className?: string;
  children?: React.ReactNode;
}

export default function Header(props: Props) {
  const [isDemoModeRes] = useDemoMode();
  const isDemoMode = getOr(isDemoModeRes, false);
  return (
    <header className={props.className} style={{ height: HEADER_HEIGHT }}>
      <Link to={'/'}>
        <div className={cn(s.logo)}>
          <img className={cn(!isDemoMode && s.isVisible)} src={LogoSvg} alt="logo" height="28px" />
          <img className={cn(isDemoMode && s.isVisible)} src={LogoSvg2} alt="logo" height="28px" />
        </div>
      </Link>
      <RightContent />
    </header>
  );
}
