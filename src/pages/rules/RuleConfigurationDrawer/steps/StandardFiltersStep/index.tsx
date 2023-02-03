import React from 'react';
import StepHeader from '../../StepHeader';
import { Rule } from '@/apis';
import PropertyList from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_FILTERS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';
import {
  ExtendedSchema,
  PropertyItems,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/types';
import {
  getOrderedProps,
  getUiSchema,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';

export interface FormValues {}

export const INITIAL_VALUES: FormValues = {};

interface Props {
  activeTab: string;
  rule: Rule;
}

export default function StandardFiltersStep(props: Props) {
  const { activeTab } = props;

  const api = useApi();
  const queryResults = useQuery(RULE_FILTERS(), () => api.getRuleFilters());

  return (
    <AsyncResourceRenderer resource={queryResults.data}>
      {({ schema }) => {
        const props = getOrderedProps(schema as ExtendedSchema);

        return (
          <>
            {activeTab === 'user_details' && (
              <UserDetails
                propertyItems={props.filter((x) => getUiSchema(x.schema)['ui:group'] === 'user')}
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
            {/*{activeTab === 'device_details' && <DeviceDetails {...props} />}*/}
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
}

function UserDetails(props: { propertyItems: PropertyItems }) {
  return (
    <>
      <StepHeader
        title={'User details'}
        description={'Add filters based on user profile attributes'}
      />
      <PropertyList items={props.propertyItems} />
    </>
  );
}

function GeographyDetails(props: { propertyItems: PropertyItems }) {
  return (
    <>
      <StepHeader
        title="Geography details"
        description="Add filters based on user's geographical attributes."
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
        description="Adjust the parameter values of your rule."
      />
      <PropertyList items={props.propertyItems} />
    </>
  );
}

// const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({
//   value: method,
//   label: getPaymentMethodTitle(method),
// }));
