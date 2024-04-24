import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import { humanizeConstant } from '@/utils/humanize';
import { CaseType } from '@/apis';

interface Props {
  method: CaseType;
}

export default function CaseGenerationMethodTag(props: Props) {
  const { method } = props;

  return (
    <div className={cn(s.root)}>
      <div className={cn(s.body)}>{humanizeConstant(method)}</div>
    </div>
  );
}
