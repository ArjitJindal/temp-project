import React from 'react';
import RightContent from './RightContent';
import LogoSvg from '@/flagright-console-logo.svg';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

export default function Header(props: Props) {
  return (
    <header className={props.className}>
      <img src={LogoSvg} alt="logo" height="28px" />
      <RightContent />
    </header>
  );
}
