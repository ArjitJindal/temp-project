import React from 'react';
import s from './index.module.less';
import { P } from '@/components/ui/Typography';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function Section(props: Props) {
  const { children, title } = props;
  return (
    <div className={s.root}>
      <P bold>{title}</P>
      {children}
    </div>
  );
}
