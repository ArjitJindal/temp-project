import React from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { HandlePosition, HandleType } from '../../types';
import Handle from '../Handle';
import s from './index.module.less';

type HandleDescription = {
  position: HandlePosition;
  type: HandleType;
};

export interface NodeBaseProps<Data extends Record<string, unknown> = Record<string, unknown>>
  extends NodeProps<Node<Data>> {
  handles?: HandleDescription[];
  children: React.ReactNode;
}

type Props = Pick<NodeBaseProps, 'id' | 'handles' | 'children'>;

export default function NodeBase(props: Props) {
  const { id, handles = [], children } = props;
  return (
    <div className={s.root}>
      {handles.map(({ type, position }) => (
        <Handle key={`${type}-${position}`} nodeId={id} type={type} position={position} />
      ))}
      {children}
    </div>
  );
}
