import React from 'react';
import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
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
