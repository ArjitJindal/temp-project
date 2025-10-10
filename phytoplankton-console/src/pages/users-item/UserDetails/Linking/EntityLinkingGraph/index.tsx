import React, { useMemo, useRef, useState, useEffect } from 'react';
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
import cn from 'clsx';
import { EntitiesEnum } from '../UserGraph';
import parentS from '../index.module.less';
import { UserPanel } from '../UserPanel';
import { AttributePanel } from '../AttributePanel';
import { ScopeSelectorValue } from '../entity_linking';
import s from './index.module.less';
import CommandKeyIcon from './command-key-icon.react.svg';
import fontUrl from './arialuni.ttf';
import { EntityFilterButton } from './EntityFilter';
import { LinkCountFilterButton } from './LinkCountFilter';
import { GraphEdges, GraphNodes } from '@/apis';
import Alert from '@/components/library/Alert';
type EntityLinkingProps = {
  scope: ScopeSelectorValue;
  userId: string;
  extraHints: string[];
  onFollow: (userId: string) => void;
  nodes: GraphNodes[];
  edges: GraphEdges[];
  followed: string[];
  edgeInterpolation?: EdgeInterpolation;
  edgeArrowPosition?: EdgeArrowPosition;
  isFollowEnabled: (id: string) => boolean;
  linkCount: number;
  setLinkCount: (value: number) => void;
  entities: EntitiesEnum;
  setEntities: (value: EntitiesEnum) => void;
};
export const EntityLinkingGraph = (props: EntityLinkingProps) => {
  const graphRef = useRef<GraphCanvasRef | null>(null);

  const {
    scope,
    nodes,
    edges,
    userId,
    followed,
    onFollow,
    edgeArrowPosition = 'none',
    edgeInterpolation = 'linear',
    isFollowEnabled,
    extraHints,
    linkCount,
    setLinkCount,
    entities,
    setEntities,
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

  const [isScrollEnabled, setScrollEnabled] = useState(false);
  useEffect(() => {
    const listener = (e) => {
      setScrollEnabled(e.ctrlKey || e.metaKey || false);
    };
    window.addEventListener('keydown', listener);
    window.addEventListener('keyup', listener);
    return () => {
      window.removeEventListener('keydown', listener);
      window.removeEventListener('keyup', listener);
    };
  }, []);

  return (
    <div className={cn(s.root, isScrollEnabled && s.isScrollEnabled)}>
      <div className={s.hint}>
        {extraHints.map((hint, index) => (
          <Alert key={index} type={'INFO'}>
            {hint}
          </Alert>
        ))}
        <Alert type={'INFO'}>
          Hold Ctrl or{' '}
          <CommandKeyIcon
            style={{
              display: 'inline',
              width: '1.2em',
              height: '1.2em',
              verticalAlign: 'text-bottom',
            }}
          />{' '}
          key and scroll to zoom
        </Alert>
        {scope === 'TXN' && (
          <div className={s.filters}>
            <EntityFilterButton entities={entities} setEntities={setEntities} />
            <LinkCountFilterButton linkCount={linkCount} setLinkCount={setLinkCount} />
          </div>
        )}
      </div>
      {selectedNode && (
        <>
          {selectedNode.id.startsWith('user') && (
            <div className={parentS.contextMenu}>
              <UserPanel
                followed={followed}
                onFollow={onFollow}
                userId={selectedUserId}
                isFollowEnabled={isFollowEnabled(selectedNode.id || '')}
              />
            </div>
          )}
          {!selectedNode.id.startsWith('user') && (
            <div className={parentS.contextMenu}>
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
        labelFontUrl={fontUrl}
        theme={{
          ...lightTheme,
          edge: { ...lightTheme.edge, activeFill: '#52c41a' },
          node: {
            ...lightTheme.node,
            label: { ...lightTheme.node.label, activeColor: '#52c41a' },
          },
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
        renderNode={({ node, ...rest }) => {
          return (
            <SphereWithIcon
              {...rest}
              color={getNodeColor(userId, node.id)}
              node={node}
              image={getIcon(node.id)}
            />
          );
        }}
        nodes={nodes}
        edges={edges}
        edgeLabelPosition={'inline'}
        draggable={true}
      />
    </div>
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
  if (id.startsWith('parent')) {
    return `/linking/parent.png`;
  }
  if (id.startsWith('child')) {
    return `/linking/children.png`;
  }
  return '';
};
