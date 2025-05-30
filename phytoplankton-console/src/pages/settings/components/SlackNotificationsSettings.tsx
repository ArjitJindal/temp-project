import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import SettingsCard from '@/components/library/SettingsCard';
import { AddToSlackButton } from '@/pages/case-management/components/AddToSlackButton';

export const SlackNotificationsSettings = () => {
  return (
    <Feature name="SLACK_ALERTS">
      <SettingsCard
        title="Slack notifications"
        description="Receive real-time notifications on Slack whenever a new case is created."
        minRequiredResources={['write:::settings/case-management/slack-notifications/*']}
      >
        <AddToSlackButton />
      </SettingsCard>
    </Feature>
  );
};
