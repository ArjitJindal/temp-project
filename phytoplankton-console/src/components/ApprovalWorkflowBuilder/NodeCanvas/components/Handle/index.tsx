import { Handle as FlowHandle } from '@xyflow/react';
import { HandlePosition, HandleType } from '../../types';
import { convertHandlePosition, getHandleId } from '../../helpers';
import s from './index.module.less';

interface Props {
  nodeId: string;
  type: HandleType;
  position: HandlePosition;
}

export default function Handle(props: Props) {
  return (
    <FlowHandle
      id={getHandleId(props.nodeId, props.position, props.type)}
      position={convertHandlePosition(props.position)}
      type={props.type === 'TARGET' ? 'target' : 'source'}
      className={s.handle}
    />
  );
}
