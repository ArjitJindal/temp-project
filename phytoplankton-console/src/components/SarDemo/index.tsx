import { useState } from 'react';
import { Alert, Col, Row } from 'antd';
import Button from '../library/Button';
import Modal from '../ui/Modal';
import InputField from '../library/Form/InputField';
import Select from '../library/Select';
import Form from '../library/Form';
import SarReportDrawer from './SarReportDrawer';
import { PropertyListLayout } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import ErrorWarningFillIcon from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';

export function SarButton(props: { transactionIds: string[] }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  return (
    <>
      <Button type="TETRIARY" onClick={() => setIsModalVisible(true)}>
        Generate report
      </Button>
      <Modal
        title="Generate report"
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        okText="Generate"
        onOk={() => {
          setIsModalVisible(false);
          setIsDrawerVisible(true);
        }}
      >
        <Form initialValues={{} as any}>
          <PropertyListLayout>
            <InputField<any, any> name={'type'} label={'Select report type'}>
              {(inputProps) => (
                <Select
                  options={[
                    { label: 'SAR', value: 'SAR' },
                    { label: 'STR', value: 'STR' },
                  ]}
                  {...inputProps}
                />
              )}
            </InputField>
            <InputField<any, any> name={'jurisdiction'} label={'Select jurisdiction'}>
              {(inputProps) => (
                <Select
                  options={[
                    { label: 'United States', value: '1' },
                    { label: 'United Kingdom', value: '2' },
                    { label: 'Singapore', value: '3' },
                    { label: 'Republic of South Africa', value: '4' },
                  ]}
                  {...inputProps}
                />
              )}
            </InputField>
            <Alert
              style={{ marginTop: 10 }}
              description={
                <Row style={{ flexFlow: 'row' }}>
                  <Col>
                    <ErrorWarningFillIcon width={14} style={{ color: 'orange' }} />
                  </Col>
                  <Col style={{ paddingLeft: 5 }}>
                    A maximum of 20 transactions can be selected to file an STR/SAR. Please contact
                    Flagright if the limit needs to be increased.
                  </Col>
                </Row>
              }
              type="warning"
            />
          </PropertyListLayout>
        </Form>
      </Modal>
      <SarReportDrawer
        isVisible={isDrawerVisible}
        onChangeVisibility={setIsDrawerVisible}
        transactionIds={props.transactionIds}
      />
    </>
  );
}
