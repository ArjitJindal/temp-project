import React from 'react';
import NodeBase, { NodeBaseProps } from '../../components/NodeBase';
import s from './index.module.less';
import { CaseStatus, DerivedStatus } from '@/apis';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';

interface Props extends NodeBaseProps<{ status: CaseStatus | DerivedStatus }> {}

export default function StatusNode(props: Props) {
  return (
    <NodeBase
      handles={[
        { position: 'BOTTOM', type: 'SOURCE' },
        { position: 'TOP', type: 'TARGET' },
      ]}
    >
      <div className={s.root}>
        Alert status <CaseStatusTag caseStatus={props.data.status} />
      </div>
    </NodeBase>
  );
}
