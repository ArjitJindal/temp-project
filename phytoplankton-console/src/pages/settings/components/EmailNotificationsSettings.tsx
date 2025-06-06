import SettingsCard from '@/components/library/SettingsCard';
import Button from '@/components/library/Button';
import { getBranding } from '@/utils/branding';
import { useHasResources } from '@/utils/user-utils';

const branding = getBranding();

export const EmailNotificationsSettings = () => {
  const permissions = useHasResources(['write:::settings/notifications/email-notifications/*']);
  return (
    <SettingsCard
      title="Email notifications"
      description="Receive real-time notifications on email whenever a new case is created."
      minRequiredResources={['write:::settings/notifications/email-notifications/*']}
    >
      <div>
        <a href={`mailto:${branding.supportEmail}`}>
          <Button isDisabled={!permissions} type="PRIMARY">
            Request access
          </Button>
        </a>
      </div>
    </SettingsCard>
  );
};
