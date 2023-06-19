import React, { useEffect } from 'react';
import StepHeader from '../../StepHeader';
import { RuleConfigurationFormValues } from '../../RuleConfigurationForm';
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

export interface FormValues extends Record<string, any> {}

export const INITIAL_VALUES: FormValues = {};

interface Props {
  activeTab: string;
  rule: Rule;
  standardFilters: FormValues;
  setFormValues: React.Dispatch<React.SetStateAction<RuleConfigurationFormValues>>;
}

export default function StandardFiltersStep(props: Props) {
  const { activeTab, standardFilters, setFormValues } = props;

  const api = useApi();
  const queryResults = useQuery(RULE_FILTERS(), () => api.getRuleFilters());

  useEffect(() => {
    if (standardFilters?.paymentMethods?.includes('WALLET')) {
      setFormValues((prev) => {
        if (prev?.standardFiltersStep?.walletType) {
          delete prev?.standardFiltersStep?.walletType;
        }
        return prev;
      });
    }

    if (standardFilters?.userType !== 'CONSUMER') {
      setFormValues((prev) => {
        if (prev?.standardFiltersStep?.consumerUserSegments) {
          delete prev?.standardFiltersStep?.consumerUserSegments;
        }
        return prev;
      });
    }
  }, [standardFilters?.paymentMethods, setFormValues, standardFilters?.userType]);

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
                    const nameToFilter = 'consumerUserSegments';
                    if (x.name === nameToFilter) {
                      return standardFilters?.userType?.includes('CONSUMER');
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
            {/* TODO: Implement Optional filters in proper way */}
            {activeTab === 'transaction_details' && (
              <TransactionDetails
                propertyItems={props
                  .filter((x) => getUiSchema(x.schema)['ui:group'] === 'transaction')
                  .filter((x) => {
                    const nameToFilter = 'walletType';
                    if (x.name === nameToFilter) {
                      return standardFilters?.paymentMethods?.includes('WALLET');
                    }
                    return true;
                  })}
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
