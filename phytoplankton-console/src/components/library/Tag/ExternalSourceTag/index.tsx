import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Tag from '@/components/library/Tag';

export default function ExternalSourceTag(): JSX.Element {
  return (
    <Tag className={cn(s.root, s['source-EXTERNAL'])}>
      <div>External</div>
    </Tag>
  );
}
