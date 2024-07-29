import s from './styles.module.less';
import SettingsCard from '@/components/library/SettingsCard';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import ComplyAdvantageLogo from '@/branding/Comply-Advantage-logo.svg';
import { message } from '@/components/library/Message';
import { getBranding } from '@/utils/branding';
import { downloadLink } from '@/utils/download-link';

export const SanctionsSettings = () => {
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const branding = getBranding();

  const handleDownload = () => {
    message.success('Screening list download started');
    const downloadUrl =
      'https://phytoplankton-assets-sanctionslist.s3.eu-central-1.amazonaws.com/Data+Compliance+Overview+February+2024.xlsx';
    downloadLink(downloadUrl, 'SanctionsList-February-2024.xlsx');
  };
  return (
    <SettingsCard
      title={
        isSanctionsEnabled
          ? 'Sanctions list (as of 29th February 2024)'
          : 'Sanctions/PEP/Adverse media screening'
      }
      description={isSanctionsEnabled ? '' : 'Screen individuals and entities in a single API.'}
    >
      {isSanctionsEnabled ? (
        <>
          <div className={s.sanctionsModal}>
            <div className={s.sanctionsLayout}>
              <img src={ComplyAdvantageLogo} alt="Comply Advantage" />
            </div>
            <div className={s.sanctionsText}>
              ComplyAdvantage data provides a holistic solution to due diligence and compliance
              requirements. Their global data sources are continuously updated, reflecting the
              ever-changing risks to corporates and financial institutions in their dealings with
              global counterparties. The data includes millions of profiles on high-risk individuals
              and corporations worldwide.
            </div>
            <div className={s.sanctionsDownloadButton}>
              <Button
                type="PRIMARY"
                onClick={() => {
                  handleDownload();
                }}
              >
                Download List
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <a href={`mailto:${branding.supportEmail}`} className={s.sanctionsAccessButton}>
            <Button type="PRIMARY">Request access</Button>
          </a>
        </>
      )}
    </SettingsCard>
  );
};
