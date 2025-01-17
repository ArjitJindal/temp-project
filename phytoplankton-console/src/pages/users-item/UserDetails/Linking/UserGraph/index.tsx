import React, { useEffect, useState } from 'react';
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
    linksCount?: number;
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
  linkCount: number[];
}
export default function UserGraph(props: Props) {
  const [userId, setUserId] = useState(props.userId);
  const [entity, setEntity] = useState<Graph>();
  const [followed, setFollowed] = useState([props.userId]);
  const { getGraph } = props;

  const [nodes, setNodes] = useState<GraphNodes[]>([]);
  const [edges, setEdges] = useState<GraphEdges[]>([]);

  // filters
  const [filters, setFilters] = useState<GraphFilters>({
    entities: ['all'],
    linkCount: [0],
  });
  useEffect(() => {
    const DEFAULT_AFTER_TIMESTAMP = dayjs().subtract(DEFAULT_PAST_DAYS, 'day').valueOf();
    getGraph(userId, {
      afterTimestamp: DEFAULT_AFTER_TIMESTAMP,
      beforeTimestamp: undefined,
      entities: filters.entities[0],
      linksCount: filters.linkCount[0],
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

  return (
    <>
      {entity && (
        <Card.Section>
          <div className={s.graphContainer}>
            <EntityLinkingGraph
              nodes={nodes}
              edges={edges}
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
