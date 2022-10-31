import React from 'react';
import * as Card from '@/components/ui/Card';
import UserDetails from '@/pages/users-item/UserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import UserIdNameCard from '@/components/ui/UserIdNameCard';

interface Props {
  title: string;
  user: InternalConsumerUser | InternalBusinessUser | MissingUser | undefined;
}

export default function UserDetailsCard(props: Props) {
  const { title, user } = props;
  return (
    <Card.Root
      disabled={user == null || !('type' in user)}
      header={{
        title,
        collapsable: true,
        collapsedByDefault: true,
      }}
    >
      <Card.Section>
        <UserIdNameCard user={user} />
      </Card.Section>
      <Card.Section>
        <UserDetails user={user} isEmbedded={true} />
      </Card.Section>
    </Card.Root>
  );
}
