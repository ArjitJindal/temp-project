import React from 'react';
import cn from 'clsx';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Tag from '../index';
import s from './index.module.less';

interface Props {
  type?: 'BUSINESS' | 'CONSUMER';
  children?: string;
}

export default function UserTypeTag(props: Props) {
  const { type = 'BUSINESS', children = humanizeConstant(type) } = props;

  return <Tag className={cn(s.root, s[`type-${type}`])}>{children}</Tag>;
}
