import SettingsCard from '@/components/library/SettingsCard';
import Button from '@/components/library/Button';
import { getBranding } from '@/utils/branding';
import { useHasPermissions } from '@/utils/user-utils';

const branding = getBranding();

export const EmailNotificationsSettings = () => {
  const permissions = useHasPermissions(['settings:notifications:write']);
  return (
    <SettingsCard
      title="Email notifications"
      description="Receive real-time notifications on email whenever a new case is created."
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
