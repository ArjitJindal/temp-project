import SettingsCard from './SettingsCard';
import Button from '@/components/library/Button';
import { getBranding } from '@/utils/branding';

const branding = getBranding();

export const ProfessionalServicesSettings = () => {
  return (
    <SettingsCard
      title="Professional services"
      description="Tailored solutions for AML program design, audit, BaaS onboarding support, MLRO hiring assistance and fintech licensing."
    >
      <div>
        <a href={`mailto:${branding.supportEmail}`}>
          <Button type="PRIMARY">Request access</Button>
        </a>
      </div>
    </SettingsCard>
  );
};
