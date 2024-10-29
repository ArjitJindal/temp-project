import { useState } from 'react';
import { every, includes } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './style.module.less';
import { NOTIFICATION_TYPES } from './NotificationsTypes';
import * as Card from '@/components/ui/Card';
import { H4, H5 } from '@/components/ui/Typography';
import Checkbox from '@/components/library/Checkbox';
import Button from '@/components/library/Button';
import {
  Feature,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { NotificationType } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';

export const NotificationsSettings = () => {
  const permissions = useHasPermissions(['settings:notifications:write']);
  const types = Object.keys(NOTIFICATION_TYPES);
  const { notificationsSubscriptions } = useSettings();
  const [consoleNotificationSettings, setConsoleNotificationSettings] = useState(
    notificationsSubscriptions?.console ?? [],
  );
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSaveNotificationSettings = () => {
    mutateTenantSettings.mutate({
      notificationsSubscriptions: { console: consoleNotificationSettings },
    });
  };
  const handleCheckboxChange = (value: NotificationType[]) => {
    const values = consoleNotificationSettings.flatMap((item) => item);
    const isChecked = isSubset(values, value);
    if (isChecked) {
      setConsoleNotificationSettings(values.filter((item) => !value.includes(item)));
    } else {
      setConsoleNotificationSettings([...values, ...value]);
    }
  };
  function isSubset(array, value) {
    return every(value, (item) => includes(array, item));
  }
  return (
    <Feature name="NOTIFICATIONS">
      <Card.Root noBorder className={s.root}>
        <div className={s.container}>
          <div className={s.row}>
            <div>
              <H4 className={s.heading}>Notification settings</H4>
            </div>
            <div>
              <H5 className={s.heading}>Console</H5>
            </div>
          </div>
          {types.map((type) => {
            const notificationTypes = NOTIFICATION_TYPES[type];

            return (
              <div className={s.section}>
                <H4 className={s.heading}>{humanizeAuto(type)}</H4>
                {notificationTypes.map((notificationType) => {
                  const value = notificationType.value;
                  const isChecked = isSubset(consoleNotificationSettings, value);
                  return (
                    <div className={s.row}>
                      <div>
                        <span>{notificationType.label}</span>
                      </div>
                      <div>
                        <Checkbox
                          value={isChecked}
                          onChange={() => {
                            handleCheckboxChange(value);
                          }}
                          isDisabled={!permissions}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div>
            <Button
              type="PRIMARY"
              onClick={() => {
                handleSaveNotificationSettings();
              }}
              isDisabled={!permissions}
            >
              Save
            </Button>
          </div>
        </div>
      </Card.Root>
    </Feature>
  );
};
