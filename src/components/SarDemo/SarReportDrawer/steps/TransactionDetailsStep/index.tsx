import { Col, Row, Tabs } from 'antd';
import { useState } from 'react';
import StepHeader from '../../StepHeader';
import s from './style.module.less';
import * as Card from '@/components/ui/Card';
import TextInput from '@/components/library/TextInput';
import { PropertyListLayout } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import TextArea from '@/components/library/TextArea';
import DatePicker from '@/components/ui/DatePicker';
import PageTabs from '@/components/ui/PageTabs';
import Select from '@/components/library/Select';
import COUNTRIES from '@/utils/countries';

export function TransactionDetailsStep(props: {
  activeTab: string;
  onChangeSenderType: () => void;
  onChangeReceiverType: () => void;
}) {
  return (
    <div className={s.root}>
      <TransactionDetails transactionId={props.activeTab} {...props} />
    </div>
  );
}

function TransactionDetails(props: {
  transactionId: string;
  onChangeSenderType: () => void;
  onChangeReceiverType: () => void;
}) {
  const [activeTab, setActiveTab] = useState('1');
  const [senderEntityType, setSenderEntityType] = useState<any>('Person');
  const [receiverEntityType, setReceiverEntityType] = useState<any>('Entity');

  return (
    <>
      <StepHeader
        title={'Transaction details'}
        description={'Filling the reporting entity information requested below.'}
      />
      <PageTabs
        isPrimary={false}
        type="card"
        destroyInactiveTabPane
        activeKey={activeTab}
        onChange={setActiveTab}
      >
        <Tabs.TabPane tab={`General information`} key="1">
          <PropertyListLayout>
            <Row>
              <Col span={12} style={{ paddingRight: 10 }}>
                <PropertyListLayout>
                  <InputField<any, any> name={'transactionId'} label={'Transaction number'}>
                    {(inputProps) => (
                      <TextInput {...inputProps} value={props.transactionId} isDisabled />
                    )}
                  </InputField>
                  <InputField<any, any> name={'transactionLocation'} label={'Transaction location'}>
                    {(inputProps) => <TextInput {...inputProps} isDisabled />}
                  </InputField>
                  <InputField<any, any> name={'transactionAmount'} label={'Transaction amount'}>
                    {(inputProps) => <TextInput {...inputProps} isDisabled />}
                  </InputField>
                </PropertyListLayout>
              </Col>
              <Col span={12} style={{ paddingLeft: 10 }}>
                <PropertyListLayout>
                  <InputField<any, any>
                    name={'internalReferenceNumber'}
                    label={'Internal reference number'}
                  >
                    {(inputProps) => <TextInput {...inputProps} isDisabled />}
                  </InputField>
                  <InputField<any, any> name={'transactionDate'} label={'Transaction date'}>
                    {(inputProps) => <DatePicker {...inputProps} disabled />}
                  </InputField>
                  <InputField<any, any> name={'transactionMode'} label={'Transaction mode'}>
                    {(inputProps) => <TextInput {...inputProps} isDisabled />}
                  </InputField>
                </PropertyListLayout>
              </Col>
            </Row>
            <InputField<any> name={'transactionModeComment'} label={'Transaction mode comment'}>
              {(inputProps) => <TextArea {...inputProps} />}
            </InputField>
            <InputField<any> name={'transactionDescription'} label={'Transaction description'}>
              {(inputProps) => <TextArea {...inputProps} />}
            </InputField>
          </PropertyListLayout>
        </Tabs.TabPane>
        <Tabs.TabPane tab={`Transaction sender`} key="2">
          <PropertyListLayout>
            <InputField<any, any> name={'senderType'} label={'Sender type'}>
              {(inputProps) => (
                <Select
                  options={[
                    { label: 'Person', value: 'Person' },
                    { label: 'Entity', value: 'Entity' },
                  ]}
                  {...inputProps}
                  value={senderEntityType}
                  onChange={(v) => {
                    setSenderEntityType(v);
                    props.onChangeSenderType();
                  }}
                />
              )}
            </InputField>
            {senderEntityType === 'Person' ? <PersonInfo /> : <EntityInfo />}
          </PropertyListLayout>
        </Tabs.TabPane>
        <Tabs.TabPane tab={`Transaction receiver`} key="3">
          <PropertyListLayout>
            <InputField<any, any> name={'receiverType'} label={'Receiver type'}>
              {(inputProps) => (
                <Select
                  options={[
                    { label: 'Person', value: 'Person' },
                    { label: 'Entity', value: 'Entity' },
                  ]}
                  {...inputProps}
                  value={receiverEntityType}
                  onChange={(v) => {
                    props.onChangeReceiverType();
                    setReceiverEntityType(v);
                  }}
                />
              )}
            </InputField>
            {receiverEntityType === 'Person' ? <PersonInfo /> : <EntityInfo />}
          </PropertyListLayout>
        </Tabs.TabPane>
      </PageTabs>
    </>
  );
}

function EntityInfo() {
  return (
    <>
      <Card.Root
        header={{
          title: `Entity details`,
        }}
      >
        <Card.Section>
          <Row>
            <Col span={12} style={{ paddingRight: 10 }}>
              <PropertyListLayout>
                <InputField<any, any> name={'transactionReceiverEntityName'} label={'Entity name'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any>
                  name={'transactionReceiverEntityLegalForm'}
                  label={'Incorporation legal form'}
                >
                  {(inputProps) => (
                    <Select
                      options={[
                        { label: 'UG', value: 'UB' },
                        { label: 'AG', value: 'AG' },
                        { label: 'KG', value: 'KG' },
                        { label: 'GmbH', value: 'GbmH' },
                      ]}
                      {...inputProps}
                    />
                  )}
                </InputField>
                <InputField<any, any>
                  name={'transactionReceiverEntityRegisterNumber'}
                  label={'Incorp. / Reg. number'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any>
                  name={'transactionReceiverEntityProvince'}
                  label={'Incorporation province / State'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionReceiverEntityEmail'} label={'Email'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
            <Col span={12} style={{ paddingLeft: 10 }}>
              <PropertyListLayout>
                <InputField<any>
                  name={'transactionReceiverEntityRegisterName'}
                  label={'Registered name'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionReceiverEntityBusiness'} label={'Business'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any>
                  name={'transactionReceiverEntityCreationDate'}
                  label={'Incorporation created date'}
                >
                  {(inputProps) => <DatePicker {...inputProps} />}
                </InputField>
                <InputField<any>
                  name={'transactionReceiverEntityCountry'}
                  label={'Incorporation country code'}
                >
                  {(inputProps) => (
                    <Select
                      options={Object.entries(COUNTRIES).map((entry) => ({
                        value: entry[0],
                        label: entry[1],
                      }))}
                      {...inputProps}
                    />
                  )}
                </InputField>
                <InputField<any> name={'transactionReceiverEntityLicence'} label={'Licence number'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
          </Row>
        </Card.Section>
      </Card.Root>
      <Card.Root
        header={{
          title: `Phone details`,
        }}
      >
        <Card.Section>
          <Row>
            <Col span={12} style={{ paddingRight: 10 }}>
              <PropertyListLayout>
                <InputField<any, any>
                  name={'transactionReceiverPhoneContactType'}
                  label={'Contact type'}
                >
                  {(inputProps) => (
                    <Select
                      options={[
                        { label: 'Landline', value: '1' },
                        { label: 'Mobile', value: '2' },
                      ]}
                      {...inputProps}
                    />
                  )}
                </InputField>
                <InputField<any, any>
                  name={'transactionReceiverPhoneCountryPrefix'}
                  label={'Country prefix'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any>
                  name={'transactionReceiverPhoneExtension'}
                  label={'Country prefix'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
            <Col span={12} style={{ paddingLeft: 10 }}>
              <PropertyListLayout>
                <InputField<any, any>
                  name={'transactionReceiverPhoneNumber'}
                  label={'Phone number'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any> name={'transactionReceiverPhoneComments'} label={'Comments'}>
                  {(inputProps) => <TextArea {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
          </Row>
        </Card.Section>
      </Card.Root>
      <Card.Root
        header={{
          title: `Address details`,
        }}
      >
        <Card.Section>
          <Row>
            <Col span={12} style={{ paddingRight: 10 }}>
              <PropertyListLayout>
                <InputField<any>
                  name={'transactionReceiverAddressAddressType'}
                  label={'Address type'}
                >
                  {(inputProps) => (
                    <Select
                      options={[
                        { label: 'Business', value: '1' },
                        { label: 'Consumer', value: '2' },
                      ]}
                      {...inputProps}
                      value={'1'}
                    />
                  )}
                </InputField>
                <InputField<any> name={'transactionReceiverAddressZipCode'} label={'Zip code'}>
                  {(inputProps) => <TextInput {...inputProps} placeholder={'Enter zip code'} />}
                </InputField>
                <InputField<any> name={'transactionReceiverAddressCity'} label={'City'}>
                  {(inputProps) => <TextInput {...inputProps} placeholder={'Enter city name'} />}
                </InputField>
              </PropertyListLayout>
            </Col>
            <Col span={12} style={{ paddingLeft: 10 }}>
              <PropertyListLayout>
                <InputField<any> name={'transactionReceiverAddressAddress'} label={'Address'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionReceiverAddressCountry'} label={'Country'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionReceiverAddressTown'} label={'Town'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
          </Row>
        </Card.Section>
      </Card.Root>
    </>
  );
}

function PersonInfo() {
  return (
    <>
      <Card.Root
        header={{
          title: `Person details`,
        }}
      >
        <Card.Section>
          <Row>
            <Col span={12} style={{ paddingRight: 10 }}>
              <PropertyListLayout>
                <InputField<any, any> name={'transactionSenderPersonTitle'} label={'Title'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any>
                  name={'transactionSenderPersonFirstName'}
                  label={'First name'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any>
                  name={'transactionSenderPersonMiddleName'}
                  label={'Middle name'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionSenderPersonBirthDate'} label={'Birth date'}>
                  {(inputProps) => <DatePicker {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
            <Col span={12} style={{ paddingLeft: 10 }}>
              <PropertyListLayout>
                <InputField<any, any> name={'transactionSenderPersonGener'} label={'Gender'}>
                  {(inputProps) => (
                    <Select
                      options={[
                        { label: 'Male', value: 'Male' },
                        { label: 'Female', value: 'Female' },
                      ]}
                      {...inputProps}
                    />
                  )}
                </InputField>
                <InputField<any, any> name={'transactionSenderPersonLastName'} label={'Last name'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any> name={'transactionSenderPersonPrefix'} label={'Prefix'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionSenderPersonBirthPlace'} label={'Birth place'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
          </Row>
        </Card.Section>
      </Card.Root>
      <Card.Root
        header={{
          title: `Phone details`,
        }}
      >
        <Card.Section>
          <Row>
            <Col span={12} style={{ paddingRight: 10 }}>
              <PropertyListLayout>
                <InputField<any, any>
                  name={'transactionSenderPhoneContactType'}
                  label={'Contact type'}
                >
                  {(inputProps) => (
                    <Select
                      options={[
                        { label: 'Landline', value: 'Landline' },
                        { label: 'Mobile', value: 'Mobile' },
                      ]}
                      {...inputProps}
                    />
                  )}
                </InputField>
                <InputField<any, any>
                  name={'transactionSenderPhoneCountryPrefix'}
                  label={'Country prefix'}
                >
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any> name={'transactionSenderPhoneExtension'} label={'Extension'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
            <Col span={12} style={{ paddingLeft: 10 }}>
              <PropertyListLayout>
                <InputField<any, any> name={'transactionSenderPhoneNumber'} label={'Phone number'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any, any> name={'transactionSenderPhoneComments'} label={'Comments'}>
                  {(inputProps) => <TextArea {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
          </Row>
        </Card.Section>
      </Card.Root>
      <Card.Root
        header={{
          title: `Address details`,
        }}
      >
        <Card.Section>
          <Row>
            <Col span={12} style={{ paddingRight: 10 }}>
              <PropertyListLayout>
                <InputField<any>
                  name={'transactionSenderAddressAddressType'}
                  label={'Address type'}
                >
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
                <InputField<any> name={'transactionSenderAddressZipCode'} label={'Zip code'}>
                  {(inputProps) => <TextInput {...inputProps} placeholder={'Enter zip code'} />}
                </InputField>
                <InputField<any> name={'transactionSenderAddressCity'} label={'City'}>
                  {(inputProps) => <TextInput {...inputProps} placeholder={'Enter city name'} />}
                </InputField>
              </PropertyListLayout>
            </Col>
            <Col span={12} style={{ paddingLeft: 10 }}>
              <PropertyListLayout>
                <InputField<any> name={'transactionSenderAddressAddress'} label={'Address'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionSenderAddressCountry'} label={'Country'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
                <InputField<any> name={'transactionSenderAddressTown'} label={'Town'}>
                  {(inputProps) => <TextInput {...inputProps} />}
                </InputField>
              </PropertyListLayout>
            </Col>
          </Row>
        </Card.Section>
      </Card.Root>
    </>
  );
}
