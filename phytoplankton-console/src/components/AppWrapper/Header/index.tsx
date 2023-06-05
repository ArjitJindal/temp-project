import React from 'react';
import { Link } from 'react-router-dom';
import cn from 'clsx';
import RightContent from './RightContent';
import s from './index.module.less';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';
import { getBranding } from '@/utils/branding';

export const HEADER_HEIGHT = 48;

interface Props {
  className?: string;
  children?: React.ReactNode;
}

const branding = getBranding();

export default function Header(props: Props) {
  const [isDemoModeRes] = useDemoMode();
  const isDemoMode = getOr(isDemoModeRes, false);
  return (
    <header className={props.className} style={{ height: HEADER_HEIGHT }}>
      <Link to={'/'}>
        <div className={cn(s.logo)}>
          <img className={cn(!isDemoMode && s.isVisible)} src={branding.logoUrl} alt="logo" />
          <img
            className={cn(isDemoMode && s.isVisible)}
            src={branding.demoModeLogoUrl ?? branding.logoUrl}
            alt="logo"
          />
        </div>
      </Link>
      <RightContent />
    </header>
  );
}
