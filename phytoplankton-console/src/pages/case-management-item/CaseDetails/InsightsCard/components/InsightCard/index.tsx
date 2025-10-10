import React from 'react';
import cn from 'clsx';
import s from './styles.module.less';
import { P } from '@/components/ui/Typography';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function InsightCard(props: Props) {
  const { title, children } = props;
  return (
    <div className={cn(s.root)}>
      <P variant="xl" fontWeight="normal" className={s.title}>
        {title}
      </P>
      {children}
    </div>
  );
}
