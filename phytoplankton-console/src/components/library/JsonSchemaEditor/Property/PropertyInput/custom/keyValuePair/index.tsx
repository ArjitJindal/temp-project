import React from 'react';
import { Radio } from 'antd';
import { ExtendedSchema } from '../../../../types';
import AdditionalProperties from '../../ObjectPropertyInput/AdditionalProperties';
import { InputProps } from '@/components/library/Form';
import { isSchema } from '@/components/library/JsonSchemaEditor/schema-utils';

export interface TagFilterValue {
  useAndLogic?: boolean;
  tags?: Record<string, string[]>;
}

interface Props extends InputProps<TagFilterValue> {
  schema: ExtendedSchema;
}

export default function KeyValuePairInput(props: Props) {
  const { schema, value = {}, onChange } = props;

  const useAndLogic = value.useAndLogic ?? false;
  const tags = value.tags ?? {};

  const handleTagChange = (newTagsObject: object | undefined) => {
    onChange?.({
      ...value,
      tags: (newTagsObject ?? {}) as Record<string, string[]>,
    });
  };

  const handleLogicToggle = (newValue: boolean) => {
    onChange?.({
      ...value,
      useAndLogic: newValue,
    });
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        <label style={{ fontWeight: 600 }}>USE AND logic</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio.Group value={useAndLogic} onChange={(e) => handleLogicToggle(e.target.value)}>
            <Radio value={false}>OR Logic</Radio>
            <Radio value={true}>AND Logic</Radio>
          </Radio.Group>
          <span style={{ fontSize: 12, color: '#888' }}>
            {useAndLogic
              ? 'If AND logic selected, all tags must match (AND logic).'
              : 'If OR logic selected, any tag match will suffice (OR logic).'}
          </span>
        </div>
      </div>

      {isSchema(schema.additionalProperties) ? (
        <AdditionalProperties
          schema={schema.additionalProperties.tags}
          value={tags}
          onChange={handleTagChange}
        />
      ) : (
        <div style={{ color: 'red', fontSize: 12 }}>
          Tags schema not found in JSON schema definition.
        </div>
      )}
    </>
  );
}
