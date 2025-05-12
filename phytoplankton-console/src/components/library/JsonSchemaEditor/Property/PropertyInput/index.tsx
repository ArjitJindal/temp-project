import { isEmpty } from 'lodash';
import { ExtendedSchema } from '../../types';
import { getUiSchema } from '../../utils';
import { useJsonSchemaEditorContext } from '../../context';
import { dereferenceType } from '../../schema-utils';
import AgeRangeInput from '../../../AgeRangeInput';
import SimplePropertyInput from './SimplePropertyInput';
import ArrayPropertyInput from './ArrayPropertyInput';
import DayWindowInput from './custom/DayWindowInput';
import TimeWindowInput from './custom/TimeWindowInput';
import CountriesInput from './custom/CountriesInput';
import ObjectPropertyInput from './ObjectPropertyInput';
import PaymentChannelInput from './custom/PaymentChannelInput';
import TransactionAmountRangeInput from './custom/TransactionAmountRangeInput';
import UserTypeInput from './custom/UserTypeInput';
import CurrencyInput from './custom/CurrencyInput';
import PaymentFiltersInput from './custom/PaymentFiltersInput';
import TransactionAmountThresholdsInput from './custom/TransactionAmountThresholdsInput';
import Indicator from './custom/fincen/Indicator';
import Number from './custom/fincen/Number';
import TimeRangeInput from './custom/TimeRangeInput';
import NarrativeInput from './custom/NarrativeInput';
import { CheckListCategoryListsInput } from './custom/CheckListCategoryListsInput';
import { WebhookInput } from './custom/WebhookInput';
import MarkdownInput from './custom/MarkdownInput';
import { NumberRangeInput } from './custom/NumberRangeInput';
import { GenericSanctionScreeningTypes } from './custom/GenericSanctionScreeningTypes';
import { FuzzinessSettingsInput } from './custom/FuzzinessSettings';
import FreeTextEnumInput from './custom/FreeTextEnum';
import CountryRegion from '@/components/library/JsonSchemaEditor/Property/PropertyInput/custom/CountryRegion';
import { InputProps } from '@/components/library/Form';
import PhoneNumber from '@/components/library/JsonSchemaEditor/Property/PropertyInput/custom/fincen/PhoneNumber';
import ElectronicAddress from '@/components/library/JsonSchemaEditor/Property/PropertyInput/custom/fincen/ElectronicAddress';
import Gender from '@/components/library/JsonSchemaEditor/Property/PropertyInput/custom/fincen/Gender';
import { Props as LabelProps } from '@/components/library/Label';
import ListSelect from '@/components/ui/LogicBuilder/ListSelect';
import { SingleListSelectDynamic } from '@/components/ui/LogicBuilder/ListSelectDynamic';
import ScreeningProfileSelect from '@/components/ui/LogicBuilder/ScreeningProfileSelect';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  collapseForNestedProperties?: boolean;
  labelProps?: Partial<LabelProps>;
}

export default function PropertyInput(props: Props) {
  const { schema: _schema, collapseForNestedProperties, labelProps } = props;
  const { rootSchema } = useJsonSchemaEditorContext();
  const schema = dereferenceType(_schema, rootSchema);
  const uiSchema = getUiSchema(schema);
  if (uiSchema['ui:subtype'] === 'DAY_WINDOW') {
    return <DayWindowInput {...props} schema={schema} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'NARRATIVE') {
    return <NarrativeInput {...props} schema={schema} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'MARKDOWN') {
    return <MarkdownInput {...props} schema={schema} uiSchema={uiSchema} />;
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
    return <AgeRangeInput {...props} defaultGranularity={uiSchema?.['ui:defaultGranularity']} />;
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
  if (uiSchema['ui:subtype'] === 'FINCEN_PHONE_NUMBER') {
    return <PhoneNumber {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'FINCEN_ELECTRONIC_ADDRESS') {
    return <ElectronicAddress {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'FINCEN_GENDER') {
    return <Gender {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'FINCEN_NUMBER') {
    return <Number {...props} uiSchema={uiSchema} />;
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
  if (uiSchema['ui:subtype'] === 'WHITELIST') {
    const listType = uiSchema['ui:subtype'];
    return <ListSelect {...props} listType={listType} />;
  }
  if (uiSchema['ui:subtype'] === 'NUMBER_SLIDER_RANGE') {
    return <NumberRangeInput {...props} uiSchema={uiSchema} mode="RANGE" />;
  }
  if (uiSchema['ui:subtype'] === 'NUMBER_SLIDER_SINGLE') {
    return <NumberRangeInput {...props} uiSchema={uiSchema} mode="SINGLE" />;
  }
  if (uiSchema['ui:subtype'] === 'GENERIC_SANCTIONS_SCREENING_TYPES') {
    return <GenericSanctionScreeningTypes {...props} />;
  }
  if (uiSchema['ui:subtype'] === 'FUZZINESS_SETTINGS') {
    return <FuzzinessSettingsInput {...props} uiSchema={uiSchema} />;
  }
  if (uiSchema['ui:subtype'] === 'FREE_TEXT_ENUM') {
    return <FreeTextEnumInput {...props} schema={schema} uiSchema={uiSchema} />;
  }

  if (uiSchema['ui:subtype'] === 'TRANSACTION_TYPES') {
    return (
      <SingleListSelectDynamic
        onChange={(value) => {
          props.onChange?.(value);
        }}
        value={props.value}
        uniqueType={uiSchema['ui:uniqueType']}
      />
    );
  }

  if (uiSchema['ui:subtype'] === 'TRANSACTION_TYPE') {
    return (
      <SingleListSelectDynamic
        onChange={(value) => {
          props.onChange?.(value);
        }}
        value={props.value}
        uniqueType={uiSchema['ui:uniqueType']}
      />
    );
  }

  if (uiSchema['ui:subtype'] === 'SCREENING_PROFILE_ID') {
    return <ScreeningProfileSelect {...props} />;
  }
  const schemaType = schema.oneOf ? 'object' : schema.type;
  switch (schemaType) {
    case 'number':
    case 'boolean':
    case 'integer':
    case 'string':
      return <SimplePropertyInput {...props} schema={schema} />;
    case 'object':
      return (
        <ObjectPropertyInput
          {...props}
          schema={schema}
          collapseForNestedProperties={collapseForNestedProperties}
          labelProps={labelProps}
        />
      );
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
