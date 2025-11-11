import React from 'react';
import { NodeComponentProps } from '@/components/ApprovalWorkflowBuilder/NodeCanvas/node_canvas';
import NodeBase from '@/components/ApprovalWorkflowBuilder/NodeCanvas/components/NodeBase';
import Tag from '@/components/library/Tag';

export type Data = {
  type: 'START' | 'END';
};

type Props = NodeComponentProps<string, Data>;

export default function TerminalNodeComponent(props: Props) {
  const { data } = props;
  return (
    <NodeBase
      {...props}
      handles={
        data.type === 'START'
          ? [
              {
                position: 'BOTTOM',
                type: 'SOURCE',
              },
            ]
          : [
              {
                position: 'TOP',
                type: 'TARGET',
              },
            ]
      }
    >
      <Tag color={'orange'}>{data.type === 'START' ? 'Start' : 'End'}</Tag>
    </NodeBase>
  );
}
