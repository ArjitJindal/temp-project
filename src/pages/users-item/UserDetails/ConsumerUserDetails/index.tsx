import UserDetails from '../ConsumerUserDetails/UserDetails/index';
import { LegalDocumentsTable } from './LegalDocuments';
import { InternalConsumerUser } from '@/apis';

interface Props {
  user: InternalConsumerUser;
  isEmbedded?: boolean;
  collapsedByDefault?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
}

export default function ConsumerUserDetails(props: Props) {
  const { user, collapsedByDefault } = props;
  return (
    <>
      <UserDetails
        user={user}
        collapsedByDefault={collapsedByDefault}
        updateCollapseState={props.updateCollapseState}
      />
      <LegalDocumentsTable
        person={user}
        collapsedByDefault={collapsedByDefault}
        updateCollapseState={props.updateCollapseState}
      />
    </>
  );
}
