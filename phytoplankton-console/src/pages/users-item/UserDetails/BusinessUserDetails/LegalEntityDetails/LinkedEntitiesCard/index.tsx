import React from 'react';
import { Link } from 'react-router-dom';
import { Graph, InternalBusinessUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_ENTITY } from '@/utils/queries/keys';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { makeUrl } from '@/utils/routing';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  user: InternalBusinessUser;
}

export default function LinkedEntities(props: Props) {
  const { user } = props;
  const settings = useSettings();
  const api = useApi();

  const queryResult = useQuery<Graph>(USERS_ENTITY(user.userId), async (): Promise<Graph> => {
    if (user.userId == null) {
      throw new Error(`Id is not defined`);
    }
    return await api.getUserEntity({ userId: user.userId });
  });

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(graph) => {
        const childIds = graph.nodes
          ?.filter(({ id }) => id.startsWith('children:'))
          .flatMap(({ id }) => id.substring('children:'.length).split(/,\s/));

        const parentUserId = user.linkedEntities?.parentUserId;
        return (
          <EntityPropertiesCard
            title={'Linked entities'}
            items={[
              {
                label: `Parent ${settings.userAlias} ID’s`,
                value: parentUserId ? (
                  <div>
                    <Link
                      key={'parentUserId'}
                      to={makeUrl(`/users/list/all/:userId`, {
                        userId: parentUserId,
                      })}
                    >
                      {parentUserId}
                    </Link>
                  </div>
                ) : (
                  ''
                ),
              },
              ...(childIds && childIds.length > 0
                ? [
                    {
                      label: `Child ${settings.userAlias} ID’s`,
                      value: (
                        <div>
                          {childIds.map((childId, i) => (
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
                  ]
                : []),
            ]}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
}
