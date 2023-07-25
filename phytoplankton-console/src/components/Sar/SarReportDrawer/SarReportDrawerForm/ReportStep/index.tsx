import { useState } from 'react';
import { groupBy } from 'lodash';
import { JsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';
import JsonSchemaEditor from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor';
import VerticalMenu from '@/components/library/VerticalMenu';
import {
  useOrderedProps,
  getUiSchema,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';
import { ExtendedSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/types';

export default function ReportStep(props: {
  settings: Partial<JsonSchemaEditorSettings>;
  parametersSchema: ExtendedSchema;
}) {
  const { settings, parametersSchema } = props;

  const orderedProps = useOrderedProps(parametersSchema);

  const groups = Object.entries(
    groupBy(orderedProps, (property) => getUiSchema(property.schema)['ui:group']),
  ).map(([group, properties]) => ({ group: group === 'undefined' ? 'Other' : group, properties }));

  const menuItems = groups.map(({ group }) => ({
    key: group,
    title: group,
  }));

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
