import { isEmpty } from 'lodash';
import { ExtendedSchema } from '../../types';
import { getUiSchema } from '../../utils';
import { useJsonSchemaEditorContext } from '../../context';
import { dereferenceType } from '../../schema-utils';
import SimplePropertyInput from './SimplePropertyInput';
import ArrayPropertyInput from './ArrayPropertyInput';
import DayWindowInput from './custom/DayWindowInput';
import TimeWindowInput from './custom/TimeWindowInput';
import AgeRangeInput from './custom/AgeRangeInput';
import CountriesInput from './custom/CountriesInput';
import ObjectPropertyInput from './ObjectPropertyInput';
import PaymentChannelInput from './custom/PaymentChannelInput';
import TransactionAmountRangeInput from './custom/TransactionAmountRangeInput';
import UserTypeInput from './custom/UserTypeInput';
import CurrencyInput from './custom/CurrencyInput';
import PaymentFiltersInput from './custom/PaymentFiltersInput';
import TransactionAmountThresholdsInput from './custom/TransactionAmountThresholdsInput';
import Indicator from './custom/fincen/Indicator';
import TimeRangeInput from './custom/TimeRangeInput';
import NarrativeInput from './custom/NarrativeInput';
import { CheckListCategoryListsInput } from './custom/CheckListCategoryListsInput';
import { WebhookInput } from './custom/WebhookInput';
import CountryRegion from '@/components/library/JsonSchemaEditor/Property/PropertyInput/custom/CountryRegion';
import { InputProps } from '@/components/library/Form';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
}

export default function PropertyInput(props: Props) {
  const { schema: _schema } = props;
  const { rootSchema } = useJsonSchemaEditorContext();
  const schema = dereferenceType(_schema, rootSchema);
  const uiSchema = getUiSchema(schema);
  if (uiSchema['ui:subtype'] === 'DAY_WINDOW') {
    return <DayWindowInput {...props} schema={schema} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'NARRATIVE') {
    return <NarrativeInput {...props} schema={schema} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'PAYMENT_FILTERS') {
    return <PaymentFiltersInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'TIME_WINDOW') {
    return <TimeWindowInput {...props} schema={schema} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'COUNTRIES' || uiSchema['ui:subtype'] === 'COUNTRY') {
    return <CountriesInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'AGE_RANGE') {
    return <AgeRangeInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'TRANSACTION_AMOUNT_RANGE') {
    return <TransactionAmountRangeInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'TRANSACTION_AMOUNT_THRESHOLDS') {
    return <TransactionAmountThresholdsInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'USER_TYPE') {
    return <UserTypeInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'CURRENCY') {
    return <CurrencyInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'PAYMENT_CHANNELS') {
    return <PaymentChannelInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'FINCEN_INDICATOR') {
    return <Indicator {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'TIME_RANGE') {
    return <TimeRangeInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'CHECKLISTS_CATEGORY_LIST') {
    return <CheckListCategoryListsInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'COUNTRY_REGION') {
    return <CountryRegion {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'WEBHOOK') {
    return <WebhookInput {...props} uiSchema={uiSchema} />;
  }

  const schemaType = schema.oneOf ? 'object' : schema.type;
  switch (schemaType) {
    case 'number':
    case 'boolean':
    case 'integer':
    case 'string':
      return <SimplePropertyInput {...props} schema={schema} />;
    case 'object':
      return <ObjectPropertyInput {...props} schema={schema} />;
    case 'array':
      return <ArrayPropertyInput {...props} schema={schema} />;
    default:
      break;
  }

  if (!isEmpty(schema)) {
    console.error(`Schema type "${schema.type}" is not supported: ${JSON.stringify(schema)}`);
  }

  return <></>;
}
