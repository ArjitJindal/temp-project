import React from 'react';
import ContactDetailsCard from '../../shared/ContactDetailsCard';
import Tags from '../../shared/Tags';
import SavedPaymentDetailsCard from '../../shared/SavedPaymentDetailsCard';
import Attachment from '../../Attachments';
import GeneralDetailsCard from './GeneralDetailsCard';
import RegistrationDetailsCard from './RegistrationDetailsCard';
import FinancialDetailsCard from './FinancialDetailsCard';
import MerchantCategoryCodeCard from './MerchantCategoryCodeCard';
import TransactionAndPaymentMethodLimits from './TransactionAndPaymentMethodLimits';
import LinkedEntitiesTable from './LinkedEntitiesTable';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { Comment, InternalBusinessUser } from '@/apis';
import { CommentType } from '@/utils/user-utils';

interface Props {
  user: InternalBusinessUser;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function LegalEntityDetails(props: Props) {
  const { user, onNewComment } = props;

  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell>
        <GeneralDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <EntityInfoGrid.ColumnGroup
          childrens={[
            <RegistrationDetailsCard key={'registration-details-card'} user={user} />,
            <FinancialDetailsCard key={'financial-details-card'} user={user} />,
          ]}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell>
        <EntityInfoGrid.ColumnGroup
          childrens={[
            <ContactDetailsCard
              contactDetails={user?.legalEntity?.contactDetails}
              key={'contact-details-card'}
            />,
            <MerchantCategoryCodeCard user={user} key="merchant-category-code-card" />,
          ]}
        />
      </EntityInfoGrid.Cell>

      <EntityInfoGrid.Cell columnSpan={1} rowSpan={2} maxHeight={350}>
        <Tags tags={user.tags ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1}>
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          maxHeight={350}
          childrens={[
            <Attachment
              attachments={user.attachments ?? []}
              userId={user.userId}
              personId={user.userId}
              currentUserId={user.userId}
              personType="CONSUMER"
              onNewComment={onNewComment}
              key="attachments"
            />,
          ]}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1} rowSpan={2} maxHeight={350}>
        <TransactionAndPaymentMethodLimits user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={3}>
        <SavedPaymentDetailsCard user={user} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={3}>
        <LinkedEntitiesTable userId={user.userId} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
