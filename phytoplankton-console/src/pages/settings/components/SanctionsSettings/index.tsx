import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useState } from 'react';
import s from './styles.module.less';
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
import { isSuperAdmin, useAuth0User, useHasPermissions } from '@/utils/user-utils';
import Select from '@/components/library/Select';
import Label from '@/components/ui/Form/Layout/Label';
import { SanctionsSettingsProviderScreeningTypes } from '@/apis/models/SanctionsSettingsProviderScreeningTypes';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { SANCTIONS_ENTITY_TYPES } from '@/apis/models-custom/SanctionsEntityType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import { SanctionsDataProviderName } from '@/apis';
import { DOW_JONES_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/DowJonesSanctionsSearchType';

export const SanctionsSettings = () => {
  const permissions = useHasPermissions(['settings:add-ons:read']);
  const user = useAuth0User();
  const superAdmin = isSuperAdmin(user);
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const branding = getBranding();
  const hasNoSanctionsProviders = useHasNoSanctionsProviders();

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
  const hasFeatureDowJones = useFeatureEnabled('DOW_JONES');
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
      <SanctionsProviderSettings
        title="Acuris"
        hasFeature={hasFeatureAcuris}
        screeningTypes={acurisScreeningTypes}
        searchTypes={ACURIS_SANCTIONS_SEARCH_TYPES}
        onScreeningTypesChange={setAcurisScreeningTypes}
        isLoading={updateTenantSettingsMutation.isLoading}
        isSuperAdmin={superAdmin}
        onSave={handleTypesChange}
        isSanctionsEnabled={isSanctionsEnabled}
      />

      <SanctionsProviderSettings
        title="Open Sanctions"
        hasFeature={hasFeatureOpenSanctions}
        screeningTypes={openSanctionsScreeningTypes}
        searchTypes={OPEN_SANCTIONS_SEARCH_TYPES}
        onScreeningTypesChange={setOpenSanctionsScreeningTypes}
        isLoading={updateTenantSettingsMutation.isLoading}
        isSuperAdmin={superAdmin}
        onSave={handleTypesChange}
        isSanctionsEnabled={isSanctionsEnabled}
      />

      <SanctionsProviderSettings
        title="Dow Jones"
        hasFeature={hasFeatureDowJones}
        screeningTypes={dowJonesScreeningTypes}
        searchTypes={DOW_JONES_SANCTIONS_SEARCH_TYPES}
        onScreeningTypesChange={setDowJonesScreeningTypes}
        isLoading={updateTenantSettingsMutation.isLoading}
        isSuperAdmin={superAdmin}
        onSave={handleTypesChange}
        isSanctionsEnabled={isSanctionsEnabled}
      />
      <SettingsCard
        title={
          isSanctionsEnabled
            ? 'Sanctions list (as of 30th September 2024)'
            : 'Sanctions/PEP/Adverse media screening'
        }
        description={isSanctionsEnabled ? '' : 'Screen individuals and entities in a single API.'}
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

const SanctionsProviderSettings = ({
  title,
  hasFeature,
  screeningTypes,
  searchTypes,
  onScreeningTypesChange,
  isLoading,
  isSuperAdmin,
  onSave,
  isSanctionsEnabled,
}) => {
  if (!hasFeature || !isSanctionsEnabled) {
    return null;
  }

  return (
    <SettingsCard title={`${title} settings`}>
      <div className={s.sanctionsSettingsRoot}>
        <Label title={`Screening types for ${title}`} color="dark">
          <Select
            mode="MULTIPLE"
            options={searchTypes.map((type) => ({
              label: humanizeAuto(type),
              value: type,
            }))}
            isDisabled={!isSuperAdmin}
            onChange={(values) =>
              onScreeningTypesChange({
                screeningTypes: values ?? [],
                entityTypes: screeningTypes.entityTypes,
                provider: screeningTypes.provider,
              })
            }
            value={screeningTypes.screeningTypes}
          />
        </Label>
        <Label title="Required entities data" color="dark">
          <Select
            mode="MULTIPLE"
            options={SANCTIONS_ENTITY_TYPES.map((type) => ({
              label: humanizeAuto(type),
              value: type,
            }))}
            isDisabled={!isSuperAdmin}
            onChange={(values) =>
              onScreeningTypesChange({
                screeningTypes: screeningTypes.screeningTypes,
                entityTypes: values ?? [],
                provider: screeningTypes.provider,
              })
            }
            value={screeningTypes.entityTypes}
          />
        </Label>
        <Button
          type="PRIMARY"
          onClick={() => onSave(screeningTypes)}
          className={s.sanctionsSettingsButton}
          isDisabled={isLoading || !isSuperAdmin}
        >
          Save
        </Button>
      </div>
    </SettingsCard>
  );
};
