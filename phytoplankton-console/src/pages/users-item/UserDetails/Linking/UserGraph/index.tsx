import React, { useEffect, useMemo, useState } from 'react';
import { uniqBy } from 'lodash';
import { EdgeArrowPosition, EdgeInterpolation } from 'reagraph';
import s from '../index.module.less';
import { EntityLinkingGraph } from '../EntityLinkingGraph';
import { ScopeSelectorValue } from '../entity_linking';
import * as Card from '@/components/ui/Card';
import { EntitiesEnum, Graph, GraphEdges, GraphNodes } from '@/apis';
import Spinner from '@/components/library/Spinner';
import { dayjs } from '@/utils/dayjs';

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
  getGraph: GraphParams;
  edgeInterpolation?: EdgeInterpolation;
  edgeArrowPosition?: EdgeArrowPosition;
  isFollowEnabled: (id: string) => boolean;
}

const DEFAULT_PAST_DAYS = 30;

// entities
export interface GraphFilters {
  entities: EntitiesEnum[];
}

export default function UserGraph(props: Props) {
  const [userId, setUserId] = useState(props.userId);
  const [entity, setEntity] = useState<Graph>();
  const [followed, setFollowed] = useState([props.userId]);
  const [linkCount, setLinkCount] = useState<number>(0);
  const { getGraph } = props;

  const [nodes, setNodes] = useState<GraphNodes[]>([]);
  const [edges, setEdges] = useState<GraphEdges[]>([]);

  // filters
  const [filters, setFilters] = useState<GraphFilters>({
    entities: ['all'],
  });
  useEffect(() => {
    const DEFAULT_AFTER_TIMESTAMP = dayjs().subtract(DEFAULT_PAST_DAYS, 'day').valueOf();
    getGraph(userId, {
      afterTimestamp: DEFAULT_AFTER_TIMESTAMP,
      beforeTimestamp: undefined,
      entities: filters.entities[0],
    })
      .then(setEntity)
      .then(() => setFollowed((followed) => [userId, ...followed]));
  }, [getGraph, userId, filters]);

  useEffect(() => {
    if (entity) {
      setNodes((nodes) => (entity.nodes ? uniqBy([...nodes, ...entity.nodes], 'id') : nodes));
      setEdges((edges) => (entity.edges ? uniqBy([...edges, ...entity.edges], 'id') : edges));
    }
  }, [entity]);

  const filteredEdges = useMemo(() => {
    return edges.filter((edge) => {
      const label = edge.label;
      if (!label) {
        return true;
      }

      try {
        const numberedLabel = Number(label);
        if (numberedLabel > linkCount) {
          return true;
        }
      } catch {
        return true;
      }

      return false;
    });
  }, [edges, linkCount]);

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.id === `user:${props.userId}`) {
        return true;
      }

      return filteredEdges.some((edge) => edge.source === node.id || edge.target === node.id);
    });
  }, [nodes, filteredEdges, props.userId]);

  return (
    <>
      {entity && (
        <Card.Section>
          <div className={s.graphContainer}>
            <EntityLinkingGraph
              linkCount={linkCount}
              setLinkCount={setLinkCount}
              nodes={filteredNodes}
              edges={filteredEdges}
              followed={followed}
              onFollow={(userId) => {
                setUserId(userId);
              }}
              extraHints={[`Ontology displays data for the last ${DEFAULT_PAST_DAYS} days only`]}
              edgeInterpolation={props.edgeInterpolation}
              edgeArrowPosition={props.edgeArrowPosition}
              filters={filters}
              setFilters={setFilters}
              {...props}
            />
          </div>
        </Card.Section>
      )}
      {!entity && (
        <Card.Section>
          <div className={s.spinContainer}>
            <Spinner />
          </div>
        </Card.Section>
      )}
    </>
  );
}
