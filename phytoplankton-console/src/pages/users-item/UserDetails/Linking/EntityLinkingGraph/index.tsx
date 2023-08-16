import React, { useMemo, useRef, useState } from 'react';
import {
  GraphCanvas,
  GraphCanvasRef,
  InternalGraphNode,
  lightTheme,
  SphereWithIcon,
  useSelection,
  EdgeInterpolation,
  EdgeArrowPosition,
} from 'reagraph';
import s from '../index.module.less';
import { UserPanel } from '../UserPanel';
import { AttributePanel } from '../AttributePanel';
import { GraphEdges, GraphNodes } from '@/apis';

type EntityLinkingProps = {
  userId: string;
  onFollow: (userId: string) => void;
  nodes: GraphNodes[];
  edges: GraphEdges[];
  followed: string[];
  edgeInterpolation?: EdgeInterpolation;
  edgeArrowPosition?: EdgeArrowPosition;
  isFollowEnabled: (id: string) => boolean;
};
export const EntityLinkingGraph = (props: EntityLinkingProps) => {
  const graphRef = useRef<GraphCanvasRef | null>(null);

  const {
    nodes,
    edges,
    userId,
    followed,
    onFollow,
    edgeArrowPosition = 'none',
    edgeInterpolation = 'linear',
    isFollowEnabled,
  } = props;
  const { selections, actives, onNodePointerOver, onNodePointerOut } = useSelection({
    ref: graphRef,
    pathHoverType: 'all',
  });

  const [selectedNode, setSelectedNode] = useState<InternalGraphNode>();

  const selectedUserId = useMemo(
    () => (selectedNode ? selectedNode.id.replace('user:', '') : ''),
    [selectedNode],
  );

  return (
    <>
      {selectedNode && (
        <>
          {selectedNode.id.startsWith('user') && userId !== selectedUserId && (
            <div className={s.contextMenu}>
              <UserPanel
                followed={followed}
                onFollow={onFollow}
                userId={selectedUserId}
                isFollowEnabled={isFollowEnabled(selectedNode.id || '')}
              />
            </div>
          )}
          {!selectedNode.id.startsWith('user') && (
            <div className={s.contextMenu}>
              <AttributePanel
                attributeId={selectedNode.id}
                isFollowEnabled={isFollowEnabled(selectedNode.id || '')}
                followed={followed}
                onFollow={onFollow}
              />
            </div>
          )}
        </>
      )}
      <GraphCanvas
        ref={graphRef}
        edgeInterpolation={edgeInterpolation}
        edgeArrowPosition={edgeArrowPosition}
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
  if (id.startsWith('address')) {
    return `/linking/location.png`;
  }
  if (id.startsWith('contactNumber')) {
    return `/linking/phone.png`;
  }
  if (id.startsWith('payment')) {
    return `/linking/card.png`;
  }
  return '';
};
