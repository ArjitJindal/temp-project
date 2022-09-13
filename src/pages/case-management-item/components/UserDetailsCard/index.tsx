import React from 'react';
import * as Card from '@/components/ui/Card';
import UserDetails from '@/pages/users-item/UserDetails';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';

interface Props {
  title: string;
  user: InternalConsumerUser | InternalBusinessUser | undefined;
}

export default function UserDetailsCard(props: Props) {
  const { title, user } = props;
  return (
    <Card.Root
      header={{
        title,
        collapsable: true,
        collapsedByDefault: true,
      }}
    >
      <Card.Section>
        <UserDetails user={user} isEmbedded={true} />
      </Card.Section>
    </Card.Root>
  );
}
