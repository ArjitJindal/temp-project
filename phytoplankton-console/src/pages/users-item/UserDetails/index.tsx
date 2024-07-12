import React, { useState } from 'react';
import { UI_SETTINGS } from '../ui-settings';
import BusinessUserDetails from './BusinessUserDetails';
import ConsumerUserDetails from './ConsumerUserDetails';
import s from './index.module.less';
import { Authorized } from '@/components/utils/Authorized';
import { InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { Small } from '@/components/ui/Typography';
import SegmentedControl from '@/components/library/SegmentedControl';
import { usePermissions } from '@/utils/user-utils';
import { notEmpty } from '@/utils/array';
import SanctionsWhitelist from '@/pages/users-item/UserDetails/SanctionsWhitelist';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  user?: InternalConsumerUser | InternalBusinessUser | MissingUser;
  uiSettings: typeof UI_SETTINGS;
}

function UserDetails(props: Props) {
  const { user, uiSettings } = props;

  const permissions = usePermissions();
  const sanctionsEnabled = useFeatureEnabled('SANCTIONS');

  const tabs = [
    permissions.has('users:user-details:read') && { label: 'Overview', value: 'OVERVIEW' },
    sanctionsEnabled && { label: 'Sanctions whitelist', value: 'SANCTIONS_WHITELIST' },
  ].filter(notEmpty);

  const [tab, setTab] = useState(tabs[0]?.value);

  if (tabs.length === 0) {
    return (
      <div className={s.root}>
        <Small>No information available for the user</Small>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <SegmentedControl active={tab} onChange={setTab} items={tabs} />
      {tab === 'OVERVIEW' &&
        (user == null || !('type' in user) ? (
          <Small>No user details found</Small>
        ) : (
          <Authorized required={['users:user-details:read']}>
            <>
              {user?.type === 'BUSINESS' && (
                <BusinessUserDetails
                  user={user}
                  uiSettings={uiSettings}
                  hideExpectedTransactionLimits={true}
                />
              )}
              {user?.type === 'CONSUMER' && (
                <ConsumerUserDetails user={user} uiSettings={uiSettings} />
              )}
            </>
          </Authorized>
        ))}
      {tab === 'SANCTIONS_WHITELIST' && user != null && 'type' in user && (
        <SanctionsWhitelist user={user} uiSettings={uiSettings} />
      )}
    </div>
  );
}

export default UserDetails;
