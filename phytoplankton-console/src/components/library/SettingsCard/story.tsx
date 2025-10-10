import SettingsCard from '.';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Settings Header with description'}>
        <SettingsCard title="Settings" description="Configure your Phytoplankton settings" />
      </UseCase>
      <UseCase title={'Settings Header without description'}>
        <SettingsCard title="Settings" />
      </UseCase>
      <UseCase title={'Settings Header with description and children'}>
        <SettingsCard title="Settings" description="Configure your Phytoplankton settings">
          <p>Children</p>
        </SettingsCard>
      </UseCase>
    </>
  );
}
