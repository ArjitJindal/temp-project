import React from 'react';
import { Link } from 'react-router-dom';
import RightContent from './RightContent';
import LogoSvg from '@/flagright-console-logo.svg';

export const HEADER_HEIGHT = 48;

interface Props {
  className?: string;
  children?: React.ReactNode;
}

export default function Header(props: Props) {
  return (
    <header className={props.className} style={{ height: HEADER_HEIGHT }}>
      <Link to={'/'}>
        <img src={LogoSvg} alt="logo" height="28px" />
      </Link>
      <RightContent />
    </header>
  );
}
