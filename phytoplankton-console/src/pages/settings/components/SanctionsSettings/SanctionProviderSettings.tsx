import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import Select from '@/components/library/Select';
import Label from '@/components/ui/Form/Layout/Label';
import SettingsCard from '@/components/library/SettingsCard';
import Button from '@/components/library/Button';
import { SANCTIONS_ENTITY_TYPES } from '@/apis/models-custom/SanctionsEntityType';
import { GenericSanctionsSearchType, SanctionsSettingsProviderScreeningTypes } from '@/apis';

type SanctionsProviderSettingsProps = {
  title: string;
  hasFeature: boolean;
  screeningTypes: SanctionsSettingsProviderScreeningTypes;
  searchTypes: GenericSanctionsSearchType[];
  onScreeningTypesChange: (values: SanctionsSettingsProviderScreeningTypes) => void;
  isLoading: boolean;
  onSave: (values: SanctionsSettingsProviderScreeningTypes) => void;
  isSanctionsEnabled: boolean;
  hasPermissions: boolean;
};

const SanctionsProviderSettings = (props: SanctionsProviderSettingsProps) => {
  const {
    title,
    hasFeature,
    screeningTypes,
    searchTypes,
    onScreeningTypesChange,
    isLoading,
    onSave,
    isSanctionsEnabled,
    hasPermissions,
  } = props;

  if (!hasFeature || !isSanctionsEnabled) {
    return null;
  }
  return (
    <SettingsCard
      title={`${title} settings`}
      minRequiredResources={['write:::settings/sanctions/screening-settings/*']}
    >
      <div className={s.sanctionsSettingsRoot}>
        <Label title={`Screening types for ${title}`} color="dark">
          <Select
            mode="TAGS"
            options={searchTypes.map((type) => ({
              label: humanizeAuto(type),
              value: type,
            }))}
            isDisabled={!hasPermissions}
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
            mode="TAGS"
            options={SANCTIONS_ENTITY_TYPES.map((type) => ({
              label: humanizeAuto(type),
              value: type,
            }))}
            isDisabled={!hasPermissions}
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
          isDisabled={isLoading || !hasPermissions}
        >
          Save
        </Button>
      </div>
    </SettingsCard>
  );
};

export default SanctionsProviderSettings;
