import React from 'react';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import GenericFormField from '@/components/library/Form/GenericFormField';

export default function AttachmentsStep() {
  return (
    <GenericFormField<any, any> name="files">
      {(props) => <FilesDraggerInput value={props.value} onChange={props.onChange} />}
    </GenericFormField>
  );
}
