import React, { useEffect, useState } from 'react';
import { uniqBy } from 'lodash';
import { EdgeArrowPosition, EdgeInterpolation } from 'reagraph';
import s from '../index.module.less';
import { EntityLinkingGraph } from '../EntityLinkingGraph';
import * as Card from '@/components/ui/Card';
import { Graph, GraphEdges, GraphNodes } from '@/apis';
import Spinner from '@/components/library/Spinner';
import { dayjs } from '@/utils/dayjs';

interface Props {
  userId: string;
  getGraph: (user: string, afterTimestamp?: number, beforeTimestamp?: number) => Promise<Graph>;
  edgeInterpolation?: EdgeInterpolation;
  edgeArrowPosition?: EdgeArrowPosition;
  isFollowEnabled: (id: string) => boolean;
}

const DEFAULT_PAST_DAYS = 30;
const DEFAULT_AFTER_TIMESTAMP = dayjs().subtract(DEFAULT_PAST_DAYS, 'day').valueOf();

export default function UserGraph(props: Props) {
  const [userId, setUserId] = useState(props.userId);
  const [entity, setEntity] = useState<Graph>();
  const [followed, setFollowed] = useState([props.userId]);
  const { getGraph, isFollowEnabled } = props;

  const [nodes, setNodes] = useState<GraphNodes[]>([]);
  const [edges, setEdges] = useState<GraphEdges[]>([]);

  useEffect(() => {
    getGraph(userId, DEFAULT_AFTER_TIMESTAMP, undefined)
      .then(setEntity)
      .then(() => setFollowed((followed) => [userId, ...followed]));
  }, [getGraph, userId]);

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
              userId={props.userId}
              extraHints={[`Ontology displays data for the last ${DEFAULT_PAST_DAYS} days only`]}
              edgeInterpolation={props.edgeInterpolation}
              edgeArrowPosition={props.edgeArrowPosition}
              isFollowEnabled={isFollowEnabled}
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
