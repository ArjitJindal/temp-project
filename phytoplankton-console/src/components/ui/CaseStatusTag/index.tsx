import React from 'react';
import { Tag } from 'antd';
import _ from 'lodash';
import { CaseStatus } from '@/apis';

interface Props {
  caseStatus: CaseStatus;
}

export default function CaseStatusTag(props: Props) {
  const { caseStatus } = props;

  return <Tag>{_.capitalize(caseStatus)}</Tag>;
}
