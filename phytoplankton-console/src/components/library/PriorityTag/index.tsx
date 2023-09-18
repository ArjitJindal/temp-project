import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { Priority } from '@/apis';

interface Props {
  priority: Priority;
}

export default function PriorityTag(props: Props) {
  const { priority } = props;
  return (
    <div className={cn(s.root)}>
      <div className={cn(s.body, s[`priority-${priority}`])}>{priority}</div>
    </div>
  );
}
