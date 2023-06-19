import PropertyList from './PropertyList';
import { ExtendedSchema } from './types';
import { getOrderedProps } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';

interface Props {
  parametersSchema: ExtendedSchema;
}

export default function JsonSchemaEditor(props: Props) {
  const { parametersSchema } = props;
  return <PropertyList items={getOrderedProps(parametersSchema)} />;
}
