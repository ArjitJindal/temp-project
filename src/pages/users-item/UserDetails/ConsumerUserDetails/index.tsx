import UserDetails from '../ConsumerUserDetails/UserDetails/index';
import { LegalDocumentsTable } from './LegalDocuments';
import { InternalConsumerUser } from '@/apis';
import { ExpandTabRef } from '@/pages/case-management-item/UserCaseDetails';

interface Props {
  user: InternalConsumerUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  userDetailsRef?: React.Ref<ExpandTabRef>;
  legalDocumentsRef?: React.Ref<ExpandTabRef>;
  documentsRef?: React.Ref<ExpandTabRef>;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function ConsumerUserDetails(props: Props) {
  const { user, collapsedByDefault } = props;
  return (
    <>
      <UserDetails
        user={user}
        collapsedByDefault={collapsedByDefault}
        userDetailsRef={props.userDetailsRef}
        updateCollapseState={props.updateCollapseState}
      />
      <LegalDocumentsTable
        person={user}
        collapsedByDefault={collapsedByDefault}
        legalDocumentsRef={props.legalDocumentsRef}
        updateCollapseState={props.updateCollapseState}
      />
    </>
  );
}
