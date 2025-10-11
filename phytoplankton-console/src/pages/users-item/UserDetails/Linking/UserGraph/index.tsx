import React, { useEffect, useMemo, useState } from 'react';
import { EdgeArrowPosition, EdgeInterpolation } from 'reagraph';
import { uniqBy } from 'lodash';
import s from '../index.module.less';
import { EntityLinkingGraph } from '../EntityLinkingGraph';
import * as Card from '@/components/ui/Card';
import { Graph, GraphEdges, GraphNodes } from '@/apis';
import Spinner from '@/components/library/Spinner';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { useUserEntity as useUserEntityApi, useTxnEntity as useTxnEntityApi } from '@/hooks/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export type GraphParams = (
  user: string,
  filters: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    entities?: EntitiesEnum;
  },
) => Promise<Graph>;

interface Props {
  scope: ScopeSelectorValue;
  userId: string;
  nodes: GraphNodes[];
  edges: GraphEdges[];
  followed: string[];
  onFollow: (userId: string) => void;
  filters: GraphFilters;
  setFilters: React.Dispatch<React.SetStateAction<GraphFilters>>;
  edgeInterpolation?: EdgeInterpolation;
  edgeArrowPosition?: EdgeArrowPosition;
  isFollowEnabled: (id: string) => boolean;
}

export const DEFAULT_PAST_DAYS = 30;
export type EntitiesEnum = 'all' | 'user' | 'payment-identifier';

// entities
export interface GraphFilters {
  entities: EntitiesEnum[];
}

export default function UserGraph(props: Props) {
  const [linkCount, setLinkCount] = useState<number>(0);
  const [entities, setEntities] = useState<EntitiesEnum>('all');
  const { nodes, edges, userId } = props;

  const filteredEdges = useMemo(() => {
    return edges.filter((edge) => {
      const label = edge.label;
      const source = edge.source;
      const target = edge.target;
      if (!label) {
        return true;
      }

      try {
        const numberedLabel = Number(label);
        if (numberedLabel > linkCount && entities === 'all') {
          return true;
        }
        if (
          numberedLabel > linkCount &&
          entities === 'user' &&
          source.includes('user:') &&
          target.includes('user:')
        ) {
          return true;
        }
        if (
          numberedLabel > linkCount &&
          entities === 'payment-identifier' &&
          (source.includes('payment:') || target.includes('payment:'))
        ) {
          return true;
        }
      } catch {
        return true;
      }

      return false;
    });
  }, [edges, linkCount, entities]);

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.id === `user:${userId}`) {
        return true;
      }

      return filteredEdges.some((edge) => edge.source === node.id || edge.target === node.id);
    });
  }, [nodes, filteredEdges, userId]);

  return (
    <>
      {filteredEdges && (
        <Card.Section>
          <div className={s.graphContainer}>
            <EntityLinkingGraph
              scope={props.scope}
              userId={props.userId}
              entities={entities}
              setEntities={setEntities}
              linkCount={linkCount}
              setLinkCount={setLinkCount}
              nodes={filteredNodes}
              edges={filteredEdges}
              followed={props.followed}
              onFollow={props.onFollow}
              extraHints={[`Ontology displays data for the last ${DEFAULT_PAST_DAYS} days only`]}
              edgeInterpolation={props.edgeInterpolation}
              edgeArrowPosition={props.edgeArrowPosition}
              isFollowEnabled={props.isFollowEnabled}
            />
          </div>
        </Card.Section>
      )}
      {!filteredEdges && (
        <Card.Section>
          <div className={s.spinContainer}>
            <Spinner />
          </div>
        </Card.Section>
      )}
    </>
  );
}

export type ScopeSelectorValue = 'ENTITY' | 'TXN';
export const DEFAULT_AFTER_TIMESTAMP = dayjs().subtract(DEFAULT_PAST_DAYS, 'day').valueOf();
export function useUserEntity(
  userId: string,
  filters?: { afterTimestamp: number | undefined; beforeTimestamp: number | undefined },
) {
  const hasFeatureEnabled = useFeatureEnabled('ENTITY_LINKING');
  return useUserEntityApi(userId, filters, { enabled: hasFeatureEnabled && !!userId });
}

export function useTxnEntity(
  userId: string,
  filters?: { afterTimestamp: number | undefined; beforeTimestamp: number | undefined },
) {
  return useTxnEntityApi(userId, filters, { enabled: !!userId });
}
export function useLinkingState(userId: string, initialScope: ScopeSelectorValue = 'ENTITY') {
  const [scope, setScope] = useState<ScopeSelectorValue>(initialScope);
  const [entityNodes, setEntityNodes] = useState<GraphNodes[]>([]);
  const [entityEdges, setEntityEdges] = useState<GraphEdges[]>([]);
  const [txnNodes, setTxnNodes] = useState<GraphNodes[]>([]);
  const [txnEdges, setTxnEdges] = useState<GraphEdges[]>([]);
  const [entityFilters, setEntityFilters] = useState<GraphFilters>({ entities: ['all'] });
  const [txnFilters, setTxnFilters] = useState<GraphFilters>({ entities: ['all'] });
  const [followed, setFollowed] = useState([userId]);

  const filters = { afterTimestamp: DEFAULT_AFTER_TIMESTAMP, beforeTimestamp: undefined };

  const entityData = useUserEntity(userId, filters);
  const txnData = useTxnEntity(userId, filters);

  useEffect(() => {
    if (entityData) {
      setEntityNodes(entityData.nodes || []);
      setEntityEdges(entityData.edges || []);
    }
    if (txnData) {
      setTxnNodes(txnData.nodes || []);
      setTxnEdges(txnData.edges || []);
    }
  }, [entityData, txnData]);

  return {
    scope,
    setScope,
    entityNodes,
    setEntityNodes,
    entityEdges,
    setEntityEdges,
    txnNodes,
    setTxnNodes,
    txnEdges,
    setTxnEdges,
    entityFilters,
    setEntityFilters,
    txnFilters,
    setTxnFilters,
    followed,
    setFollowed,
  };
}

export const useUserEntityFollow = (linkingState: any) => {
  const api = useApi();
  const hasFeatureEnabled = useFeatureEnabled('ENTITY_LINKING');
  const handleFollow = async (userId: string) => {
    if (!hasFeatureEnabled) {
      return;
    }
    try {
      const data = await (linkingState.scope === 'ENTITY'
        ? api.getUserEntity({ userId })
        : api.getTxnLinking({ userId }));

      if (data) {
        if (linkingState.scope === 'ENTITY') {
          linkingState.setEntityNodes((nodes) => uniqBy([...nodes, ...(data.nodes || [])], 'id'));
          linkingState.setEntityEdges((edges) => uniqBy([...edges, ...(data.edges || [])], 'id'));
        } else {
          linkingState.setTxnNodes((nodes) => uniqBy([...nodes, ...(data.nodes || [])], 'id'));
          linkingState.setTxnEdges((edges) => uniqBy([...edges, ...(data.edges || [])], 'id'));
        }
        linkingState.setFollowed((prev) => [userId, ...prev]);
      }
    } catch (error) {
      console.error('Failed to fetch entity data:', error);
    }
  };

  return handleFollow;
};
