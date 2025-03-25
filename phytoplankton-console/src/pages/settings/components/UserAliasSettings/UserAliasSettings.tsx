import { useState } from 'react';
import s from './style.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import SettingsCard from '@/components/library/SettingsCard';
import TextInput from '@/components/library/TextInput';
import Form from '@/components/library/Form';
import Button from '@/components/library/Button';

type FormValues = {
  alias: string;
};

const UserAliasSettings = () => {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [alias, setAlias] = useState(settings.userAlias || '');

  return (
    <SettingsCard title="User alias" description="Configure users display name in console">
      <Form<FormValues>
        className={s.root}
        initialValues={{
          alias: settings.userAlias || '',
        }}
        onSubmit={() => {
          setIsLoading(true);
          mutateTenantSettings.mutateAsync({ userAlias: alias });
          setIsLoading(false);
        }}
      >
        <p className={s.aliasLabel}>User alias</p>
        <div className={s.inputContainer}>
          <TextInput
            name={'alias'}
            value={alias}
            onChange={(value) => setAlias((value?.toLocaleLowerCase() ?? '').slice(0, 30))}
          />
        </div>
        <Button
          isLoading={isLoading}
          isDisabled={!alias || alias === settings.userAlias}
          htmlType="submit"
        >
          Update
        </Button>
      </Form>
    </SettingsCard>
  );
};

export default UserAliasSettings;
