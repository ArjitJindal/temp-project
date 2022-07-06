import React from 'react';
import { Link } from 'react-router-dom';
import RightContent from './RightContent';
import LogoSvg from '@/flagright-console-logo.svg';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

export default function Header(props: Props) {
  return (
    <header className={props.className}>
      <Link to={'/'}>
        <img src={LogoSvg} alt="logo" height="28px" />
      </Link>
      <RightContent />
    </header>
  );
}
