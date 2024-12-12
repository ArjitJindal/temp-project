import React from 'react';
import ContactDetailsCard from '../../shared/ContactDetailsCard';
import Tags from '../../shared/Tags';
import SavedPaymentDetailsCard from '../../shared/SavedPaymentDetailsCard';
import Attachment from '../../Attachments';
import GeneralDetailsCard from './GeneralDetailsCard';
import RegistrationDetailsCard from './RegistrationDetailsCard';
import FinancialDetailsCard from './FinancialDetailsCard';
import MerchantCategoryCodeCard from './MerchantCategoryCodeCard';
import LinkedEntitiesCard from './LinkedEntitiesCard';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { Comment, InternalBusinessUser } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { CommentType } from '@/utils/user-utils';

interface Props {
  user: InternalBusinessUser;
  currentUserId: string;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function LegalEntityDetails(props: Props) {
  const { user, currentUserId, onNewComment } = props;
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');

  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell>
        <GeneralDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <ContactDetailsCard contactDetails={user.legalEntity.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <RegistrationDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1} maxHeight={350}>
        <FinancialDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      {isEntityLinkingEnabled ? (
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          maxHeight={350}
          childrens={[<MerchantCategoryCodeCard user={user} />, <LinkedEntitiesCard user={user} />]}
        />
      ) : (
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          maxHeight={350}
          childrens={[<MerchantCategoryCodeCard user={user} />]}
        />
      )}
      <EntityInfoGrid.Cell columnSpan={1} maxHeight={350}>
        <Attachment
          attachments={user.attachments ?? []}
          userId={user.userId}
          personId={user.userId}
          currentUserId={currentUserId}
          personType={'BUSINESS'}
          onNewComment={onNewComment}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1}>
        <Tags tags={user.tags ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={2}>
        <SavedPaymentDetailsCard user={user} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
