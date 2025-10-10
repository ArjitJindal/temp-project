import React from 'react';
import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import { SanctionsHitStatus as ApiSanctionsHitStatus } from '@/apis';
import Tag from '@/components/library/Tag';

interface Props {
  status: ApiSanctionsHitStatus | undefined;
}

export default function SanctionsHitStatusTag(props: Props) {
  const { status } = props;
  if (!status) {
    return <>-</>;
  }
  return <Tag className={cn(s.root, s[`status-${status}`])}>{humanizeConstant(status)}</Tag>;
}
