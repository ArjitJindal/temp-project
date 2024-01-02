import React, { Dispatch, SetStateAction, useState } from 'react';
import { uniqBy } from 'lodash';
import { ExpandContentButton } from '../library/ExpandContentButton';
import s from './index.module.less';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Form, { InputProps } from '@/components/library/Form';
import { maxLength, notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { and } from '@/components/library/Form/utils/validation/combinators';
import { MAX_COMMENT_LENGTH } from '@/components/CommentEditor';
import InputField from '@/components/library/Form/InputField';
import { CaseReasons, FileInfo } from '@/apis';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import NarrativesSelectStatusChange from '@/pages/case-management/components/NarrativesSelectStatusChange';
import TextArea from '@/components/library/TextArea';
import GenericFormField from '@/components/library/Form/GenericFormField';
import { CopilotButtonContent } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import FilesInput from '@/components/ui/FilesInput';
import Alert from '@/components/library/Alert';

export const OTHER_REASON: CaseReasons = 'Other';
export const COMMON_REASONS = [OTHER_REASON];
// todo: need to take from tenant storage when we implement it
export const CLOSING_REASONS: CaseReasons[] = [
  'False positive',
  'Investigation completed',
  'Documents collected',
  'Suspicious activity reported (SAR)',
  'Documents not collected',
  'Transaction Refunded',
  'Transaction Rejected',
  'User Blacklisted',
  'User Terminated',
  'Escalated',
];

export type EntityType = 'ALERT' | 'CASE' | 'TRANSACTION' | 'REPORT';

export type FormValues<R> = {
  reasons: R[];
  reasonOther: string | undefined;
  comment: string | undefined;
  files: FileInfo[];
};

export type NarrativeFormValues<R> = {
  values: FormValues<R>;
  isValid: boolean;
};

type NarrativeProps<R> = {
  values: NarrativeFormValues<R>;
  onChange: Dispatch<SetStateAction<NarrativeFormValues<R>>>;
  alertMessage?: string;
  entityIds?: string[];
  placeholder: string;
  entityType: EntityType;
  possibleReasons: R[];
  onSubmit: () => void;
  showErrors: boolean;
  extraFields?: React.ReactNode;
  otherReason?: R;
  advancedOptions?: React.ReactNode;
  isCopilotEnabled?: boolean;
};

export default function Narrative<R extends string>(props: NarrativeProps<R>) {
  const {
    possibleReasons,
    onChange,
    values,
    onSubmit,
    extraFields,
    alertMessage,
    entityIds,
    entityType,
    placeholder,
    showErrors,
    otherReason,
    advancedOptions,
    isCopilotEnabled = true,
  } = props;

  const [uploadingCount, setUploadingCount] = useState(0);
  const showCopilot = useFeatureEnabled('NARRATIVE_COPILOT') && isCopilotEnabled;
  const isOtherReason = otherReason ? values.values.reasons?.includes(otherReason) : false;

  return (
    <Form<FormValues<R>>
      initialValues={values.values}
      className={s.root}
      onSubmit={(_, state) => {
        if (state.isValid) {
          onSubmit();
        }
      }}
      fieldValidators={{
        reasons: notEmpty,
        comment: and([notEmpty, maxLength(MAX_COMMENT_LENGTH)]),
        reasonOther: isOtherReason ? and([notEmpty, maxLength(500)]) : undefined,
      }}
      onChange={(values) => {
        onChange((state) => ({
          ...values,
          values: {
            ...values.values,
            files: state.values.files,
          },
        }));
      }}
      alwaysShowErrors={showErrors}
    >
      <InputField<FormValues<R>, 'reasons'>
        name={'reasons'}
        label={'Reason'}
        labelProps={{
          required: {
            value: true,
            showHint: true,
          },
        }}
      >
        {(inputProps: InputProps<R[]>) => (
          <Select<R>
            {...inputProps}
            mode={'MULTIPLE'}
            options={possibleReasons.map((label) => ({ value: label, label }))}
          />
        )}
      </InputField>
      {isOtherReason && (
        <InputField<FormValues<R>, 'reasonOther'>
          name="reasonOther"
          label="Describe the reason"
          labelProps={{
            required: {
              value: true,
              showHint: true,
            },
          }}
        >
          {(inputProps) => <TextInput {...inputProps} />}
        </InputField>
      )}
      {advancedOptions && (
        <ExpandContentButton suffixText={'advanced options'}>{advancedOptions}</ExpandContentButton>
      )}
      <div className={s.comment}>
        <InputField<FormValues<R>, 'comment'>
          name={'comment'}
          label={'Comment'}
          labelProps={{
            required: {
              value: true,
              showHint: true,
            },
          }}
        >
          {(inputProps) => (
            <>
              <NarrativesSelectStatusChange
                templateValue={null}
                setTemplateValue={(value) => {
                  inputProps?.onChange?.(value);
                }}
              />
              <TextArea
                {...inputProps}
                rows={4}
                placeholder={placeholder}
                className={s.commentBox}
                minHeight={'300px'}
              />
            </>
          )}
        </InputField>
        {showCopilot && (
          <GenericFormField<FormValues<R>, 'comment'> name="comment">
            {(props) => (
              <CopilotButtonContent
                reasons={values.values.reasons ?? []}
                narrative={props.value || ''}
                setNarrativeValue={(value) => {
                  props.onChange?.(value);
                }}
                entityId={entityIds && entityIds?.length > 0 ? entityIds[0] : ''}
                entityType={entityType}
              />
            )}
          </GenericFormField>
        )}
      </div>
      <InputField<FormValues<R>, 'files'> name={'files'} label={'Attach documents'}>
        {(inputProps) => (
          <FilesInput
            {...inputProps}
            onChange={(value) => {
              if (value) {
                onChange((state) => {
                  const fileAdded = value.filter(
                    (v) =>
                      !state.values.files.find((existingFile) => v.s3Key === existingFile.s3Key),
                  );
                  if (fileAdded.length > 0) {
                    return {
                      ...state,
                      values: {
                        ...state.values,
                        files: uniqBy([...state.values.files, ...value], 's3Key'),
                      },
                    };
                  }
                  return {
                    ...state,
                    values: {
                      ...state.values,
                      files: value,
                    },
                  };
                });
              }
            }}
            value={values.values.files}
            uploadingCount={uploadingCount}
            setUploadingCount={setUploadingCount}
          />
        )}
      </InputField>
      {extraFields}
      {alertMessage && <Alert type="info">{alertMessage}</Alert>}
    </Form>
  );
}
