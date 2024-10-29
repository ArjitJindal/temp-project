import SettingsCard from '@/components/library/SettingsCard';
import Button from '@/components/library/Button';
import { getBranding } from '@/utils/branding';

const branding = getBranding();

export const EmailNotificationsSettings = () => {
  return (
    <SettingsCard
      title="Email notifications"
      description="Receive real-time notifications on email whenever a new case is created."
    >
      <div>
        <a href={`mailto:${branding.supportEmail}`}>
          <Button type="PRIMARY">Request access</Button>
        </a>
      </div>
    </SettingsCard>
  );
};
