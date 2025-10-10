import React from 'react';
import s from './index.module.less';
import NodeBase, {
  NodeBaseProps,
} from '@/components/WorkflowBuilder/NodeCanvas/components/NodeBase';
import { CaseStatus, DerivedStatus } from '@/apis';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';

interface Props
  extends NodeBaseProps<{
    order: number;
    status: string;
  }> {}

export default function StatusNode(props: Props) {
  return (
    <NodeBase
      id={props.id}
      handles={[
        { position: 'BOTTOM', type: 'SOURCE' },
        { position: 'TOP', type: 'TARGET' },
        { position: 'RIGHT', type: 'TARGET' },
        { position: 'LEFT', type: 'TARGET' },
      ]}
    >
      <div className={s.root}>
        Alert status <CaseStatusTag caseStatus={props.data.status as CaseStatus | DerivedStatus} />
      </div>
    </NodeBase>
  );
}
