import React from 'react';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import GenericFormField from '@/components/library/Form/GenericFormField';

interface Props {
  reportTypeId: string;
}

const SINGLE_FILE_UPLOAD_SUPPORTED_SAR_IDS = ['US-SAR'];
export default function AttachmentsStep(props: Props) {
  const { reportTypeId } = props;
  return (
    <GenericFormField<any, any> name="files">
      {(props) => (
        <FilesDraggerInput
          value={props.value}
          onChange={props.onChange}
          singleFile={SINGLE_FILE_UPLOAD_SUPPORTED_SAR_IDS.includes(reportTypeId)}
          size="LARGE"
        />
      )}
    </GenericFormField>
  );
}
