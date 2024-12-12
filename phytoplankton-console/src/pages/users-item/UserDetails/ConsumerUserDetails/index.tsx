import ContactDetails from 'src/pages/users-item/UserDetails/shared/ContactDetailsCard';
import ExpectedIncome from 'src/pages/users-item/UserDetails/shared/ExpectedIncome';
import SavedPaymentDetails from 'src/pages/users-item/UserDetails/shared/SavedPaymentDetailsCard';
import Attachments from '../Attachments';
import GeneralDetails from './GeneralDetails';
import LegalDocuments from './LegalDocuments';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { Comment, InternalConsumerUser } from '@/apis';
import Tags from '@/pages/users-item/UserDetails/shared/Tags';
import { CommentType, useAuth0User } from '@/utils/user-utils';

interface Props {
  user: InternalConsumerUser;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function ConsumerUserDetails(props: Props) {
  const currentUser = useAuth0User();
  const { user, onNewComment } = props;
  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell columnSpan={2}>
        <GeneralDetails user={user} columns={2} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1}>
        <ContactDetails contactDetails={user.contactDetails} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1} maxHeight={350}>
        <Tags tags={user.tags ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1} maxHeight={350}>
        <LegalDocuments legalDocuments={user.legalDocuments ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.ColumnGroup
        columnSpan={1}
        maxHeight={350}
        childrens={[
          <Attachments
            attachments={user.attachments ?? []}
            userId={user.userId}
            personId={user.userId}
            currentUserId={currentUser.userId}
            personType="CONSUMER"
            onNewComment={onNewComment}
          />,
          <ExpectedIncome expectedIncome={user.expectedIncome} />,
        ]}
      />
      <EntityInfoGrid.Cell columnSpan={3}>
        <SavedPaymentDetails user={user} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
