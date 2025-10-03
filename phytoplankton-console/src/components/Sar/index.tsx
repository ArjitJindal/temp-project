import { useCallback, useMemo, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { uniqBy } from 'lodash';
import Button from '../library/Button';
import Select from '../library/Select';
import Label from '../library/Label';
import Alert from '@/components/library/Alert';
import Modal from '@/components/library/Modal';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import SarReportDrawer from '@/components/Sar/SarReportDrawer';
import { Report, ReportTypesResponse } from '@/apis';
import { useReportTypesAll } from '@/hooks/api';
import { useReportsDraftMutation } from '@/hooks/api/reports';
import { useCase } from '@/hooks/api/cases';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { ReportSubjectType } from '@/apis/models/ReportSubjectType';
import { Feature, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface CommonProps {
  alertIds?: string[];
  transactionIds?: string[];
  isDisabled?: boolean;
}

interface UserProps extends CommonProps {
  userId: string;
}

interface CaseProps extends CommonProps {
  caseId: string;
}

export function SarButton(props: UserProps | CaseProps) {
  const { alertIds, transactionIds, isDisabled } = props;
  const queryResult = useReportTypesAll();
  const reportsDraftMutation = useReportsDraftMutation();

  const caseQueryResult = useCase('caseId' in props ? props.caseId : '', {
    enabled: 'caseId' in props,
  });

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [country, setCountry] = useState<string>();
  const [reportTypeId, setReportTypeId] = useState<string>();

  const handleCountryChange = useCallback((country: string | undefined) => {
    setCountry(country);
  }, []);

  const handleReportTypeIdChange = useCallback((reportTypeId: string | undefined) => {
    setReportTypeId(reportTypeId);
  }, []);

  const draft = useMutation<Report, unknown, string>(
    async (reportTypeId) => {
      const res = await reportsDraftMutation.mutateAsync({
        reportTypeId,
        params: {
          ...('caseId' in props ? { caseId: props.caseId } : { userId: props.userId }),
          alertIds: alertIds ?? [],
          transactionIds: transactionIds ?? [],
        },
      });
      return res;
    },
    {
      onSuccess: () => {
        setIsModalVisible(false);
        setLoading(false);
      },
      onError: (error) => {
        message.fatal(`Failed to generate report draft! ${getErrorMessage(error)}`, error);
        setLoading(false);
      },
    },
  );

  let reportSubjectType: ReportSubjectType;
  if ('userId' in props) {
    reportSubjectType = 'USER';
  } else {
    reportSubjectType = 'CASE';
  }

  return (
    <Feature name="SAR">
      {reportSubjectType === 'USER' ? (
        // For user profiles - render button directly
        <Button
          type="TETRIARY"
          onClick={() => setIsModalVisible(true)}
          isDisabled={isDisabled}
          testName="sar-button"
          requiredResources={['write:::case-management/case-details/*']}
        >
          Generate SAR
        </Button>
      ) : (
        // For cases - check case data first
        <AsyncResourceRenderer resource={caseQueryResult.data}>
          {(caseItem) => {
            const noCaseUsers = !caseItem.caseUsers?.origin && !caseItem.caseUsers?.destination;

            return (
              <Button
                type="TETRIARY"
                onClick={() => setIsModalVisible(true)}
                isDisabled={noCaseUsers || isDisabled}
                testName="sar-button"
                requiredResources={['write:::case-management/case-details/*']}
              >
                Generate SAR
              </Button>
            );
          }}
        </AsyncResourceRenderer>
      )}
      <Modal
        title="Generate SAR"
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        okText="Generate"
        okProps={{
          isDisabled: !reportTypeId || isLoading,
        }}
        onOk={() => {
          if (reportTypeId) {
            setLoading(true);
            draft.mutate(reportTypeId);
          }
        }}
        writeResources={['write:::case-management/case-details/*']}
      >
        <AsyncResourceRenderer<ReportTypesResponse> resource={queryResult.data}>
          {(result) => {
            return (
              <SARProperties
                result={result}
                country={country}
                reportTypeId={reportTypeId}
                reportSubjectType={reportSubjectType}
                handleCountryChange={handleCountryChange}
                handleReportTypeIdChange={handleReportTypeIdChange}
              />
            );
          }}
        </AsyncResourceRenderer>
      </Modal>
      {draft.data && (
        <SarReportDrawer
          initialReport={draft.data}
          isVisible={!!draft.data}
          onChangeVisibility={() => draft.reset()}
        />
      )}
    </Feature>
  );
}

type SARPropertiesProps = {
  result: ReportTypesResponse;
  country: string | undefined;
  reportTypeId: string | undefined;
  reportSubjectType: ReportSubjectType;
  handleCountryChange: (c: string | undefined) => void;
  handleReportTypeIdChange: (r: string | undefined) => void;
};

const SARProperties = (props: SARPropertiesProps) => {
  const {
    result,
    country,
    reportTypeId,
    handleCountryChange,
    reportSubjectType,
    handleReportTypeIdChange,
  } = props;

  const settings = useSettings();

  const reportTypes = useMemo(() => {
    if (!settings.sarJurisdictions || settings.sarJurisdictions.length === 0) {
      return (result.data ?? []).filter((x) => {
        return x.subjectType?.includes(reportSubjectType);
      });
    }
    return (result.data ?? []).filter((x) => {
      if (settings.sarJurisdictions && !settings.sarJurisdictions.includes(x.countryCode)) {
        return false;
      }
      return x.subjectType?.includes(reportSubjectType);
    });
  }, [result.data, settings.sarJurisdictions, reportSubjectType]);

  const groupedReportTypes = useMemo(() => {
    return reportTypes.reduce((acc, r) => {
      acc[r.countryCode] = [...(acc[r.countryCode] ?? []), r];
      return acc;
    }, {} as Record<string, typeof reportTypes>);
  }, [reportTypes]);

  const countryList = useMemo(() => Object.keys(groupedReportTypes), [groupedReportTypes]);

  const handleSarCountrySelection = useCallback(
    (country: string) => {
      handleCountryChange(country);
      const countryReports = groupedReportTypes[country] ?? [];
      if (countryReports.length === 0) {
        handleReportTypeIdChange('');
        return;
      }
      handleReportTypeIdChange(countryReports[0].id);
    },
    [groupedReportTypes, handleCountryChange, handleReportTypeIdChange],
  );

  useEffect(() => {
    if (countryList.length === 1) {
      handleSarCountrySelection(countryList[0]);
    } else {
      handleSarCountrySelection('');
    }
  }, [countryList, handleSarCountrySelection]);

  return (
    <PropertyListLayout>
      <Label label={'Select Jurisdiction'} testId="sar-country-select" required>
        <Select
          value={country}
          options={uniqBy(
            reportTypes.map((s) => ({
              label: s.country,
              value: s.countryCode,
            })),
            'value',
          )}
          onChange={(country) => {
            if (country) {
              handleSarCountrySelection(country);
            }
          }}
        />
      </Label>
      {country && (
        <Label label={'Select report type'} testId="sar-report-type-select" required>
          <Select
            value={reportTypeId}
            options={reportTypes
              .filter((t) => t.countryCode == country)
              .map((type) => ({
                label: type.type,
                value: type.id,
                isDisabled: !type.implemented,
              }))}
            onChange={(reportTypeId) => {
              handleReportTypeIdChange(reportTypeId);
            }}
          />
        </Label>
      )}
      <Alert type="WARNING">
        A maximum of 30 transactions can be selected to file an STR/SAR. Please contact Flagright if
        the limit needs to be increased.
      </Alert>
    </PropertyListLayout>
  );
};
