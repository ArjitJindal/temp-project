import React from 'react';
import NodeCanvas from './NodeCanvas';
import { EdgeDescription, NodeDescription } from './types';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="NodeCanvas">
        {() => {
          const nodes: NodeDescription[] = [
            {
              id: 'node-1',
              type: 'StatusNode',
              data: { status: 'OPEN' },
            },
            {
              id: 'node-2',
              type: 'IfNode',
              data: { logic: false },
            },
            {
              id: 'node-3',
              type: 'ThenNode',
              data: { logic: false },
            },
            {
              id: 'node-4',
              type: 'IfNode',
              data: { logic: false },
            },
            {
              id: 'node-5',
              type: 'ThenNode',
              data: { logic: false },
            },
            {
              id: 'node-6',
              type: 'StatusNode',
              data: { status: 'CLOSED' },
            },
            {
              id: 'node-7',
              type: 'NewBranchButtonNode',
              data: {},
            },
            {
              id: 'node-8',
              type: 'NewBranchButtonNode',
              data: {
                text: 'Add If/Then condition',
              },
            },
          ];

          const edges: EdgeDescription[] = [
            { id: 'e1', source: 'node-1', target: 'node-2' },
            { id: 'e2', source: 'node-2', target: 'node-3' },
            { id: 'e3', source: 'node-1', target: 'node-4' },
            { id: 'e4', source: 'node-4', target: 'node-5' },
            { id: 'e5', source: 'node-3', target: 'node-6' },
            { id: 'e6', source: 'node-5', target: 'node-6' },
            { id: 'e7', source: 'node-1', target: 'node-7' },
            { id: 'e8', source: 'node-4', target: 'node-8' },
          ];

          return (
            <div style={{ height: 450 }}>
              <NodeCanvas nodes={nodes} edges={edges} />
            </div>
          );
        }}
      </UseCase>
    </>
  );
}
