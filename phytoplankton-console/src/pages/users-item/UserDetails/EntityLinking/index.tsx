import { Spin } from 'antd';

import React, { useEffect, useState } from 'react';
import { uniqBy } from 'lodash';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { UserEntity, UserEntityEdges, UserEntityNodes } from '@/apis';
import { EntityLinkingGraph } from '@/pages/users-item/UserDetails/EntityLinking/EntityLinkingGraph';

interface Props {
  userId: string;
}

export default function EntityLinking(props: Props) {
  const api = useApi();
  const [userId, setUserId] = useState(props.userId);
  const [entity, setEntity] = useState<UserEntity>();
  const [followed, setFollowed] = useState([props.userId]);

  const [nodes, setNodes] = useState<UserEntityNodes[]>([]);
  const [edges, setEdges] = useState<UserEntityEdges[]>([]);
  useEffect(() => {
    api
      .getUserEntity({ userId })
      .then(setEntity)
      .then(() => setFollowed((followed) => [userId, ...followed]));
  }, [api, userId]);

  useEffect(() => {
    if (entity) {
      setNodes((nodes) => (entity.nodes ? uniqBy([...nodes, ...entity.nodes], 'id') : nodes));
      setEdges((edges) => (entity.edges ? uniqBy([...edges, ...entity.edges], 'id') : edges));
    }
  }, [entity]);

  return (
    <Card.Root className={s.root}>
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
            />
          </div>
        </Card.Section>
      )}
      {!entity && (
        <Card.Section>
          <div className={s.spinContainer}>
            <Spin />
          </div>
        </Card.Section>
      )}
    </Card.Root>
  );
}
