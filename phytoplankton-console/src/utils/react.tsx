import React from 'react';

export function joinReactNodes(
  nodes: React.ReactNode[],
  separator: React.ReactNode = ', ',
): React.ReactNode {
  return nodes.map((node, i) => (
    <React.Fragment key={i}>
      {i !== 0 && separator}
      {node}
    </React.Fragment>
  ));
}
