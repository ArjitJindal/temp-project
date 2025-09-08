import { useRef, useState } from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import { RiskFactorSampleDetails } from '@/apis/models/RiskFactorSampleDetails';
import { SimulationRiskFactorsSampling } from '@/apis/models/SimulationRiskFactorsSampling';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ExpandContentButton } from '@/components/library/ExpandContentButton';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import NestedForm from '@/components/library/Form/NestedForm';
import { NumberRangeInput } from '@/components/library/JsonSchemaEditor/Property/PropertyInput/custom/NumberRangeInput';
import Modal from '@/components/library/Modal';
import NumberInput from '@/components/library/NumberInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import Slider from '@/components/library/Slider';
import TextInput from '@/components/library/TextInput';
import RiskAlgorithmsSelector, {
  RiskScoringCraAlgorithm,
} from '@/pages/settings/components/RiskAlgorithmsCra/RiskAlgorithmsSelector';
import { useId } from '@/utils/hooks';
import Label from '@/components/library/Label';
import Select from '@/components/library/Select';
import { getOr, isLoading } from '@/utils/asyncResource';
import { useUserLists } from '@/utils/queries/hooks';
import * as Card from '@/components/ui/Card';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { P } from '@/components/ui/Typography';
import Button from '@/components/library/Button';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { message } from '@/components/library/Message';
import UserIdsSelect from '@/components/UserIdsSelect';
import TransactionIdsSelect from '@/components/TransactionIdsSelect';
export interface FormValues {
  name: string;
  description: string;
  samplingType: SimulationRiskFactorsSampling['sample']['type'];
  sampleDetails: RiskFactorSampleDetails;
  riskAlgorithm?: RiskScoringCraAlgorithm;
}
interface FormProps {
  allIterations: FormValues[];
  currentIterationIndex: number;
  onChangeIterationInfo: (iteration: FormValues) => void;
  isVisible: boolean;
  onDuplicate: () => void;
  setIsVisible: (val: boolean) => void;
}

export const RiskFactorsSimulationForm = (props: FormProps) => {
  const {
    allIterations,
    currentIterationIndex,
    onChangeIterationInfo,
    isVisible,
    setIsVisible,
    onDuplicate,
  } = props;
  const iteration: FormValues = allIterations[currentIterationIndex - 1];
  const settings = useSettings();
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const formId = useId();
  const formRef = useRef<FormRef<FormValues>>();
  const queryResults = useUserLists();
  return (
    <div>
      <Card.Root className={s.cardRoot}>
        <Card.Section>
          <div className={s.iterationDetailsRoot}>
            <div className={s.iterationTitleContainer}>
              <P bold fontWeight="bold " variant="m">
                {iteration.name ?? ''}
              </P>
              <div className={s.iconsContainer}>
                <Button
                  onClick={() => {
                    onDuplicate();
                  }}
                  type="TEXT"
                  icon={<FileCopyLineIcon className={s.icon} />}
                />
                <Button
                  onClick={() => {
                    setIsVisible(true);
                  }}
                  icon={<EditLineIcon className={s.icon} />}
                  type="TEXT"
                />
              </div>
            </div>
            {iteration.description ?? ''}
            <div className={s.samplingDetailsContainer}>
              <div className={s.sampleProperty}>
                <P variant="m" grey>
                  {firstLetterUpper(settings.userAlias)} sampling type
                </P>
                <P variant="m" fontWeight="medium">
                  {iteration.samplingType === 'RANDOM'
                    ? 'Random sample'
                    : `All ${settings.userAlias}s`}
                </P>
              </div>
              <div className={s.sampleProperty}>
                <P variant="m" grey>
                  Simulate for
                </P>
                <P variant="m" fontWeight="medium">
                  Risk factors
                </P>
              </div>
              <div className={s.sampleProperty}>
                <P variant="m" grey>
                  {firstLetterUpper(settings.userAlias)} Ids included
                </P>
                <P variant="m" fontWeight="medium">
                  {iteration.sampleDetails?.userIds?.join(', ') ?? '-'}
                </P>
              </div>
              <div className={s.sampleProperty}>
                <P variant="m" grey>
                  List IDs included
                </P>
                <P variant="m" fontWeight="medium">
                  {iteration.sampleDetails?.listIds?.join(', ') ?? '-'}
                </P>
              </div>
              <div className={s.sampleProperty}>
                <P variant="m" grey>
                  Transaction IDs included
                </P>
                <P variant="m" fontWeight="medium">
                  {iteration.sampleDetails?.transactionIds?.join(', ') ?? '-'}
                </P>
              </div>
            </div>
          </div>
        </Card.Section>
      </Card.Root>
      <Modal
        isOpen={isVisible}
        onCancel={() => {
          setIsVisible(false);
        }}
        okText={'Done'}
        onOk={() => {
          if (formRef.current) {
            formRef.current.submit();
          }
        }}
        title="Simulation"
        width="L"
      >
        <Form<FormValues>
          key={formId}
          id={formId}
          ref={formRef}
          initialValues={iteration}
          fieldValidators={{
            name: notEmpty,
            description: notEmpty,
            samplingType: notEmpty,
            sampleDetails: (values) =>
              values?.userCount == null
                ? `${firstLetterUpper(settings.userAlias)} limit cannot be empty`
                : null,
          }}
          alwaysShowErrors={alwaysShowErrors}
          onSubmit={(values, state) => {
            if (!state.isValid) {
              message.warn(
                'Please, make sure that all required fields are filled and values are valid!',
              );
              setAlwaysShowErrors(true);
              return;
            } else {
              onChangeIterationInfo(values);
              setIsVisible(false);
            }
          }}
        >
          {({ valuesState: [values] }) => (
            <div className={s.root}>
              <InputField<FormValues, 'name'>
                name={'name'}
                label={'Iteration name'}
                labelProps={{
                  required: {
                    value: true,
                    showHint: true,
                  },
                }}
              >
                {(inputProps) => <TextInput {...inputProps} placeholder={'Enter iteration name'} />}
              </InputField>
              <InputField<FormValues, 'description'>
                name={'description'}
                label={'Iteration Description'}
                labelProps={{
                  required: {
                    value: true,
                    showHint: true,
                  },
                }}
              >
                {(inputProps) => (
                  <TextInput {...inputProps} placeholder={'Enter iteration description'} />
                )}
              </InputField>
              <InputField<FormValues, 'samplingType'>
                name={'samplingType'}
                label={`${firstLetterUpper(settings.userAlias)} sampling type`}
                labelProps={{ required: true }}
              >
                {(inputProps) => (
                  <SelectionGroup
                    {...inputProps}
                    mode="SINGLE"
                    options={[
                      {
                        value: 'RANDOM',
                        label: 'Random sample',
                        description: `Run the simulation on a randomly selected subset of ${settings.userAlias}s.`,
                      },
                      {
                        value: 'ALL' as 'ALL' | 'RANDOM',
                        label: `All ${settings.userAlias}s`,
                        description: `Run the simulation for all ${settings.userAlias}s. It may take time to process results, check progress under simulation history.`,
                      },
                    ]}
                    {...inputProps}
                  />
                )}
              </InputField>
              {values.samplingType === 'RANDOM' && (
                <NestedForm name={'sampleDetails'}>
                  <InputField<FormValues['sampleDetails'], 'userCount'>
                    name="userCount"
                    label={'Random sample size'}
                    labelProps={{ required: { value: true, showHint: true } }}
                  >
                    {(inputProps) => (
                      <div className={s.userRange}>
                        <div className={s.userRangeSlider}>
                          <NumberRangeInput
                            mode="SINGLE"
                            value={{ lowerBound: 100, upperBound: inputProps.value ?? 100000 }}
                            onChange={(val) => {
                              if (inputProps.onChange) {
                                inputProps.onChange(val?.upperBound);
                              }
                            }}
                            uiSchema={{
                              'ui:maximum': 100000,
                              'ui:minimum': 100,
                              'ui:subtype': 'NUMBER_SLIDER_SINGLE',
                              'ui:multipleOf': 1000,
                            }}
                          />
                        </div>
                        <NumberInput
                          placeholder="Enter value"
                          max={100000}
                          min={100}
                          {...inputProps}
                        />
                      </div>
                    )}
                  </InputField>
                  <ExpandContentButton suffixText="advanced options">
                    <div className={s.scoreRange}>
                      <InputField<FormValues['sampleDetails'], 'userRiskRange'>
                        name="userRiskRange"
                        label={`${firstLetterUpper(
                          settings.userAlias,
                        )} risk score range to include in the sample`}
                        labelProps={{ required: { value: false, showHint: true } }}
                      >
                        {(inputProps) => (
                          <Slider
                            value={[
                              inputProps.value?.startScore ?? 0,
                              inputProps.value?.endScore ?? inputProps.value?.startScore ?? 0,
                            ]}
                            onChange={(value) => {
                              if (inputProps.onChange && value) {
                                inputProps.onChange({ startScore: value[0], endScore: value[1] });
                              }
                            }}
                            marks={{
                              [inputProps.value?.startScore ?? 0]:
                                inputProps.value?.startScore ?? 0,
                              [inputProps.value?.endScore ?? inputProps.value?.startScore ?? 0]:
                                inputProps.value?.endScore ?? inputProps.value?.startScore ?? 0,
                            }}
                            mode="RANGE"
                          />
                        )}
                      </InputField>
                      <span>
                        <Label label="Selected range">
                          <p className={s.rangeText}>
                            {'>'}={values.sampleDetails.userRiskRange?.startScore ?? 0} to {'<'}=
                            {values.sampleDetails.userRiskRange?.endScore ??
                              values.sampleDetails.userRiskRange?.startScore ??
                              0}
                          </p>
                        </Label>
                      </span>
                    </div>
                    <InputField<FormValues['sampleDetails'], 'userIds'>
                      label={`${firstLetterUpper(settings.userAlias)} IDs to include in the sample`}
                      name="userIds"
                      labelProps={{ required: { value: false, showHint: true } }}
                    >
                      {(inputProps) => (
                        <UserIdsSelect
                          mode="MULTIPLE"
                          {...inputProps}
                          placeholder={`Search for ${settings.userAlias} ID`}
                        />
                      )}
                    </InputField>
                    <InputField<FormValues['sampleDetails'], 'listIds'>
                      name="listIds"
                      label="Lists to include in the sample"
                      labelProps={{ required: { value: false, showHint: true } }}
                    >
                      {(inputProps) => {
                        return (
                          <Select<string>
                            mode="MULTIPLE"
                            options={getOr(queryResults.data, []).map((list) => ({
                              label: list.metadata?.name || list.listId,
                              value: list.listId,
                            }))}
                            {...inputProps}
                            placeholder={
                              isLoading(queryResults.data) ? 'Loading...' : 'Search for List Name'
                            }
                            isLoading={isLoading(queryResults.data)}
                          />
                        );
                      }}
                    </InputField>
                    <InputField<FormValues['sampleDetails'], 'transactionIds'>
                      name="transactionIds"
                      label="Transaction IDs to include in the sample"
                      labelProps={{ required: { value: false, showHint: true } }}
                    >
                      {(inputProps) => (
                        <TransactionIdsSelect
                          mode="MULTIPLE"
                          placeholder="Search for transaction ID"
                          {...inputProps}
                        />
                      )}
                    </InputField>
                  </ExpandContentButton>
                </NestedForm>
              )}
              <InputField<FormValues, 'riskAlgorithm'>
                name={'riskAlgorithm'}
                label={'Risk algorithms for CRA'}
                labelProps={{ required: true }}
              >
                {(inputProps) => (
                  <RiskAlgorithmsSelector
                    currentAlgorithm={inputProps.value}
                    defaultAlgorithmType="FORMULA_SIMPLE_AVG"
                    handleUpdateAlgorithm={(riskAlgorithm) => {
                      if (inputProps) {
                        inputProps.onChange?.(riskAlgorithm);
                      }
                    }}
                    isUpdateDisabled={false}
                    hasPermissions={true}
                  />
                )}
              </InputField>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};
