import React, { Dispatch, SetStateAction, useImperativeHandle, useRef } from 'react';
import { uniqBy } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { ExpandContentButton } from '../library/ExpandContentButton';
import FilesDraggerInput from '../ui/FilesDraggerInput';
import {
  ObjectFieldValidator,
  trueFalseMutualExclusivity,
} from '../library/Form/utils/validation/types';
import MarkdownEditor from '../markdown/MarkdownEditor';
import s from './index.module.less';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Form, { InputProps, FormRef } from '@/components/library/Form';
import { maxLength, notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { and } from '@/components/library/Form/utils/validation/combinators';
import { MAX_COMMENT_LENGTH } from '@/components/CommentEditor';
import InputField from '@/components/library/Form/InputField';
import { AdditionalCopilotInfo, CaseReasons, FileInfo, NarrativeType } from '@/apis';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import NarrativesSelectStatusChange from '@/pages/case-management/components/NarrativesSelectStatusChange';
import GenericFormField from '@/components/library/Form/GenericFormField';
import { CopilotButtonContent } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import Alert from '@/components/library/Alert';
import Label from '@/components/library/Label';
import { useUsers } from '@/utils/user-utils';

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
  'Confirmed fraud',
  'Confirmed genuine',
  'Suspected fraud',
  'True positive',
];

export type EntityType = NarrativeType;

export type FormValues<R, ExtraFields = unknown> = {
  reasons: R[];
  reasonOther: string | undefined;
  comment: string | undefined;
  files: FileInfo[];
} & ExtraFields;

export type NarrativeFormValues<R, ExtraFields = unknown> = {
  values: FormValues<R, ExtraFields>;
  isValid: boolean;
};

type NarrativeProps<R> = {
  formRef?: React.Ref<FormRef<FormValues<R>>>;
  values: NarrativeFormValues<R>;
  onChange: Dispatch<SetStateAction<NarrativeFormValues<R>>>;
  alertMessage?: string;
  entityIds?: string[];
  placeholder: string;
  entityType: EntityType;
  possibleReasons: R[];
  onSubmit: (values: FormValues<R>) => void;
  showErrors: boolean;
  extraFields?: React.ReactNode;
  otherReason?: R;
  advancedOptions?: React.ReactNode;
  advancedOptionsValidators?: ObjectFieldValidator<any>;
  isCopilotEnabled?: boolean;
  infoText?: string;
  additionalCopilotInfo?: AdditionalCopilotInfo;
};

export interface NarrativeRef {
  reset: () => void;
}

function Narrative<R extends string>(props: NarrativeProps<R>, ref: React.Ref<NarrativeRef>) {
  const {
    formRef,
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
    infoText,
    advancedOptionsValidators,
    additionalCopilotInfo,
  } = props;

  const editorRef = useRef<MarkdownEditor>(null);
  const showCopilot = useFeatureEnabled('NARRATIVE_COPILOT') && isCopilotEnabled;

  const [users] = useUsers();

  const isOtherReason = otherReason ? values.values.reasons?.includes(otherReason) : false;
  const isMentionsEnabled = useFeatureEnabled('NOTIFICATIONS');

  useImperativeHandle(ref, () => ({
    reset: () => {
      editorRef.current?.reset();
    },
  }));

  return (
    <Form<FormValues<R>>
      ref={formRef}
      initialValues={values.values}
      className={s.root}
      onSubmit={(values, state) => {
        if (state.isValid) {
          onSubmit(values);
        }
      }}
      fieldValidators={{
        reasons: and([notEmpty, trueFalseMutualExclusivity]),
        comment: and([notEmpty, maxLength(MAX_COMMENT_LENGTH)]),
        reasonOther: isOtherReason ? and([notEmpty, maxLength(500)]) : undefined,
        ...advancedOptionsValidators,
      }}
      onChange={(values) => {
        onChange((state) => ({
          ...values,
          isValid: values.isValid,
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
            options={possibleReasons.map((value) => ({ value: value, label: humanizeAuto(value) }))}
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
      <div>
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
                  if (value) {
                    inputProps?.onChange?.(value);
                    editorRef.current?.editorRef.current?.getInstance().setMarkdown(value);
                  }
                }}
              />
              <div>
                <MarkdownEditor
                  editorHeight={250}
                  ref={editorRef}
                  initialValue={values.values.comment ? values.values.comment : ''}
                  onChange={(value) => {
                    inputProps.onChange?.(value);
                  }}
                  placeholder={placeholder}
                  mentionsEnabled={isMentionsEnabled}
                  mentionsList={Object.keys(users).map((userId) => ({
                    label: users[userId].email,
                    id: users[userId].id,
                  }))}
                />
              </div>
            </>
          )}
        </InputField>
        {infoText && (
          <div className={s.infoDiv}>
            <Alert type="INFO">{infoText}</Alert>
          </div>
        )}
        {showCopilot && (
          <GenericFormField<FormValues<R>, 'comment'> name="comment">
            {(props) => (
              <CopilotButtonContent
                reasons={values.values.reasons ?? []}
                otherReason={values.values.reasonOther}
                narrative={props.value || ''}
                setNarrativeValue={(value) => {
                  props.onChange?.(value);
                  editorRef.current?.editorRef.current
                    ?.getInstance()
                    .setMarkdown(value.replaceAll(/\n\n/gi, `\n`));
                }}
                entityId={entityIds && entityIds?.length > 0 ? entityIds[0] : ''}
                entityType={entityType}
                additionalCopilotInfo={additionalCopilotInfo}
                copilotDisabled={entityIds && entityIds?.length > 1 ? true : false}
                copilotDisabledReason={
                  entityType === 'CASE'
                    ? 'AI copilot cannot be used when closing multiple cases simultaneously.'
                    : entityType === 'ALERT'
                    ? 'AI copilot cannot be used when closing multiple alerts simultaneously.'
                    : ''
                }
              />
            )}
          </GenericFormField>
        )}
      </div>
      <Label label={'Upload attachments'}>
        <FilesDraggerInput
          onChange={(value) => {
            if (value) {
              onChange((state) => {
                const fileAdded = value.filter(
                  (v) => !state.values.files.find((existingFile) => v.s3Key === existingFile.s3Key),
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
        />
      </Label>
      {extraFields}
      {alertMessage && <Alert type="INFO">{alertMessage}</Alert>}
    </Form>
  );
}

export default React.forwardRef<NarrativeRef, NarrativeProps<any>>(Narrative);
