import { useState } from 'react';
import { Alert, Col, Row } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { uniqBy } from 'lodash';
import Button from '../library/Button';
import Select from '../library/Select';
import Label from '../library/Label';
import Modal from '@/components/library/Modal';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import ErrorWarningFillIcon from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';
import { useApi } from '@/api';
import SarReportDrawer from '@/components/Sar/SarReportDrawer';
import { Report, ReportTypesResponse } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { REPORT_SCHEMAS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

export function SarButton({
  caseId,
  alertIds,
  transactionIds,
  isDisabled,
}: {
  caseId: string;
  alertIds: string[];
  transactionIds: string[];
  isDisabled?: boolean;
}) {
  const api = useApi();
  const queryResult = useQuery<ReportTypesResponse>(REPORT_SCHEMAS(), () => {
    return api.getReportTypes();
  });

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [country, setCountry] = useState<string>();
  const [reportTypeId, setReportTypeId] = useState<string>();

  const draft = useMutation<Report, unknown, string>(
    async (reportTypeId) => {
      return api.getReportsDraft({
        caseId,
        reportTypeId,
        alertIds,
        transactionIds,
      });
    },
    {
      onSuccess: () => setIsModalVisible(false),
      onError: (error) => {
        message.fatal(`Failed to generate report draft! ${getErrorMessage(error)}`, error);
      },
    },
  );

  return (
    <>
      <Button
        type="TETRIARY"
        onClick={() => setIsModalVisible(true)}
        isDisabled={isDisabled}
        testName="sar-button"
        requiredPermissions={['case-management:case-details:write']}
      >
        Generate report
      </Button>
      <Modal
        title="Generate report"
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        okText="Generate"
        okProps={{
          isDisabled: !reportTypeId,
        }}
        onOk={() => {
          if (reportTypeId) {
            draft.mutate(reportTypeId);
          }
        }}
        writePermissions={['case-management:case-details:write']}
      >
        <AsyncResourceRenderer<ReportTypesResponse> resource={queryResult.data}>
          {(result) => (
            <PropertyListLayout>
              <Label label={'Select Jurisdiction'} testId="sar-country-select">
                <Select
                  value={country}
                  options={uniqBy(
                    result.data?.map((s) => {
                      return {
                        label: s.country,
                        value: s.countryCode,
                      };
                    }),
                    'value',
                  )}
                  onChange={(country) => {
                    setCountry(country);
                  }}
                />
              </Label>
              {country && (
                <Label label={'Select report type'} testId="sar-report-type-select">
                  <Select
                    value={reportTypeId}
                    options={result.data
                      ?.filter((t) => t.countryCode == country)
                      .map((type) => ({
                        label: type.type,
                        value: type.id,
                        isDisabled: !type.implemented,
                      }))}
                    onChange={(reportTypeId) => {
                      setReportTypeId(reportTypeId);
                    }}
                  />
                </Label>
              )}
              <Alert
                style={{ marginTop: 10 }}
                description={
                  <Row style={{ flexFlow: 'row' }}>
                    <Col>
                      <ErrorWarningFillIcon width={14} style={{ color: 'orange' }} />
                    </Col>
                    <Col style={{ paddingLeft: 5 }}>
                      A maximum of 20 transactions can be selected to file an STR/SAR. Please
                      contact Flagright if the limit needs to be increased.
                    </Col>
                  </Row>
                }
                type="warning"
              />
            </PropertyListLayout>
          )}
        </AsyncResourceRenderer>
      </Modal>
      {draft.data && (
        <SarReportDrawer
          initialReport={draft.data}
          isVisible={!!draft.data}
          onChangeVisibility={() => draft.reset()}
        />
      )}
    </>
  );
}
