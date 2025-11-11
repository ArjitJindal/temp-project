import { COUNTRIES } from '@flagright/lib/constants';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useMemo, useState, useEffect, useRef } from 'react';
import s from './styles.module.less';
import { getSanctionsSearchTypeOptions } from './utils';
import SettingsCard from '@/components/library/SettingsCard';
import { getOr, isSuccess, isLoading as isAsyncLoading } from '@/utils/asyncResource';
import Filter from '@/components/library/Filter';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { GenericSanctionsSearchType } from '@/apis/models/GenericSanctionsSearchType';
import Button from '@/components/library/Button';
import { ENTITY_TYPE_OPTIONS } from '@/components/ScreeningHitTable';
import { sanitizeFuzziness } from '@/components/ScreeningHitTable/utils';
import {
  useDefaultManualScreeningFilters,
  useScreeningProfiles,
  useUpdateDefaultManualScreeningFilters,
} from '@/utils/api/screening';

type ScreeningProfileDefaultFiltersParams = {
  screeningProfileId?: string;
  yearOfBirthRange?: [string, string];
  fuzziness?: number;
  nationality?: string[];
  documentId?: string[];
  types?: GenericSanctionsSearchType[];
  entityType?: string;
};
const ScreeningProfileDefaultFilters = () => {
  const updateDefaultFiltersMutation = useUpdateDefaultManualScreeningFilters();
  const settings = useSettings();
  const hasSetDefaultFilters = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const [params, setParams] = useState<ScreeningProfileDefaultFiltersParams>({});

  const matchedTypeOptions = useMemo(() => {
    return getSanctionsSearchTypeOptions(
      settings?.features ?? [],
      settings?.sanctions?.providerScreeningTypes,
    );
  }, [settings]);

  const screeningProfileResult = useScreeningProfiles({ filterScreeningProfileStatus: 'ENABLED' });
  const defaultManualScreeningFilters = useDefaultManualScreeningFilters();

  useEffect(() => {
    if (isSuccess(defaultManualScreeningFilters.data)) {
      const defaultScreeningFilters = getOr(defaultManualScreeningFilters.data, null);
      if (defaultScreeningFilters) {
        const updatedParams: ScreeningProfileDefaultFiltersParams = {
          yearOfBirthRange:
            defaultScreeningFilters.yearOfBirthRange?.minYear &&
            defaultScreeningFilters.yearOfBirthRange.maxYear
              ? [
                  defaultScreeningFilters.yearOfBirthRange.minYear.toString(),
                  defaultScreeningFilters.yearOfBirthRange.maxYear.toString(),
                ]
              : undefined,
          fuzziness: sanitizeFuzziness(defaultScreeningFilters.fuzziness, 'hundred'),
          nationality: defaultScreeningFilters.nationality,
          documentId: defaultScreeningFilters.documentId,
          types: defaultScreeningFilters.types,
        };
        setParams(updatedParams);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultManualScreeningFilters.data.kind]);

  const handleSave = () => {
    setIsSaving(true);
    updateDefaultFiltersMutation.mutate(
      {
        DefaultManualScreeningFiltersRequest: {
          ...params,
          yearOfBirthRange: params.yearOfBirthRange
            ? {
                minYear: params.yearOfBirthRange[0]
                  ? parseInt(params.yearOfBirthRange[0])
                  : undefined,
                maxYear: params.yearOfBirthRange[1]
                  ? parseInt(params.yearOfBirthRange[1])
                  : undefined,
              }
            : undefined,
          fuzziness: sanitizeFuzziness(params.fuzziness, 'one'),
          documentId: params.documentId
            ? Array.isArray(params.documentId)
              ? params.documentId
              : [params.documentId]
            : undefined,
        },
      },
      {
        onSettled: () => setIsSaving(false),
      },
    );
  };

  useEffect(() => {
    if (hasSetDefaultFilters.current) {
      return;
    }
    if (isSuccess(defaultManualScreeningFilters.data)) {
      const defaultScreeningFilters = getOr(defaultManualScreeningFilters.data, {});
      if (defaultScreeningFilters) {
        const updatedParams: ScreeningProfileDefaultFiltersParams = {
          yearOfBirthRange:
            defaultScreeningFilters.yearOfBirthRange?.minYear &&
            defaultScreeningFilters.yearOfBirthRange.maxYear
              ? [
                  defaultScreeningFilters.yearOfBirthRange.minYear.toString(),
                  defaultScreeningFilters.yearOfBirthRange.maxYear.toString(),
                ]
              : undefined,
          fuzziness: sanitizeFuzziness(defaultScreeningFilters.fuzziness, 'hundred'),
          nationality: defaultScreeningFilters.nationality,
          documentId: defaultScreeningFilters.documentId,
          types: defaultScreeningFilters.types,
          entityType: defaultScreeningFilters.entityType,
        };
        hasSetDefaultFilters.current = true;
        setParams(updatedParams);
      }
    }
  }, [defaultManualScreeningFilters.data]);

  useEffect(() => {
    const screeningProfiles =
      getOr(screeningProfileResult.data, { items: [], total: 0 }).items || [];
    const defaultScreeningProfile = screeningProfiles.find((item) => item.isDefault);
    if (
      defaultScreeningProfile &&
      (!params.screeningProfileId ||
        params.screeningProfileId !== defaultScreeningProfile.screeningProfileId)
    ) {
      setParams((prev) => ({
        ...prev,
        screeningProfileId: defaultScreeningProfile.screeningProfileId,
      }));
    }
  }, [screeningProfileResult.data, params.screeningProfileId]);

  const screeningProfiles =
    getOr(screeningProfileResult.data, { items: [], total: 0 })?.items || [];
  const defaultScreeningProfile = screeningProfiles.find((item) => item.isDefault);

  const filters = [
    ...(defaultScreeningProfile
      ? [
          {
            title: 'Screening profile',
            key: 'screeningProfileId',
            pinFilterToLeft: true,
            readOnly: true,
            renderer: {
              kind: 'select',
              options: screeningProfiles.map((profile) => ({
                label: profile.screeningProfileName ?? '',
                value: profile.screeningProfileId ?? '',
              })),
              mode: 'SINGLE',
              displayMode: 'select',
            },
          },
        ]
      : []),
    {
      title: 'Year of birth',
      key: 'yearOfBirthRange',
      readOnly: false,
      renderer: {
        kind: 'dateRange',
        picker: 'year',
      },
    },
    {
      title: 'Fuzziness',
      description: '(The default value is 50%)',
      key: 'fuzziness',
      readOnly: false,
      renderer: {
        kind: 'number',
        displayFunction: (value) => {
          return `${value}%`;
        },
        displayAs: 'slider',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
      },
    },
    {
      title: 'Nationality',
      key: 'nationality',
      readOnly: false,
      renderer: {
        kind: 'select',
        options: Object.entries(COUNTRIES).map((entry) => ({ value: entry[0], label: entry[1] })),
        mode: 'MULTIPLE',
        displayMode: 'select',
      },
    },
    {
      title: 'Document ID',
      key: 'documentId',
      renderer: {
        kind: 'string',
        readOnly: false,
      },
    },
    {
      title: 'Matched type',
      key: 'types',
      readOnly: false,
      renderer: {
        kind: 'select',
        options: matchedTypeOptions.map((option) => ({
          label: humanizeAuto(option),
          value: option,
        })),
        mode: 'MULTIPLE',
        displayMode: 'select',
      },
    },
    {
      title: 'User type',
      key: 'entityType',
      renderer: {
        kind: 'select',
        options: ENTITY_TYPE_OPTIONS,
        mode: 'SINGLE',
        displayMode: 'select',
      },
    },
  ];

  return (
    <div className={s.defaultFiltersContainer}>
      <SettingsCard
        title="Manual screening default filters"
        minRequiredResources={['write:::settings/screening/screening-profile-default-filters/*']}
      >
        <div className={s.filtersContainer}>
          {filters.map((filter) => (
            <Filter
              key={filter.key}
              onChangeParams={(newParams) => {
                setParams({ ...params, ...newParams });
              }}
              onUpdateFilterClose={() => {}}
              filter={filter as any}
              readOnly={filter.readOnly}
              params={params}
            />
          ))}
          <div className={s.actionsContainer}>
            <Button
              type="PRIMARY"
              onClick={handleSave}
              isLoading={isSaving || isAsyncLoading(updateDefaultFiltersMutation.dataResource)}
            >
              Save
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

export default ScreeningProfileDefaultFilters;
