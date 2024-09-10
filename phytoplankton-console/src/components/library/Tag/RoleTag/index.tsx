import React from 'react';
import cn from 'clsx';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import Tag from '../index';
import s from './index.module.less';

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
