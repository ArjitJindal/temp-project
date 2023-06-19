import UserDetails from '../ConsumerUserDetails/UserDetails/index';
import { UI_SETTINGS } from '../../ui-settings';
import { LegalDocumentsTable } from './LegalDocuments';
import { InternalConsumerUser } from '@/apis';

interface Props {
  user: InternalConsumerUser;
  isEmbedded?: boolean;
  updateCollapseState?: (key: string, value: boolean) => void;
  uiSettings: typeof UI_SETTINGS;
}

export default function ConsumerUserDetails(props: Props) {
  const { user, uiSettings } = props;
  return (
    <>
      <UserDetails
        user={user}
        updateCollapseState={props.updateCollapseState}
        title={uiSettings.cards.USER_DETAILS.title}
        collapsableKey={uiSettings.cards.USER_DETAILS.key}
      />
      <LegalDocumentsTable
        person={user}
        updateCollapseState={props.updateCollapseState}
        title={uiSettings.cards.LEGAL_DOCUMENTS.title}
        collapsableKey={uiSettings.cards.LEGAL_DOCUMENTS.key}
      />
    </>
  );
}
