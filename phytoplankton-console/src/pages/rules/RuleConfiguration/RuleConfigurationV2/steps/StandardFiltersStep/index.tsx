import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import StepHeader from '../../StepHeader';
import { Rule } from '@/apis';
import PropertyList from '@/components/library/JsonSchemaEditor/PropertyList';
import { useRuleFilters } from '@/hooks/api/rules';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { ExtendedSchema, PropertyItems } from '@/components/library/JsonSchemaEditor/types';
import { getUiSchema, getOrderedProps } from '@/components/library/JsonSchemaEditor/utils';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface FormValues extends Record<string, any> {}

export const INITIAL_VALUES: FormValues = {};

interface Props {
  activeTab: string;
  rule: Rule;
  standardFilters: FormValues;
}

export default function StandardFiltersStep(props: Props) {
  const { activeTab, standardFilters } = props;

  const queryResults = useRuleFilters();

  return (
    <AsyncResourceRenderer resource={queryResults.data}>
      {({ schema }) => {
        const props = getOrderedProps(schema as ExtendedSchema);

        return (
          <>
            {activeTab === 'user_details' && (
              <UserDetails
                propertyItems={props
                  .filter((x) => getUiSchema(x.schema)['ui:group'] === 'user')
                  .filter((x) => {
                    const consumerUserSegments = 'consumerUserSegments';
                    const businessUserSegments = 'businessUserSegments';
                    if (x.name === consumerUserSegments) {
                      return standardFilters?.userType?.includes('CONSUMER');
                    } else if (x.name === businessUserSegments) {
                      return standardFilters?.userType?.includes('BUSINESS');
                    }
                    return true;
                  })}
              />
            )}
            {activeTab === 'geography_details' && (
              <GeographyDetails
                propertyItems={props.filter(
                  (x) => getUiSchema(x.schema)['ui:group'] === 'geography',
                )}
              />
            )}
            {activeTab === 'transaction_details' && (
              <TransactionDetails
                propertyItems={props.filter(
                  (x) => getUiSchema(x.schema)['ui:group'] === 'transaction',
                )}
              />
            )}
            {activeTab === 'transaction_details_historical' && (
              <TransactionDetailsHistorical
                propertyItems={props.filter(
                  (x) => getUiSchema(x.schema)['ui:group'] === 'transaction_historical',
                )}
              />
            )}
            {activeTab === 'general' && (
              <General
                propertyItems={props.filter((x) => getUiSchema(x.schema)['ui:group'] === 'general')}
              />
            )}
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
}

function UserDetails(props: { propertyItems: PropertyItems }) {
  const settings = useSettings();
  return (
    <>
      <StepHeader
        title={`${firstLetterUpper(settings.userAlias)} details`}
        description={`Add filters based on ${settings.userAlias} profile attributes`}
      />
      <PropertyList items={props.propertyItems} />
    </>
  );
}

function GeographyDetails(props: { propertyItems: PropertyItems }) {
  const settings = useSettings();
  return (
    <>
      <StepHeader
        title="Geography details"
        description={`Add filters based on ${settings.userAlias}'s geographical attributes.`}
      />
      <PropertyList items={props.propertyItems} />
    </>
  );
}
function TransactionDetails(props: { propertyItems: PropertyItems }) {
  return (
    <>
      <StepHeader
        title="Transaction details"
        description="Add filters based on transaction's attributes (for the new transaction)"
      />
      <PropertyList items={props.propertyItems} />
    </>
  );
}

function TransactionDetailsHistorical(props: { propertyItems: PropertyItems }) {
  return (
    <>
      <StepHeader
        title="Historical transactions"
        description="Add filters based on transaction's attributes (for the historical transactions). These filters take no effect if the rule doesn't need to check historical transactions."
      />
      <PropertyList items={props.propertyItems} />
    </>
  );
}

function General(props: { propertyItems: PropertyItems }) {
  return (
    <>
      <StepHeader title="General" description="" />
      <PropertyList items={props.propertyItems} />
    </>
  );
}
