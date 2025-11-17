import { useState } from 'react';
import { useNavigate } from 'react-router';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import styles from './index.module.less';
import { fileInfoPoints } from './const';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import Modal from '@/components/library/Modal';
import Alert from '@/components/library/Alert';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import Upload2LineIcon from '@/components/ui/icons/Remix/system/upload-2-line.react.svg';
import { FileInfo } from '@/apis';
import Form from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { FilterProps } from '@/components/library/Filter/types';
import Filter from '@/components/library/Filter';
import { GENERIC_SANCTIONS_SEARCH_TYPES } from '@/apis/models-custom/GenericSanctionsSearchType';
import { useScreeningProfiles, useSanctionsBulkSearch } from '@/utils/api/screening';
import { ENTITY_TYPE_OPTIONS } from '@/components/ScreeningHitTable';
import { isLoading } from '@/utils/asyncResource';

const BulkScreeningDialog = () => {
  const flatImportEnabled = useFeatureEnabled('FLAT_FILES_IMPORT');
  const [isOpen, setIsOpen] = useState(false);

  const [files, setFiles] = useState<FileInfo[] | undefined>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importReason, setImportReason] = useState<string>('');
  const [isReasonValid, setIsReasonValid] = useState<boolean>(false);
  const [params, setParams] = useState<{
    entityType?: string[];
    screeningProfileId?: string[];
    types?: string[];
    fuzziness?: number;
  }>({ fuzziness: 20 });

  const screeningProfilesResult = useScreeningProfiles({});
  const bulkSearchMutation = useSanctionsBulkSearch();
  const navigate = useNavigate();

  const screeningTypeOptions = GENERIC_SANCTIONS_SEARCH_TYPES.map((t) => ({
    value: t,
    label: humanizeAuto(t),
  }));
  const profileOptions = ((screeningProfilesResult.data as any)?.items ?? []).map((p: any) => ({
    label: p.screeningProfileName ?? p.screeningProfileId,
    value: p.screeningProfileId ?? '',
  }));

  const filters: FilterProps<typeof params>[] = [
    {
      kind: 'AUTO',
      key: 'entityType',
      title: 'User type',
      pinFilterToLeft: true,
      showFilterByDefault: true,
      dataType: {
        kind: 'select',
        options: ENTITY_TYPE_OPTIONS,
        mode: 'SINGLE',
        displayMode: 'select',
        closeOnSingleSelect: true,
        allowClear: false,
      },
    },
    {
      kind: 'AUTO',
      key: 'screeningProfileId',
      title: 'Screening profile name',
      dataType: {
        kind: 'select',
        options: profileOptions,
        mode: 'SINGLE',
        displayMode: 'select',
        closeOnSingleSelect: true,
      },
    },
    {
      kind: 'AUTO',
      key: 'types',
      title: 'Matched type',
      dataType: {
        kind: 'select',
        options: screeningTypeOptions,
        mode: 'MULTIPLE',
        displayMode: 'select',
        allowClear: true,
      },
    },
    {
      kind: 'AUTO',
      key: 'fuzziness',
      title: 'Fuzziness',
      dataType: {
        kind: 'number',
        min: 0,
        max: 100,
        step: 1,
        displayAs: 'slider',
        defaultValue: 20,
      },
    },
  ];

  if (!flatImportEnabled) {
    return null;
  }

  const file = files?.[0];
  const isSubmitting = isLoading(bulkSearchMutation.dataResource);

  return (
    <>
      <Button type={'TETRIARY'} onClick={() => setIsOpen(true)} icon={<Upload2LineIcon />}>
        Batch screening
      </Button>
      <Modal
        id="bulk-screening-dialog"
        isOpen={isOpen}
        onCancel={() => setIsOpen(false)}
        width="L"
        title="Batch screening"
        subTitle="Use our standard CSV template with predefined headers and structure for a quick import."
        okText="Import"
        okProps={{ isDisabled: !file || !isReasonValid, isLoading: isSubmitting }}
        cancelProps={{ isDisabled: isSubmitting }}
        maskClosable={!isSubmitting}
        onOk={() => {
          if (!file || !isReasonValid) {
            return;
          }
          const payload = {
            screeningProfileId: params.screeningProfileId?.[0],
            types: params.types?.filter(Boolean),
            fuzziness: (params.fuzziness ?? 20) / 100,
            entityType: params.entityType,
            manualSearch: true,
          };
          bulkSearchMutation.mutate(
            {
              file,
              reason: importReason.trim(),
              filters: payload,
            },
            {
              onSuccess: (res) => {
                if (res.id) {
                  navigate(`/screening/bulk-search/${res.id}.1`);
                }
              },
            },
          );
        }}
      >
        <Form<{ importReason: string }>
          initialValues={{ importReason: '' }}
          fieldValidators={{ importReason: notEmpty }}
          onChange={({ values, isValid }) => {
            setImportReason(values.importReason);
            setIsReasonValid(isValid);
          }}
        >
          <InputField<{ importReason: string }>
            name={'importReason'}
            label="Import reason"
            labelProps={{ required: true }}
          >
            {(inputProps) => <TextInput placeholder="Add a note for this import" {...inputProps} />}
          </InputField>
        </Form>

        <div className={styles.filters}>
          {filters.map((f) => (
            <Filter
              key={f.key}
              readOnly={false}
              filter={f}
              params={params}
              onChangeParams={(newParams) => setParams(newParams)}
            />
          ))}
        </div>

        <FilesDraggerInput
          size="LARGE"
          singleFile
          value={file ? [file] : []}
          accept={['text/csv']}
          onChange={(newFiles) => {
            setFiles(newFiles?.length ? [newFiles[newFiles.length - 1]] : newFiles);
            setErrors([]);
          }}
          required
          title="Upload CSV"
          info={
            <div>
              {fileInfoPoints.map((point) => (
                <div key={point}>{point}</div>
              ))}
            </div>
          }
          onShowErrorMessages={(messages) => setErrors(messages)}
        />
        {errors.length > 0 && (
          <Alert type={'ERROR'}>
            {errors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </Alert>
        )}
      </Modal>
    </>
  );
};

export default BulkScreeningDialog;
