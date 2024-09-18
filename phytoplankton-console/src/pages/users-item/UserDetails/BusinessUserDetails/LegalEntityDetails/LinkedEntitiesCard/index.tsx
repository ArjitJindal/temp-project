import React from 'react';
import { Link } from 'react-router-dom';
import { Graph, InternalBusinessUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_ENTITY } from '@/utils/queries/keys';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { makeUrl } from '@/utils/routing';

interface Props {
  user: InternalBusinessUser;
}

export default function LinkedEntities(props: Props) {
  const { user } = props;

  const api = useApi();

  const queryResult = useQuery<Graph>(USERS_ENTITY(user.userId), async (): Promise<Graph> => {
    if (user.userId == null) {
      throw new Error(`Id is not defined`);
    }
    return await api.getUserEntity({ userId: user.userId });
  });

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(graph) => (
        <EntityPropertiesCard
          title={'Linked entities'}
          items={[
            {
              label: 'Parent user ID’s',
              value: user.linkedEntities?.parentUserId,
            },
            {
              label: 'Child user ID’s',
              value: (
                <div>
                  {graph.nodes
                    ?.filter(({ id }) => id.startsWith('children:'))
                    .flatMap(({ id }) => id.substring('children:'.length).split(/,\s/))
                    .map((childId, i) => (
                      <>
                        {i !== 0 && ', '}
                        <Link
                          key={childId}
                          to={makeUrl(`/users/list/all/:userId`, { userId: childId })}
                        >
                          {childId}
                        </Link>
                      </>
                    ))}
                </div>
              ),
            },
          ]}
        />
      )}
    </AsyncResourceRenderer>
  );
}
