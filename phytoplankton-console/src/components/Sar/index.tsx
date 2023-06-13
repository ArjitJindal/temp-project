import { useState } from 'react';
import { Alert, Col, Row } from 'antd';
import _ from 'lodash';
import Button from '../library/Button';
import Modal from '../ui/Modal';
import Select from '../library/Select';
import Label from '../library/Label';
import { PropertyListLayout } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import ErrorWarningFillIcon from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';
import { useApi } from '@/api';
import SarReportDrawer from '@/components/Sar/SarReportDrawer';
import { ReportSchema, ReportSchemasResponse } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { REPORT_SCHEMAS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
export function SarButton({
  caseId,
  transactionIds,
}: {
  caseId: string;
  transactionIds: string[];
}) {
  const api = useApi();
  const queryResult = useQuery<ReportSchemasResponse>(REPORT_SCHEMAS(), () => {
    return api.getReportSchemas();
  });

  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [reportType, setReportType] = useState<string>();
  const [schemaId, setSchemaId] = useState<string>();

  return (
    <>
      <Button type="TETRIARY" onClick={() => setIsModalVisible(true)}>
        Generate report
      </Button>
      <AsyncResourceRenderer<ReportSchemasResponse> resource={queryResult.data}>
        {(result) => (
          <>
            <Modal
              title="Generate report"
              isOpen={isModalVisible}
              onCancel={() => setIsModalVisible(false)}
              okText="Generate"
              okProps={{
                disabled: !schemaId,
              }}
              onOk={() => {
                setIsDrawerVisible(true);
                setIsModalVisible(false);
              }}
            >
              <PropertyListLayout>
                <Label label={'Select report type'}>
                  <Select
                    value={reportType}
                    options={_.uniq(result.data?.map((rs) => rs.type)).map((type) => ({
                      label: type,
                      value: type as string,
                    }))}
                    onChange={setReportType}
                  />
                </Label>
                {reportType && (
                  <Label label={'Select Jurisdiction'}>
                    <Select
                      value={schemaId}
                      options={result.data
                        ?.filter((r) => r.type == reportType)
                        .map((s: ReportSchema) => {
                          return {
                            label: s.country,
                            value: s.id as string,
                          };
                        })}
                      onChange={(schemaId) => {
                        setSchemaId(schemaId);
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
            </Modal>
            <SarReportDrawer
              caseId={caseId}
              schemaId={schemaId as string}
              transactionIds={transactionIds}
              isVisible={isDrawerVisible}
              onChangeVisibility={setIsDrawerVisible}
            />
          </>
        )}
      </AsyncResourceRenderer>
    </>
  );
}
