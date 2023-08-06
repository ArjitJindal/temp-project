import React, { useRef, useState } from 'react';
import {
  GraphCanvas,
  GraphCanvasRef,
  InternalGraphNode,
  lightTheme,
  SphereWithIcon,
  useSelection,
} from 'reagraph';
import s from '../index.module.less';
import { UserEntityEdges, UserEntityNodes } from '@/apis';
import { UserPanel } from '@/pages/users-item/UserDetails/EntityLinking/UserPanel';
import { AttributePanel } from '@/pages/users-item/UserDetails/EntityLinking/AttributePanel';

type EntityLinkingProps = {
  userId: string;
  onFollow: (userId: string) => void;
  nodes: UserEntityNodes[];
  edges: UserEntityEdges[];
  followed: string[];
};
export const EntityLinkingGraph = (props: EntityLinkingProps) => {
  const graphRef = useRef<GraphCanvasRef | null>(null);

  const { nodes, edges, userId, followed, onFollow } = props;
  const { selections, actives, onNodePointerOver, onNodePointerOut } = useSelection({
    ref: graphRef,
    pathHoverType: 'all',
  });

  const [selectedNode, setSelectedNode] = useState<InternalGraphNode>();
  const selectedUserId = selectedNode ? selectedNode.id.replace('user:', '') : '';

  return (
    <>
      {selectedNode && (
        <>
          {selectedNode.id.startsWith('user') && userId !== selectedUserId && (
            <div className={s.contextMenu}>
              <UserPanel followed={followed} onFollow={onFollow} userId={selectedUserId} />
            </div>
          )}
          {!selectedNode.id.startsWith('user') && (
            <div className={s.contextMenu}>
              <AttributePanel attributeId={selectedNode.id} />
            </div>
          )}
        </>
      )}
      <GraphCanvas
        ref={graphRef}
        edgeArrowPosition="none"
        labelType={'all'}
        labelFontUrl={
          'https://fonts.gstatic.com/s/notosans/v30/o-0IIpQlx3QUlC5A4PNr6DRASf6M7VBj.woff2'
        }
        theme={{
          ...lightTheme,
          edge: { ...lightTheme.edge, activeFill: '#52c41a' },
          node: { ...lightTheme.node, label: { ...lightTheme.node.label, activeColor: '#52c41a' } },
        }}
        selections={selections}
        actives={actives}
        onNodeClick={(node) => {
          setSelectedNode(node);
        }}
        onNodePointerOver={onNodePointerOver}
        onNodePointerOut={onNodePointerOut}
        onCanvasClick={() => {
          setSelectedNode(undefined);
        }}
        renderNode={({ node, ...rest }) => (
          <SphereWithIcon
            {...rest}
            color={getNodeColor(userId, node.id)}
            node={node}
            image={getIcon(node.id)}
          />
        )}
        nodes={nodes}
        edges={edges}
      />
    </>
  );
};

const getNodeColor = (mainUserId: string, id: string): string => {
  if (`user:${mainUserId}` == id) {
    return '#E47E30';
  }
  if (id.startsWith('user')) {
    return '#1555bb';
  }
  return '#DFE6F2';
};

const getIcon = (id: string): string => {
  if (id.startsWith('user')) {
    return `/linking/user.png`;
  }
  if (id.startsWith('emailAddress')) {
    return `/linking/email.png`;
  }
  if (id.startsWith('paymentIdentifier')) {
    return `/linking/card.png`;
  }
  if (id.startsWith('address')) {
    return `/linking/location.png`;
  }
  if (id.startsWith('contactNumber')) {
    return `/linking/phone.png`;
  }
  return '';
};
