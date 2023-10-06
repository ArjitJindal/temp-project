import SettingsCard from '@/components/library/SettingsCard';
import { AddToSlackButton } from '@/pages/case-management/components/AddToSlackButton';

export const SlackNotificationsSettings = () => {
  return (
    <SettingsCard
      title="Slack notifications"
      description="Receive real-time notifications on Slack whenever a new case is created."
    >
      <AddToSlackButton />
    </SettingsCard>
  );
};
