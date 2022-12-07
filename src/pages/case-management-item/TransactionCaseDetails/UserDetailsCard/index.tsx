import React from 'react';
import * as Card from '@/components/ui/Card';
import UserDetails from '@/pages/users-item/UserDetails';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import UserIdNameCard from '@/components/ui/UserIdNameCard';
import { ExpandTabRef } from '@/pages/case-management-item/TransactionCaseDetails';

interface Props {
  title: string;
  user: InternalConsumerUser | InternalBusinessUser | MissingUser | undefined;
  reference?: React.Ref<ExpandTabRef>;
  updateCollapseState?: (key: string, value: boolean) => void;
  collapseKey: string;
  onReload: () => void;
}

export default function UserDetailsCard(props: Props) {
  const { title, user, updateCollapseState } = props;

  return (
    <Card.Root
      disabled={user == null || !('type' in user)}
      header={{ title, collapsable: true, collapsedByDefault: true }}
      ref={props.reference}
      onCollapseChange={(isCollapsed) => {
        if (updateCollapseState) {
          updateCollapseState(props.collapseKey, isCollapsed);
        }
      }}
    >
      <Card.Section>
        <UserIdNameCard user={user} showRiskLevel={true} />
      </Card.Section>
      <Card.Section>
        <UserDetails
          user={user}
          isEmbedded={true}
          collapsedByDefault={true}
          onReload={props.onReload}
          showCommentEditor={false}
        />
      </Card.Section>
    </Card.Root>
  );
}
