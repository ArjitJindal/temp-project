import { Position } from '@xyflow/react';
import { HandlePosition, HandleType } from './types';
import { neverThrow } from '@/utils/lang';

export const convertHandlePosition = (handlePosition: HandlePosition): Position => {
  switch (handlePosition) {
    case 'TOP':
      return Position.Top;
    case 'BOTTOM':
      return Position.Bottom;
    case 'LEFT':
      return Position.Left;
    case 'RIGHT':
      return Position.Right;
  }
  return neverThrow(handlePosition, `Invalid handle position: ${handlePosition}`);
};

export function getHandleId(nodeId: string, position: HandlePosition, type: HandleType) {
  return `${nodeId}-${position}-${type}`;
}
