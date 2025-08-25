import { useState } from 'react';
import KYC6Logo from 'src/branding/KYC6.svg';
import s from './styles.module.less';
import SearchProfileList from './SearchProfileList';
import { ScreeningProfileList } from './ScreeningProfileList';
import SanctionsProviderSettings from './SanctionProviderSettings';
import ScreeningProfileDefaultFilters from './ScreeningProfileDefaultFilters';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useFeatureEnabled,
  useHasNoSanctionsProviders,
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import ComplyAdvantageLogo from '@/branding/Comply-Advantage-logo.svg';
import { message } from '@/components/library/Message';
import { getBranding } from '@/utils/branding';
import { downloadLink } from '@/utils/download-link';
import { useHasResources } from '@/utils/user-utils';
import { SanctionsSettingsProviderScreeningTypes } from '@/apis/models/SanctionsSettingsProviderScreeningTypes';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { SANCTIONS_ENTITY_TYPES } from '@/apis/models-custom/SanctionsEntityType';
import { SanctionsDataProviderName } from '@/apis';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';
import { SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/SanctionsSearchType';

export const SanctionsSettings = () => {
  const screeningPermissions = useHasResources([
    'read:::settings/screening/*',
    'write:::settings/screening/*',
  ]);
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const isAcurisEnabled = useFeatureEnabled('ACURIS');
  const isDowJonesEnabled = useFeatureEnabled('DOW_JONES');
  const hasFeatureOpenSanctions = useFeatureEnabled('OPEN_SANCTIONS');
  const isScreeningProfilesEnabled = isAcurisEnabled || isDowJonesEnabled;
  const branding = getBranding();
  const hasNoSanctionsProviders = useHasNoSanctionsProviders();

  const handleDownload = () => {
    message.info('Screening list download started');
    const downloadUrl =
      'https://phytoplankton-assets-sanctionslist.s3.eu-central-1.amazonaws.com/Data+Compliance+Overview+September+2024.xlsx';
    downloadLink(downloadUrl, 'SanctionsList-September-2024.xlsx');
  };

  const handleKYC6Download = () => {
    message.info('KYC6 download started');

    const downloadUrl1 =
      'https://phytoplankton-assets-sanctionslist.s3.eu-central-1.amazonaws.com/Acuris_Risk_Intelligence_May.zip';
    downloadLink(downloadUrl1, 'Acuris_Risk_Intelligence.zip');
  };

  const updateTenantSettingsMutation = useUpdateTenantSettings();

  const settings = useSettings();
  const hasFeatureComplyAdvantage =
    isSanctionsEnabled && !isScreeningProfilesEnabled && !hasFeatureOpenSanctions;
  const getSettings = (
    provider: SanctionsDataProviderName,
    defaultScreeningTypes,
    defaultEntityTypes,
  ) => {
    return {
      provider,
      screeningTypes:
        settings.sanctions?.providerScreeningTypes?.find((type) => type.provider === provider)
          ?.screeningTypes || defaultScreeningTypes,
      entityTypes:
        settings.sanctions?.providerScreeningTypes?.find((type) => type.provider === provider)
          ?.entityTypes || defaultEntityTypes,
    };
  };
  const [acurisScreeningTypes, setAcurisScreeningTypes] =
    useState<SanctionsSettingsProviderScreeningTypes>(
      getSettings('acuris', ACURIS_SANCTIONS_SEARCH_TYPES, SANCTIONS_ENTITY_TYPES),
    );
  const [openSanctionsScreeningTypes, setOpenSanctionsScreeningTypes] =
    useState<SanctionsSettingsProviderScreeningTypes>(
      getSettings('open-sanctions', OPEN_SANCTIONS_SEARCH_TYPES, SANCTIONS_ENTITY_TYPES),
    );

  const [dowJonesScreeningTypes, setDowJonesScreeningTypes] =
    useState<SanctionsSettingsProviderScreeningTypes>(
      getSettings('dowjones', DOW_JONES_SANCTIONS_SEARCH_TYPES, SANCTIONS_ENTITY_TYPES),
    );

  const [complyAdvantageScreeningTypes, setComplyAdvantageScreeningTypes] =
    useState<SanctionsSettingsProviderScreeningTypes>(
      getSettings('comply-advantage', SANCTIONS_SEARCH_TYPES, SANCTIONS_ENTITY_TYPES),
    );

  const handleTypesChange = (value: SanctionsSettingsProviderScreeningTypes) => {
    updateTenantSettingsMutation.mutate({
      sanctions: {
        ...settings.sanctions,
        providerScreeningTypes: [
          ...(settings.sanctions?.providerScreeningTypes?.filter(
            (type) => type.provider !== value.provider,
          ) || []),
          value,
        ],
      },
    });
  };
  return (
    <>
      {isScreeningProfilesEnabled ? (
        <>
          <ScreeningProfileList hasFeature={isSanctionsEnabled} />
          <ScreeningProfileDefaultFilters />
        </>
      ) : (
        <SearchProfileList hasFeature={isSanctionsEnabled} />
      )}
      <SanctionsProviderSettings
        title="KYC6"
        hasFeature={isAcurisEnabled}
        screeningTypes={acurisScreeningTypes}
        searchTypes={ACURIS_SANCTIONS_SEARCH_TYPES}
        onScreeningTypesChange={setAcurisScreeningTypes}
        isLoading={updateTenantSettingsMutation.isLoading}
        onSave={handleTypesChange}
        isSanctionsEnabled={isSanctionsEnabled}
        hasPermissions={screeningPermissions}
      />

      <SanctionsProviderSettings
        title="Open Sanctions"
        hasFeature={hasFeatureOpenSanctions}
        screeningTypes={openSanctionsScreeningTypes}
        searchTypes={OPEN_SANCTIONS_SEARCH_TYPES}
        onScreeningTypesChange={setOpenSanctionsScreeningTypes}
        isLoading={updateTenantSettingsMutation.isLoading}
        onSave={handleTypesChange}
        isSanctionsEnabled={isSanctionsEnabled}
        hasPermissions={screeningPermissions}
      />

      <SanctionsProviderSettings
        title="Dow Jones"
        hasFeature={isDowJonesEnabled}
        screeningTypes={dowJonesScreeningTypes}
        searchTypes={DOW_JONES_SANCTIONS_SEARCH_TYPES}
        onScreeningTypesChange={setDowJonesScreeningTypes}
        isLoading={updateTenantSettingsMutation.isLoading}
        onSave={handleTypesChange}
        isSanctionsEnabled={isSanctionsEnabled}
        hasPermissions={screeningPermissions}
      />

      <SanctionsProviderSettings
        title="Comply Advantage"
        hasFeature={hasFeatureComplyAdvantage}
        screeningTypes={complyAdvantageScreeningTypes}
        searchTypes={SANCTIONS_SEARCH_TYPES}
        onScreeningTypesChange={setComplyAdvantageScreeningTypes}
        isLoading={updateTenantSettingsMutation.isLoading}
        onSave={handleTypesChange}
        isSanctionsEnabled={isSanctionsEnabled}
        hasPermissions={screeningPermissions}
      />
      <SettingsCard
        title={
          isSanctionsEnabled
            ? 'Screening Sources (as of May 2025)'
            : 'Sanctions/PEP/Adverse media screening'
        }
        description={isSanctionsEnabled ? '' : 'Screen individuals and entities in a single API.'}
        minRequiredResources={['read:::settings/screening/screening-sources/*']}
      >
        {isSanctionsEnabled && hasNoSanctionsProviders ? (
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
                  isDisabled={!isSanctionsEnabled}
                >
                  Download List
                </Button>
              </div>
            </div>
          </>
        ) : isAcurisEnabled ? (
          <div className={s.sanctionsModal}>
            <div className={s.sanctionsLayout}>
              <img src={KYC6Logo} alt="KYC6" style={{ height: '40px', width: 'auto' }} />
            </div>
            <div className={s.sanctionsText}>
              KYC6 provides a comprehensive dataset for screening, due diligence, and compliance
              requirements. Their global data sources are continuously updated to reflect the
              evolving risks faced by corporations and financial institutions when dealing with
              global counterparties. The dataset includes millions of profiles on high-risk
              individuals and corporations worldwide.
            </div>
            <div className={s.sanctionsDownloadButton}>
              <Button
                type="PRIMARY"
                onClick={() => {
                  handleKYC6Download();
                }}
                isDisabled={!isSanctionsEnabled}
              >
                Download List
              </Button>
            </div>
          </div>
        ) : (
          <>
            <a href={`mailto:${branding.supportEmail}`} className={s.sanctionsAccessButton}>
              <Button isDisabled={!isSanctionsEnabled} type="PRIMARY">
                Request access
              </Button>
            </a>
          </>
        )}
      </SettingsCard>
    </>
  );
};
