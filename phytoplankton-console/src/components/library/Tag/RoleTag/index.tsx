import React from 'react';
import cn from 'clsx';
import Tag from '../index';
import s from './index.module.less';
import { humanizeAuto } from '@/utils/humanize';

interface Props {
  role: string;
}

export function getRoleTitle(role: string) {
  return humanizeAuto(role);
}

export default function RoleTag(props: Props): JSX.Element {
  const { role } = props;
  return <Tag className={cn(s.root, s[`role-${role}`])}>{getRoleTitle(role)}</Tag>;
}
