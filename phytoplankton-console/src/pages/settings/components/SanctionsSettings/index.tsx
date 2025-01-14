import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useFeatureEnabled,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import ComplyAdvantageLogo from '@/branding/Comply-Advantage-logo.svg';
import { message } from '@/components/library/Message';
import { getBranding } from '@/utils/branding';
import { downloadLink } from '@/utils/download-link';
import { useHasPermissions } from '@/utils/user-utils';
import SelectionGroup from '@/components/library/SelectionGroup';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';

export const SanctionsSettings = () => {
  const permissions = useHasPermissions(['settings:add-ons:read']);
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const branding = getBranding();

  const handleDownload = () => {
    message.success('Screening list download started');
    const downloadUrl =
      'https://phytoplankton-assets-sanctionslist.s3.eu-central-1.amazonaws.com/Data+Compliance+Overview+September+2024.xlsx';
    downloadLink(downloadUrl, 'SanctionsList-September-2024.xlsx');
  };
  const updateTenantSettingsMutation = useUpdateTenantSettings();

  const settings = useSettings();
  const hasFeatureAcuris = useFeatureEnabled('ACURIS');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const handleAcurisTypesChange = (values: string[] | undefined) => {
    updateTenantSettingsMutation.mutate({
      sanctions: {
        ...settings.sanctions,
        providerScreeningTypes: [
          ...(settings.sanctions?.providerScreeningTypes?.filter(
            (type) => type.provider !== 'acuris',
          ) || []),
          {
            provider: 'acuris',
            screeningTypes: values,
          },
        ],
      },
    });
  };
  const handleOpenSanctionsTypesChange = (values: string[] | undefined) => {
    updateTenantSettingsMutation.mutate({
      sanctions: {
        ...settings.sanctions,
        providerScreeningTypes: [
          ...(settings.sanctions?.providerScreeningTypes?.filter(
            (type) => type.provider !== 'open-sanctions',
          ) || []),
          {
            provider: 'open-sanctions',
            screeningTypes: values,
          },
        ],
      },
    });
  };
  return (
    <>
      {hasFeatureAcuris && isSanctionsEnabled ? (
        <SettingsCard
          title="Screening types for Acuris"
          description="Select screening types for Acuris."
        >
          <SelectionGroup
            mode="MULTIPLE"
            options={ACURIS_SANCTIONS_SEARCH_TYPES.map((type) => ({
              label: humanizeAuto(type),
              value: type,
            }))}
            isDisabled={updateTenantSettingsMutation.isLoading}
            onChange={handleAcurisTypesChange}
            value={
              settings.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'acuris')
                ?.screeningTypes || ACURIS_SANCTIONS_SEARCH_TYPES
            }
          />
        </SettingsCard>
      ) : (
        <></>
      )}
      {hasFeatureOpenSanctions && isSanctionsEnabled ? (
        <SettingsCard
          title="Screening types for Open Sanctions"
          description="Select screening types for Open Sanctions."
        >
          <SelectionGroup
            mode="MULTIPLE"
            options={OPEN_SANCTIONS_SEARCH_TYPES.map((type) => ({
              label: humanizeAuto(type),
              value: type,
            }))}
            onChange={handleOpenSanctionsTypesChange}
            isDisabled={updateTenantSettingsMutation.isLoading}
            value={
              settings.sanctions?.providerScreeningTypes?.find(
                (type) => type.provider === 'open-sanctions',
              )?.screeningTypes || OPEN_SANCTIONS_SEARCH_TYPES
            }
          />
        </SettingsCard>
      ) : (
        <></>
      )}
      <SettingsCard
        title={
          isSanctionsEnabled
            ? 'Sanctions list (as of 30th September 2024)'
            : 'Sanctions/PEP/Adverse media screening'
        }
        description={isSanctionsEnabled ? '' : 'Screen individuals and entities in a single API.'}
      >
        {isSanctionsEnabled && !hasFeatureAcuris ? (
          <>
            <div className={s.sanctionsModal}>
              <div className={s.sanctionsLayout}>
                <img src={ComplyAdvantageLogo} alt="Comply Advantage" />
              </div>
              <div className={s.sanctionsText}>
                ComplyAdvantage data provides a holistic solution to due diligence and compliance
                requirements. Their global data sources are continuously updated, reflecting the
                ever-changing risks to corporates and financial institutions in their dealings with
                global counterparties. The data includes millions of profiles on high-risk
                individuals and corporations worldwide.
              </div>
              <div className={s.sanctionsDownloadButton}>
                <Button
                  type="PRIMARY"
                  onClick={() => {
                    handleDownload();
                  }}
                  isDisabled={!permissions}
                >
                  Download List
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <a href={`mailto:${branding.supportEmail}`} className={s.sanctionsAccessButton}>
              <Button isDisabled={!permissions} type="PRIMARY">
                Request access
              </Button>
            </a>
          </>
        )}
      </SettingsCard>
    </>
  );
};
