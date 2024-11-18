import React from 'react';
import { COPILOT_QUESTIONS } from '@flagright/lib/utils';
import { LogicAggregationVariable } from '@/apis';
import { UseCase } from '@/pages/storybook/components';
import HistoryItem from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { QuestionResponse } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import fixture from '@/components/ui/LogicBuilder/story-fixture.json';

export default function (): JSX.Element {
  const items: { [key in QuestionResponse['questionType']]: QuestionResponse } = {
    RULE_HIT: {
      questionType: 'RULE_HIT',
      title: 'Some title',
      questionId: 'test2',
      variables: [],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
      ruleType: 'TRANSACTION',
      hitRulesDetails: {
        ruleId: 'RC-102',
        ruleInstanceId: 'h4b18fnrh3',
        ruleName: 'Transaction amount too high',
        ruleDescription:
          'Unique transaction’s origin email id’s of a specific payment method and transaction state in the last 30 days',
        ruleAction: 'SUSPEND',
      },
      ruleLogic: fixture.logic,
      ruleSummary:
        'This rule checks for mentioned user’s transactions origin Email ID in the last 10 days with transaction time stamp recorded at 2024-04-01, 19:48:33 and used payment method is card or transaction state is blocked. ',
      logicAggregationVariables: fixture.aggregationVariables as LogicAggregationVariable[],
      logicEntityVariables: fixture.entityVariablesInUse,
    },
    SCREENING_COMPARISON: {
      questionType: 'SCREENING_COMPARISON',
      title: 'SCREENING_COMPARISON answer title',
      questionId: 'test',
      variables: [],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
      sanctionsHit: {
        searchId: '81f0e047-a6ae-45da-af09-cc34b74c9496',
        createdAt: 1726500154888,
        updatedAt: 1726500154888,
        sanctionsHitId: 'SH-997436',
        provider: 'comply-advantage',
        status: 'OPEN',
        hitContext: {
          userId: 'U-44',
          entity: 'USER',
          entityType: 'CONSUMER_NAME',
          searchTerm: 'Jane Smith',
          yearOfBirth: 1985,
        },
        entity: {
          id: '449bca0d-8784-45d7-ac4d-f04ec7055bf8',
          updatedAt: 1726500154888,
          types: ['sanction', 'adverse-media', 'pep'],
          name: 'GreenSolutions#500',
          entityType: 'organisation',
          sanctionsSources: [
            {
              countryCodes: ['RU'],
              createdAt: 1645747200000,
              name: 'United Kingdom HM Treasury Office of Financial Sanctions Implementation Consolidated List',
              url: 'https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets',
            },
            {
              countryCodes: ['RU'],
              name: 'ComplyAdvantage PEP Data',
            },
            {
              countryCodes: ['AU', 'CZ'],
              name: 'company AM',
            },
            {
              countryCodes: ['RU'],
              createdAt: 1645747200000,
              name: 'Belgium Consolidated List of the National and European Sanctions',
              url: 'https://finance.belgium.be/en/control-financial-instruments-and-institutions/compliance/financial-sanctions',
            },
          ],
          mediaSources: [
            {
              name: 'Entenda o rapto de crianças ucranianas citado por Zelensky na ONU e que embasa ordem de prisão contra Putin | Ucrânia e Rússia | G1',
              url: 'https://g1.globo.com/google/amp/mundo/ucrania-russia/noticia/2023/09/24/entenda-o-rapto-de-criancas-ucranianas-citado-por-zelensky-na-onu-e-que-embasa-ordem-de-prisao-contra-putin.ghtml',
            },
            {
              name: "How a convicted woman US felon has become Putin's new mouthpiece | Daily Mail Online",
              url: 'https://www.dailymail.co.uk/galleries/article-13411497/How-convicted-woman-felon-Putins-new-mouthpiece.html?ico=topics_pagination_desktop',
            },
            {
              name: 'Entenda o rapto de crianças ucranianas citado por Zelensky na ONU e que embasa ordem de prisão contra Putin | Ucrânia e Rússia | G1',
              url: 'https://g1.globo.com/google/amp/mundo/ucrania-russia/noticia/2023/09/24/entenda-o-rapto-de-criancas-ucranianas-citado-por-zelensky-na-onu-e-que-embasa-ordem-de-prisao-contra-putin.ghtml',
            },
            {
              name: 'How cohesive are the bricks of BRICS to shake the US-led global order? | The Business Standard',
              url: 'https://www.tbsnews.net/features/panorama/how-cohesive-are-bricks-brics-shake-us-led-global-order-687022?amp',
            },
          ],
          pepSources: [
            {
              countryCodes: ['IN'],
              name: 'India PEP Watchlist',
              createdAt: 1675242900000,
            },
            {
              countryCodes: ['IN'],
              name: 'India PEP Watchlist',
              createdAt: 1675242900000,
            },
            {
              countryCodes: ['RU'],
              name: 'ComplyAdvantage PEP Data',
              createdAt: 1646870400000,
            },
            {
              countryCodes: ['DE', 'FR'],
              name: 'European PEP Records',
              createdAt: 1641393900000,
            },
          ],
          countries: ['Russian Federation', 'Turkey', 'Portugal'],
          matchTypeDetails: [
            {
              sources: ['source1'],
              matchingName: 'Jane Smith',
              secondaryMatches: [{ query_term: '02-02-1985' }],
              nameMatches: [{ match_types: ['exact_match'] }],
            },
            {
              sources: ['source2'],
              matchingName: 'Jane Smith',
              secondaryMatches: [{ query_term: '02-02-1985' }],
              nameMatches: [{ match_types: ['exact_match'] }],
            },
          ],
        },
      },
    },
    TABLE: {
      questionType: 'TABLE',
      title: 'TABLE answer title',
      questionId: 'test',
      variables: [],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
      headers: [
        {
          name: 'Alert ID',
          columnType: 'ID',
        },
        {
          name: 'Case ID',
          columnType: 'ID',
        },
        {
          name: 'Created on',
          columnType: 'DATE_TIME',
        },
        {
          name: '#TX',
          columnType: 'NUMBER',
        },
        {
          name: 'Rule ID',
          columnType: 'ID',
        },
        {
          name: 'Rule name',
          columnType: 'STRING',
        },
        {
          name: 'Rule description',
          columnType: 'STRING',
        },
        {
          name: 'Rule action',
          columnType: 'TAG',
        },
        {
          name: 'Rule nature',
          columnType: 'TAG',
        },
        {
          name: 'Alert status',
          columnType: 'TAG',
        },
        {
          name: 'Case status',
          columnType: 'TAG',
        },
        {
          name: 'Closing reason',
          columnType: 'STRING',
        },
        {
          name: 'Last updated at',
          columnType: 'DATE_TIME',
        },
      ],
      rows: [
        [
          'A-112',
          'C-245',
          1724471543316,
          1,
          'R-2',
          'Transaction amount too high',
          'Transaction amount is >= x in USD or equivalent',
          'SUSPEND',
          'AML',
          'OPEN',
          'ESCALATED_IN_PROGRESS',
          null,
          1725985728046,
        ],
        [
          'A-113',
          'C-248',
          1724718698839,
          1,
          'R-169',
          'Tx’s counterparty screening',
          'Screening transaction’s counterparty for Sanctions/PEP/Adverse media',
          'SUSPEND',
          'SCREENING',
          'OPEN',
          'REOPENED',
          null,
          1725185145670,
        ],
        [
          'A-114',
          'C-248',
          1724718698839,
          0,
          'R-32',
          'Screening on Bank name',
          'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution option available in rule configuration.',
          'SUSPEND',
          'SCREENING',
          'OPEN',
          'REOPENED',
          null,
          1726077403599,
        ],
      ],
    },
    TIME_SERIES: {
      questionType: 'TIME_SERIES',
      title: 'TIME_SERIES answer title',
      questionId: 'test',
      variables: [],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
      timeseries: [
        {
          label: 'Test series 1',
          values: [
            { time: 3600 * 1000 * 100, value: Math.random() * 10 },
            { time: 3600 * 1000 * 200, value: Math.random() * 10 },
            { time: 3600 * 1000 * 300, value: Math.random() * 10 },
            { time: 3600 * 1000 * 400, value: Math.random() * 10 },
            { time: 3600 * 1000 * 500, value: Math.random() * 10 },
          ],
        },
        {
          label: 'Test series 2',
          values: [
            { time: 3600 * 1000 * 100, value: Math.random() * 20 },
            { time: 3600 * 1000 * 200, value: Math.random() * 20 },
            { time: 3600 * 1000 * 300, value: Math.random() * 20 },
            { time: 3600 * 1000 * 400, value: Math.random() * 20 },
            { time: 3600 * 1000 * 500, value: Math.random() * 20 },
          ],
        },
      ],
    },
    BARCHART: {
      questionType: 'BARCHART',
      title: 'BARCHART answer title',
      questionId: 'test',
      variables: [],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
      values: [
        { x: 'a', y: Math.random() * 10 },
        { x: 'b', y: Math.random() * 10 },
        { x: 'c', y: Math.random() * 10 },
        { x: 'd', y: Math.random() * 10 },
        { x: 'e', y: Math.random() * 10 },
      ],
    },
    PROPERTIES: {
      questionType: 'PROPERTIES',
      title: 'PROPERTIES answer title',
      questionId: 'test',
      variables: [],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
      properties: [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ],
    },
    EMBEDDED: {
      questionType: 'EMBEDDED',
      title: `EMBEDDED answer title (${COPILOT_QUESTIONS.RECOMMENDATION})`,
      questionId: COPILOT_QUESTIONS.RECOMMENDATION,
      variables: [
        {
          name: 'alertId',
          value: 'test_alert',
        },
      ],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
    },
    STACKED_BARCHART: {
      questionType: 'STACKED_BARCHART',
      title: 'STACKED_BARCHART answer title',
      questionId: 'test',
      variables: [],
      variableOptions: [],
      createdById: 'test-user-id',
      createdAt: new Date().getDate(),
      series: [
        {
          label: 'Test series #1',
          values: [
            { x: 'a', y: Math.random() * 10 },
            { x: 'b', y: Math.random() * 10 },
            { x: 'c', y: Math.random() * 10 },
            { x: 'd', y: Math.random() * 10 },
            { x: 'e', y: Math.random() * 10 },
          ],
        },
        {
          label: 'Test series #1',
          values: [
            { x: 'a', y: Math.random() * 20 },
            { x: 'b', y: Math.random() * 20 },
            { x: 'c', y: Math.random() * 20 },
            { x: 'd', y: Math.random() * 20 },
            { x: 'e', y: Math.random() * 20 },
          ],
        },
      ],
    },
  };
  return (
    <>
      <UseCase title={'History items'}>
        <PropertyMatrix yLabel={'type'} y={Object.keys(items)}>
          {(_, itemType) => <HistoryItem item={items[itemType]} alertId={'test'} isUnread={true} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
