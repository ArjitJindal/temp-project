import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useState } from 'react';
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
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { OPEN_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/OpenSanctionsSearchType';
import Select from '@/components/library/Select';
import Label from '@/components/ui/Form/Layout/Label';
import { SanctionsSettingsProviderScreeningTypes } from '@/apis/models/SanctionsSettingsProviderScreeningTypes';
import { SANCTIONS_ENTITY_TYPES } from '@/apis/models-custom/SanctionsEntityType';

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
  const getSettings = (
    provider: 'acuris' | 'open-sanctions',
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
      {hasFeatureAcuris && isSanctionsEnabled ? (
        <SettingsCard title="Acuris settings">
          <div className={s.sanctionsSettingsRoot}>
            <Label title="Screening types for Acuris" color="dark">
              <Select
                mode="MULTIPLE"
                options={ACURIS_SANCTIONS_SEARCH_TYPES.map((type) => ({
                  label: humanizeAuto(type),
                  value: type,
                }))}
                onChange={(values) =>
                  setAcurisScreeningTypes({
                    ...acurisScreeningTypes,
                    screeningTypes: values ?? [],
                  })
                }
                value={acurisScreeningTypes.screeningTypes}
              />
            </Label>
            <Label title="Required entities data" color="dark">
              <Select
                mode="MULTIPLE"
                options={SANCTIONS_ENTITY_TYPES.map((type) => ({
                  label: humanizeAuto(type),
                  value: type,
                }))}
                onChange={(values) =>
                  setAcurisScreeningTypes({
                    ...acurisScreeningTypes,
                    entityTypes: values ?? [],
                  })
                }
                value={acurisScreeningTypes.entityTypes}
              />
            </Label>
            <Button
              type="PRIMARY"
              onClick={() => handleTypesChange(acurisScreeningTypes)}
              className={s.sanctionsSettingsButton}
              isDisabled={updateTenantSettingsMutation.isLoading}
            >
              Save
            </Button>
          </div>
        </SettingsCard>
      ) : (
        <></>
      )}
      {hasFeatureOpenSanctions && isSanctionsEnabled ? (
        <SettingsCard title="Open Sanctions settings">
          <div className={s.sanctionsSettingsRoot}>
            <Label title="Screening types for Open Sanctions" color="dark">
              <Select
                mode="MULTIPLE"
                options={OPEN_SANCTIONS_SEARCH_TYPES.map((type) => ({
                  label: humanizeAuto(type),
                  value: type,
                }))}
                onChange={(values) =>
                  setOpenSanctionsScreeningTypes({
                    ...openSanctionsScreeningTypes,
                    screeningTypes: values ?? [],
                  })
                }
                value={openSanctionsScreeningTypes.screeningTypes}
              />
            </Label>
            <Label title="Required entities data" color="dark">
              <Select
                mode="MULTIPLE"
                options={SANCTIONS_ENTITY_TYPES.map((type) => ({
                  label: humanizeAuto(type),
                  value: type,
                }))}
                onChange={(values) =>
                  setOpenSanctionsScreeningTypes({
                    ...openSanctionsScreeningTypes,
                    entityTypes: values ?? [],
                  })
                }
                value={openSanctionsScreeningTypes.entityTypes}
              />
            </Label>
            <Button
              type="PRIMARY"
              onClick={() => handleTypesChange(openSanctionsScreeningTypes)}
              className={s.sanctionsSettingsButton}
              isDisabled={updateTenantSettingsMutation.isLoading}
            >
              Save
            </Button>
          </div>
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
