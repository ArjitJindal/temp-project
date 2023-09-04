import { useState } from 'react';
import { groupBy } from 'lodash';
import { JsonSchemaEditorSettings } from '@/components/library/JsonSchemaEditor/settings';
import JsonSchemaEditor from '@/components/library/JsonSchemaEditor';
import VerticalMenu from '@/components/library/VerticalMenu';
import { getUiSchema, useOrderedProps } from '@/components/library/JsonSchemaEditor/utils';
import { ExtendedSchema } from '@/components/library/JsonSchemaEditor/types';
import {
  isResultValid,
  NestedValidationResult,
} from '@/components/library/Form/utils/validation/types';

export default function ReportStep(props: {
  settings: Partial<JsonSchemaEditorSettings>;
  parametersSchema: ExtendedSchema;
  validationResult?: NestedValidationResult | undefined;
  alwaysShowErrors: boolean;
}) {
  const { settings, validationResult, parametersSchema, alwaysShowErrors } = props;

  const orderedProps = useOrderedProps(parametersSchema);

  const groups = Object.entries(
    groupBy(orderedProps, (property) => getUiSchema(property.schema)['ui:group']),
  ).map(([group, properties]) => ({
    group: group === 'undefined' ? 'Other' : group,
    key: properties[0]?.name,
    properties,
  }));

  const menuItems = groups.map(({ key, group }) => {
    const validationResultElement = validationResult?.[key];
    return {
      key: group,
      title: group,
      isInvalid: alwaysShowErrors && !isResultValid(validationResultElement),
    };
  });

  const [activeMenuItem, setActiveMenuItem] = useState<string>(groups[0]?.group ?? 'Other');

  const activeGroup = groups.find((x) => x.group === activeMenuItem);

  return (
    <VerticalMenu items={menuItems} active={activeMenuItem} onChange={setActiveMenuItem}>
      {activeGroup?.properties && (
        <JsonSchemaEditor
          settings={settings}
          parametersSchema={{
            ...parametersSchema,
            properties: activeGroup?.properties.reduce(
              (acc, x) => ({ ...acc, [x.name]: x.schema }),
              {},
            ),
          }}
        />
      )}
    </VerticalMenu>
  );
}
