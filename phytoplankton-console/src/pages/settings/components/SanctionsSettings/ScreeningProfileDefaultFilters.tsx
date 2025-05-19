import { COUNTRIES } from '@flagright/lib/constants';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useMemo, useState, useEffect, useRef } from 'react';
import s from './styles.module.less';
import SettingsCard from '@/components/library/SettingsCard';
import { useQuery } from '@/utils/queries/hooks';
import { DEFAULT_MANUAL_SCREENING_FILTERS, SCREENING_PROFILES } from '@/utils/queries/keys';
import { useApi } from '@/api';
import Filter from '@/components/library/Filter';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ACURIS_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/AcurisSanctionsSearchType';
import { getOr, isSuccess } from '@/utils/asyncResource';
import { GenericSanctionsSearchType } from '@/apis/models/GenericSanctionsSearchType';
import { getErrorMessage } from '@/utils/lang';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';

type ScreeningProfileDefaultFiltersParams = {
  screeningProfileId?: string;
  yearOfBirth?: number;
  fuzziness?: number;
  nationality?: string[];
  documentId?: string[];
  types?: GenericSanctionsSearchType[];
};
const ScreeningProfileDefaultFilters = () => {
  const api = useApi();
  const settings = useSettings();
  const hasSetDefaultFilters = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const [params, setParams] = useState<ScreeningProfileDefaultFiltersParams>({});

  const matchedTypeOptions = useMemo(() => {
    return (
      settings?.sanctions?.providerScreeningTypes?.find((type) => type.provider === 'acuris')
        ?.screeningTypes ?? ACURIS_SANCTIONS_SEARCH_TYPES
    );
  }, [settings]);

  const screeningProfileResult = useQuery(
    SCREENING_PROFILES({ filterScreeningProfileStatus: 'ENABLED' }),
    async () => {
      try {
        const response = await api.getScreeningProfiles({
          filterScreeningProfileStatus: 'ENABLED',
        });
        const searchProfiles = response && response.items ? response.items : [];
        return {
          items: searchProfiles,
          total: searchProfiles.length,
        };
      } catch (error) {
        console.error(error);
        return {
          items: [],
          total: 0,
        };
      }
    },
  );

  const defaultManualScreeningFilters = useQuery(
    DEFAULT_MANUAL_SCREENING_FILTERS(),
    async () => {
      try {
        const response = await api.getDefaultManualScreeningFilters();
        if (response) {
          const updatedParams: ScreeningProfileDefaultFiltersParams = {
            yearOfBirth: response.yearOfBirth,
            fuzziness: response.fuzziness,
            nationality: response.nationality,
            documentId: response.documentId,
            types: response.types,
          };
          setParams(updatedParams);
        }
        return response;
      } catch (error) {
        console.error(error);
      }
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  );

  const handleSave = () => {
    setIsSaving(true);
    api
      .postDefaultManualScreeningFilters({ DefaultManualScreeningFiltersRequest: params })
      .then(() => {
        message.success('Default filters updated successfully');
      })
      .catch((error) => {
        message.error(`Failed to update default filters: ${getErrorMessage(error)}`);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  useEffect(() => {
    if (hasSetDefaultFilters.current) {
      return;
    }
    if (isSuccess(defaultManualScreeningFilters.data)) {
      const defaultScreeningFilters = getOr(defaultManualScreeningFilters.data, {});
      if (defaultScreeningFilters) {
        const updatedParams: ScreeningProfileDefaultFiltersParams = {
          yearOfBirth: defaultScreeningFilters.yearOfBirth,
          fuzziness: defaultScreeningFilters.fuzziness,
          nationality: defaultScreeningFilters.nationality,
          documentId: defaultScreeningFilters.documentId,
          types: defaultScreeningFilters.types,
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
      key: 'yearOfBirth',
      readOnly: false,
      renderer: {
        kind: 'year',
      },
    },
    {
      title: 'Fuzziness',
      description: '(The default value is 0.5)',
      key: 'fuzziness',
      readOnly: false,
      renderer: {
        kind: 'number',
        displayAs: 'slider',
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.5,
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
  ];

  return (
    <div className={s.defaultFiltersContainer}>
      <SettingsCard title="Manual screening default filters">
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
            <Button type="PRIMARY" onClick={handleSave} isLoading={isSaving}>
              Save
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

export default ScreeningProfileDefaultFilters;
