import UserDetails from '../ConsumerUserDetails/UserDetails/index';
import { UI_SETTINGS } from '../../ui-settings';
import { LegalDocumentsTable } from './LegalDocuments';
import { InternalConsumerUser } from '@/apis';

interface Props {
  user: InternalConsumerUser;
  isEmbedded?: boolean;
  uiSettings: typeof UI_SETTINGS;
}

export default function ConsumerUserDetails(props: Props) {
  const { user, uiSettings } = props;
  return (
    <>
      <UserDetails user={user} title={uiSettings.cards.USER_DETAILS.title} />
      <LegalDocumentsTable person={user} title={uiSettings.cards.LEGAL_DOCUMENTS.title} />
    </>
  );
}
