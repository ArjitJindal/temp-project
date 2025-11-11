import { BaseEdge, Edge, EdgeProps, getSmoothStepPath, Position } from '@xyflow/react';
import { EdgeData } from '@/components/WorkflowBuilder/NodeCanvas/types';

interface Props extends EdgeProps<Edge<EdgeData>> {}

export default function DefaultEdge(props: Props) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, markerStart, data } = props;

  const [path] = getSmoothStepPath({
    sourceX: sourceX,
    sourceY: sourceY,
    sourcePosition: data?.sourcePosition ?? Position.Bottom,
    targetX: targetX,
    targetY: targetY,
    targetPosition: data?.targetPosition ?? Position.Top,
  });

  return <BaseEdge path={path} markerEnd={markerEnd} markerStart={markerStart} />;
}
