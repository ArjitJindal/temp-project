import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeBaseProps } from '../../components/NodeBase';
import s from './index.module.less';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';
import { useNodeContext } from '@/components/WorkflowBuilder/NodeCanvas/nodeContext';
import { NodeDescription } from '@/components/WorkflowBuilder/NodeCanvas/types';

interface Props
  extends NodeBaseProps<{
    text?: string;
    fromStatus: string;
  }> {}

export default function NewBranchButtonNode(props: Props) {
  const { data } = props;
  const nodeContextValue = useNodeContext();
  return (
    <button
      className={s.root}
      onClick={() => {
        nodeContextValue.onClickNode<'NEW_BRANCH_BUTTON'>?.(
          props as NodeDescription<'NEW_BRANCH_BUTTON'>,
        );
      }}
    >
      <Handle type={'target'} position={Position.Top} className={s.handle} />
      <div className={s.icon}>
        <AddLineIcon />
      </div>
      {data?.text}
    </button>
  );
}
