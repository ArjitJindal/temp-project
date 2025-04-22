import React from 'react';
import { Position, Handle } from '@xyflow/react';
import { NodeBaseProps } from '../../components/NodeBase';
import s from './index.module.less';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';

interface Props extends NodeBaseProps<{ text?: string }> {}

export default function NewBranchButtonNode(props: Props) {
  const { data } = props;
  return (
    <button className={s.root}>
      <Handle type={'target'} position={Position.Top} className={s.handle} />
      <div className={s.icon}>
        <AddLineIcon />
      </div>
      {data?.text}
    </button>
  );
}
