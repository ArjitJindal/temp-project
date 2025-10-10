import React from 'react';
import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import s from './index.module.less';
import { neverReturn } from '@/utils/lang';
import { getHandleId } from '@/components/WorkflowBuilder/NodeCanvas/components/NodeBase/helpers';

type HandleDescription = {
  position: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  type: 'TARGET' | 'SOURCE';
};

export interface NodeBaseProps<Data extends Record<string, unknown> = Record<string, unknown>>
  extends NodeProps<Node<Data>> {
  handles?: HandleDescription[];
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

type Props = Pick<NodeBaseProps, 'id' | 'handles' | 'headerLeft' | 'headerRight' | 'children'>;

export default function NodeBase(props: Props) {
  const { id, handles = [], headerLeft, headerRight, children } = props;
  return (
    <div className={s.root}>
      {handles.map(({ type, position }, i) => {
        let rfPosition: Position;
        if (position === 'BOTTOM') {
          rfPosition = Position.Bottom;
        } else if (position === 'RIGHT') {
          rfPosition = Position.Right;
        } else if (position === 'LEFT') {
          rfPosition = Position.Left;
        } else if (position === 'TOP') {
          rfPosition = Position.Top;
        } else {
          rfPosition = neverReturn(position, Position.Top);
        }
        return (
          <Handle
            key={i}
            id={getHandleId(id, position, type)}
            type={type === 'TARGET' ? 'target' : 'source'}
            position={rfPosition}
            className={s.handle}
          />
        );
      })}
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
