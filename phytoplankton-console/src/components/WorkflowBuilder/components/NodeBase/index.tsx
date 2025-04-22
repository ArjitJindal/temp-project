import React from 'react';
import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import s from './index.module.less';

type HandleDescription = {
  position: 'TOP' | 'BOTTOM';
  type: 'TARGET' | 'SOURCE';
};

export interface NodeBaseProps<Data extends Record<string, unknown> = Record<string, unknown>>
  extends NodeProps<Node<Data>> {
  handles?: HandleDescription[];
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

type Props = Pick<NodeBaseProps, 'handles' | 'headerLeft' | 'headerRight' | 'children'>;

export default function NodeBase(props: Props) {
  const { handles = [], headerLeft, headerRight, children } = props;
  return (
    <div className={s.root}>
      {handles.map(({ type, position }, i) => (
        <Handle
          key={i}
          type={type === 'TARGET' ? 'target' : 'source'}
          position={position === 'BOTTOM' ? Position.Bottom : Position.Top}
          className={s.handle}
        />
      ))}
      {(headerLeft || headerRight) && (
        <div className={s.header}>
          <div className={s.headerLeft}>{props.headerLeft}</div>
          <div className={s.headerRight}>{props.headerRight}</div>
        </div>
      )}
      {children}
    </div>
  );
}
