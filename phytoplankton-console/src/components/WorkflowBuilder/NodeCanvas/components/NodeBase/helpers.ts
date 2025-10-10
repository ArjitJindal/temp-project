export function getHandleId(
  nodeId: string,
  position: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT',
  type: 'TARGET' | 'SOURCE',
) {
  return `${nodeId}-${position}-${type}`;
}
