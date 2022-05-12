import React from 'react';
import AntConfigProvider from './AntConfigProvider';

interface Props {
  children: React.ReactNode;
}

export default function GlobalWrapper(props: Props) {
  return <AntConfigProvider>{props.children}</AntConfigProvider>;
}
