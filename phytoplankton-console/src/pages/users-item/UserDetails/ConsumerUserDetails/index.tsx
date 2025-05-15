import Attachments from '../Attachments';
import GeneralDetails from './GeneralDetails';
import LegalDocuments from './LegalDocuments';
import ContactDetails from '@/pages/users-item/UserDetails/shared/ContactDetailsCard';
import ExpectedIncome from '@/pages/users-item/UserDetails/shared/ExpectedIncome';
import SavedPaymentDetails from '@/pages/users-item/UserDetails/shared/SavedPaymentDetailsCard';
import EntityInfoGrid from '@/components/ui/EntityInfoGrid';
import { Comment, InternalConsumerUser } from '@/apis';
import Tags from '@/pages/users-item/UserDetails/shared/Tags';
import { CommentType, useAuth0User } from '@/utils/user-utils';
import PlaceOfBirth from '@/pages/users-item/UserDetails/ConsumerUserDetails/PlaceOfBirth';
import ScreeningDetails from '@/pages/users-item/UserDetails/ConsumerUserDetails/ScreeningDetails';
import EmploymentDetails from '@/pages/users-item/UserDetails/ConsumerUserDetails/EmploymentDetails';

interface Props {
  user: InternalConsumerUser;
  onNewComment?: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function ConsumerUserDetails(props: Props) {
  const currentUser = useAuth0User();
  const { user, onNewComment } = props;
  return (
    <EntityInfoGrid.Root columns={3}>
      <EntityInfoGrid.Cell columnSpan={1}>
        <GeneralDetails user={user} columns={1} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1}>
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          childrens={[
            <PlaceOfBirth key="place-of-birth" user={user} />,
            <ExpectedIncome expectedIncome={user.expectedIncome} key="expected-income" />,
            <ScreeningDetails key="screening-details" user={user} />,
          ]}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1}>
        <EntityInfoGrid.ColumnGroup
          columnSpan={1}
          childrens={[
            <ContactDetails key="contact-details" contactDetails={user.contactDetails} />,
            <EmploymentDetails key="employment-details" user={user} />,
          ]}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1} maxHeight={350}>
        <Tags tags={user.tags ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1}>
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
              key="attachments"
            />,
          ]}
        />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={1} maxHeight={350}>
        <LegalDocuments legalDocuments={user.legalDocuments ?? []} />
      </EntityInfoGrid.Cell>
      <EntityInfoGrid.Cell columnSpan={3}>
        <SavedPaymentDetails user={user} />
      </EntityInfoGrid.Cell>
    </EntityInfoGrid.Root>
  );
}
