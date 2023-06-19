import { Col, Row, Space, Spin } from 'antd';
import { useCallback, useState } from 'react';
import StepHeader from '../../StepHeader';
import s from './style.module.less';
import TextInput from '@/components/library/TextInput';
import { PropertyListLayout } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import TextArea from '@/components/library/TextArea';
import DatePicker from '@/components/ui/DatePicker';
import LightBulbIcon from '@/components/ui/icons/Remix/others/lightbulb-line.react.svg';

const DEMO_AI_RESPONSE = `This SAR is being filed due to suspicious activity involving unexplained large cash deposits and potential structuring of transactions, indicating possible illicit financial behavior. The following details highlight the suspicious nature of the activities observed:

1. Unexplained Large Cash Deposits:
Over the past six months, the subject, {{ name }}, has made a series of unusually large cash deposits into his personal bank account. These deposits, each exceeding $10,000, are significantly higher than his usual deposit amounts. The sources of these funds remain unexplained and raise suspicions of illicit activities such as money laundering or unreported income.

2. Structuring of Transactions:
{{ name }} has also engaged in a pattern of structuring transactions by consistently making multiple cash deposits just below the $10,000 threshold that triggers the reporting requirement for the bank. This behavior suggests an attempt to evade reporting and conceal the true nature and extent of his financial transactions.

3. Inconsistent Business Activities:
Upon investigation, it was discovered that {{ name }} is self-employed and operates a small retail business. However, the reported income from his business does not align with the significant cash deposits made into his personal account. The lack of a legitimate explanation for the substantial influx of funds raises suspicions regarding the true source of these deposits.

4. Evasive Behavior:
During routine inquiries by bank personnel, {{ name }} exhibited evasive behavior, providing vague or inconsistent explanations for the origin of the cash deposits. His reluctance to provide transparent and verifiable information further contributes to the suspicion surrounding his financial activities.

5. Lack of Tangible Assets or Investments:
Despite the substantial cash deposits, there is no evidence of corresponding investments, significant purchases, or other substantial financial transactions associated with {{ name }}. The absence of a valid explanation for the large cash influx raises concerns regarding potential money laundering or undisclosed income.

Based on the aforementioned suspicious activity, there is reasonable suspicion that {{ name }} may be involved in illicit financial activities, such as money laundering or tax evasion. This report is being filed to notify the appropriate authorities and provide relevant information for further investigation into the matter.
`;

interface Props {
  activeTab: string;
  targetPersonName: string;
  onUpdateReportReason: (reason: string) => void;
}

export function GeneralDetailsStep(props: Props) {
  const { activeTab } = props;

  return (
    <div className={s.root}>
      {activeTab === 'report_details' ? (
        <ReportDetails {...props} />
      ) : activeTab === 'report_entity_details' ? (
        <ReportEntityDetails />
      ) : (
        <ReportPersonDetails />
      )}
    </div>
  );
}

function ReportDetails(props: Props) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const handleAiResponseClick = useCallback(() => {
    setIsAiLoading(true);
    setTimeout(() => {
      setIsAiLoading(false);
      props.onUpdateReportReason(DEMO_AI_RESPONSE.replaceAll('{{ name }}', props.targetPersonName));
    }, 3000);
  }, [props]);
  return (
    <>
      <StepHeader title={'Report details'} description={'Define the basic details of the report'} />
      <PropertyListLayout>
        <InputField<any> name={'reportName'} label={'Name'}>
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter report name'} />}
        </InputField>
        <InputField<any> name={'reportDescription'} label={'Description'}>
          {(inputProps) => <TextArea {...inputProps} placeholder={'Enter report description'} />}
        </InputField>
        <Row>
          <Col span={12} style={{ paddingRight: 10 }}>
            <PropertyListLayout>
              <InputField<any, any> name={'reportType'} label={'Type'}>
                {(inputProps) => (
                  <Select
                    options={[{ label: 'Suspicious Activity Report (SAR)', value: '1' }]}
                    {...inputProps}
                    value={'1'}
                    isDisabled={true}
                  />
                )}
              </InputField>
              <InputField<any, any> name={'submissionDate'} label={'Submission date'}>
                {(inputProps) => (
                  <Select
                    options={[{ label: dayjs().format(YEAR_MONTH_DATE_FORMAT), value: '1' }]}
                    {...inputProps}
                    value={'1'}
                    isDisabled={true}
                  />
                )}
              </InputField>
            </PropertyListLayout>
          </Col>
          <Col span={12} style={{ paddingLeft: 10 }}>
            <PropertyListLayout>
              <InputField<any, any> name={'submissionCode'} label={'Submission code'}>
                {(inputProps) => (
                  <Select
                    options={[{ label: 'Electronical', value: '1' }]}
                    {...inputProps}
                    value={'1'}
                    isDisabled={true}
                  />
                )}
              </InputField>
              <InputField<any, any>
                name={'fiu'}
                label={'FIU reference number - Optional'}
                labelProps={{ isOptional: true }}
              >
                {(inputProps) => (
                  <TextInput {...inputProps} placeholder={'Enter reference number'} />
                )}
              </InputField>
            </PropertyListLayout>
          </Col>
        </Row>
        <InputField<any>
          name={'reportReason'}
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Reporting reason</span>
              <a style={{ display: 'flex' }} onClick={handleAiResponseClick}>
                <Space>
                  {isAiLoading ? <Spin size="small" /> : <LightBulbIcon width={15} />} Ask AI
                  copilot
                </Space>
              </a>
            </div>
          }
        >
          {(inputProps) => (
            <TextArea
              {...inputProps}
              placeholder={
                'Enter reason for reporting or Use ‘Flagright AI’ to auto generate reason'
              }
              rows={10}
            />
          )}
        </InputField>
        <InputField<any> name={'actions'} label={'Actions taken'}>
          {(inputProps) => (
            <TextArea {...inputProps} placeholder={'Enter the actions taken'} rows={10} />
          )}
        </InputField>
      </PropertyListLayout>
    </>
  );
}

function ReportEntityDetails() {
  return (
    <>
      <StepHeader
        title={'Reporting entity details'}
        description={'Fill the reporting entity information requested below.'}
      />
      <PropertyListLayout>
        <InputField<any> name={'entityName'} label={'Entity name/ID'}>
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter entity name'} />}
        </InputField>
        <Row>
          <Col span={12} style={{ paddingRight: 10 }}>
            <PropertyListLayout>
              <InputField<any> name={'entityReference'} label={'Entity reference'}>
                {(inputProps) => (
                  <TextInput {...inputProps} placeholder={'Enter entity reference'} />
                )}
              </InputField>
              <InputField<any> name={'addressType'} label={'Address type'}>
                {(inputProps) => (
                  <Select
                    options={[
                      { label: 'Business', value: 'Business' },
                      { label: 'Consumer', value: 'Consumer' },
                    ]}
                    {...inputProps}
                  />
                )}
              </InputField>
              <InputField<any> name={'zipCode'} label={'Zip code'}>
                {(inputProps) => <TextInput {...inputProps} placeholder={'Enter zip code'} />}
              </InputField>
              <InputField<any> name={'city'} label={'City'}>
                {(inputProps) => <TextInput {...inputProps} placeholder={'Enter city name'} />}
              </InputField>
              <InputField<any> name={'country'} label={'Country'}>
                {(inputProps) => <TextInput {...inputProps} placeholder={'Enter country name'} />}
              </InputField>
            </PropertyListLayout>
          </Col>
          <Col span={12} style={{ paddingLeft: 10 }}>
            <PropertyListLayout>
              <InputField<any> name={'entityBranch'} label={'Entity branch'}>
                {(inputProps) => <TextInput {...inputProps} placeholder={'Enter brance name'} />}
              </InputField>
              <InputField<any> name={'address'} label={'Address'}>
                {(inputProps) => <TextInput {...inputProps} placeholder={'Enter address name'} />}
              </InputField>
              <InputField<any> name={'town'} label={'Town'}>
                {(inputProps) => <TextInput {...inputProps} placeholder={'Enter town name'} />}
              </InputField>
              <InputField<any> name={'stateProvince'} label={'State / Province'}>
                {(inputProps) => (
                  <TextInput {...inputProps} placeholder={'Enter state/province name'} />
                )}
              </InputField>
            </PropertyListLayout>
          </Col>
        </Row>
        <InputField<any> name={'comments'} label={'Comments'} labelProps={{ isOptional: true }}>
          {(inputProps) => <TextArea {...inputProps} />}
        </InputField>
      </PropertyListLayout>
    </>
  );
}

function ReportPersonDetails() {
  return (
    <>
      <StepHeader
        title={'Reporting person details'}
        description={'Fill the reporting person information requested below.'}
      />
      <PropertyListLayout>
        <Row>
          <Col span={12} style={{ paddingRight: 10 }}>
            <PropertyListLayout>
              <InputField<any> name={'firstName'} label={'First name'}>
                {(inputProps) => <TextInput {...inputProps} />}
              </InputField>
            </PropertyListLayout>
          </Col>
          <Col span={12} style={{ paddingLeft: 10 }}>
            <PropertyListLayout>
              <InputField<any> name={'lastName'} label={'Surname / Last name'}>
                {(inputProps) => <TextInput {...inputProps} />}
              </InputField>
            </PropertyListLayout>
          </Col>
        </Row>
        <InputField<any> name={'address'} label={'Address'}>
          {(inputProps) => <TextInput {...inputProps} />}
        </InputField>
        <Row>
          <Col span={12} style={{ paddingRight: 10 }}>
            <PropertyListLayout>
              <InputField<any> name={'birthDate'} label={'Birth date'}>
                {(inputProps) => <DatePicker {...inputProps} />}
              </InputField>
              <InputField<any> name={'idType'} label={'ID type'}>
                {(inputProps) => (
                  <Select
                    options={[
                      { label: 'Passport', value: 'Passport' },
                      { label: 'Foreign ID', value: 'Foreign ID' },
                      { label: 'Permit number', value: 'Permit number' },
                      { label: 'Refugee number', value: 'Refugee number' },
                      { label: 'Residence number', value: 'Residence number' },
                    ]}
                    {...inputProps}
                  />
                )}
              </InputField>
            </PropertyListLayout>
          </Col>
          <Col span={12} style={{ paddingLeft: 10 }}>
            <PropertyListLayout>
              <InputField<any> name={'ssn'} label={'Social security number (SSN)'}>
                {(inputProps) => <TextInput {...inputProps} />}
              </InputField>
              <InputField<any> name={'idNumber'} label={'ID number'}>
                {(inputProps) => <TextInput {...inputProps} />}
              </InputField>
            </PropertyListLayout>
          </Col>
        </Row>
        <InputField<any> name={'comments'} label={'Comments'} labelProps={{ isOptional: true }}>
          {(inputProps) => <TextArea {...inputProps} />}
        </InputField>
      </PropertyListLayout>
    </>
  );
}
