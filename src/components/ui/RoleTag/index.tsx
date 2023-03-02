import { Tag } from 'antd';
import React from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import COLORS, { ColorSet } from '@/components/ui/colors';

interface Props {
  role: string;
}

function getColor(role: string): ColorSet {
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
    default:
      return COLORS.brandBlue;
  }
}

export default function RoleTag(props: Props): JSX.Element {
  const { role } = props;
  const color = getColor(role);
  return (
    <Tag style={{ background: color.tint, borderColor: color.base, color: color.base }}>
      {sentenceCase(role)}
    </Tag>
  );
}
