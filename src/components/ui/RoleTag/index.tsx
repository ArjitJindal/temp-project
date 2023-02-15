import { Tag } from 'antd';
import React from 'react';
import { AccountRoleName } from '@/apis';
import COLORS, { ColorSet } from '@/components/ui/colors';
import { neverReturn } from '@/utils/lang';

interface Props {
  role: AccountRoleName;
}

function getColor(role: AccountRoleName): ColorSet {
  switch (role) {
    case 'root':
      return COLORS.red;
    case 'admin':
      return COLORS.orange;
    case 'user':
    case 'analyst':
    case 'approver':
    case 'auditor':
    case 'developer':
      return COLORS.leafGreen;
  }
  return neverReturn(role, COLORS.brandBlue);
}

export default function RoleTag(props: Props): JSX.Element {
  const { role } = props;
  const color = getColor(role);
  return (
    <Tag style={{ background: color.tint, borderColor: color.base, color: color.base }}>{role}</Tag>
  );
}
