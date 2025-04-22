import { BaseEdge, EdgeProps } from '@xyflow/react';

interface Props extends EdgeProps {}

export default function DefaultEdge(props: Props) {
  const { sourceX, sourceY, targetX, targetY } = props;

  const centerY = (targetY - sourceY) / 2 + sourceY;
  const edgePath = `M ${sourceX} ${sourceY} L ${sourceX} ${centerY} L ${targetX} ${centerY} L ${targetX} ${targetY}`;

  return (
    <>
      <BaseEdge {...props} path={edgePath} />
    </>
  );
}
