import {
  InternalBusinessUser,
  InternalConsumerUser,
  InternalTransaction,
  RiskScoreComponent,
} from '@/apis';

export function getRandomTimestamp() {
  const timeStamps = [1680020420000, 1680020421000, 1680020421000, 1680010421000];
  const randomIndex = Math.floor(Math.random() * timeStamps.length);
  return timeStamps[randomIndex];
}

export type AIRiskScoreComponents = {
  components: Partial<RiskScoreComponent>[];
};

export const TRANSACTION_DATA = (transaction: InternalTransaction): AIRiskScoreComponents[] => [
  {
    components: [
      {
        value: transaction?.destinationPaymentDetails?.method,
        entityType: 'TRANSACTION',
        parameter: 'destinationPaymentDetails.method',
      },
      {
        value: transaction?.originAmountDetails?.country,
        entityType: 'TRANSACTION',
        parameter: 'originAmountDetails.country',
      },
      {
        value: transaction?.originAmountDetails?.transactionCurrency,
        entityType: 'TRANSACTION',
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method,
        entityType: 'TRANSACTION',
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: transaction?.timestamp,
        entityType: 'TRANSACTION',
        parameter: 'timestamp',
      },
      {
        value: transaction?.destinationAmountDetails?.country,
        entityType: 'TRANSACTION',
        parameter: 'destinationAmountDetails.country',
      },
      {
        value: transaction?.destinationAmountDetails?.transactionCurrency,
        entityType: 'TRANSACTION',
        parameter: 'destinationAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method,
        entityType: 'TRANSACTION',
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: transaction?.timestamp,
        entityType: 'TRANSACTION',
        parameter: 'timestamp',
      },
      {
        value: transaction?.originAmountDetails?.transactionCurrency,
        entityType: 'TRANSACTION',
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method,
        entityType: 'TRANSACTION',
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: transaction?.timestamp,
        entityType: 'TRANSACTION',
        parameter: 'timestamp',
      },
      {
        value: transaction?.destinationAmountDetails?.country,
        entityType: 'TRANSACTION',
        parameter: 'destinationAmountDetails.country',
      },
      {
        value: transaction?.destinationAmountDetails?.transactionCurrency,
        entityType: 'TRANSACTION',
        parameter: 'destinationAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.destinationPaymentDetails?.method,
        entityType: 'TRANSACTION',
        parameter: 'destinationPaymentDetails.method',
      },
      {
        value: transaction?.originAmountDetails?.country,
        entityType: 'TRANSACTION',
        parameter: 'originAmountDetails.country',
      },
      {
        value: transaction?.originAmountDetails?.transactionCurrency,
        entityType: 'TRANSACTION',
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method,
        entityType: 'TRANSACTION',
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: transaction?.timestamp,
        entityType: 'TRANSACTION',
        parameter: 'timestamp',
      },
      {
        value: transaction?.destinationAmountDetails?.country,
        entityType: 'TRANSACTION',
        parameter: 'destinationAmountDetails.country',
      },
    ],
  },
];

export const BUSINESS_DATA = (user: InternalBusinessUser): AIRiskScoreComponents[] => [
  {
    components: [
      {
        value: user?.legalEntity?.companyRegistrationDetails?.registrationCountry,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
      },
      {
        value: user?.legalEntity?.companyGeneralDetails?.businessIndustry,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.businessIndustry',
      },
      {
        value: user?.legalEntity?.companyGeneralDetails?.userSegment,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.userSegment',
      },
    ],
  },
  {
    components: [
      {
        value: user?.legalEntity?.companyGeneralDetails?.userSegment,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.userSegment',
      },
      {
        value: user?.legalEntity?.companyGeneralDetails?.userRegistrationStatus,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
      },
    ],
  },
  {
    components: [
      {
        value: user?.legalEntity?.companyGeneralDetails?.userSegment,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.userSegment',
      },
      {
        value: user?.legalEntity?.companyGeneralDetails?.userRegistrationStatus,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
      },
      {
        value: user?.legalEntity?.companyRegistrationDetails?.registrationCountry,
        entityType: 'BUSINESS',
        parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
      },
      {
        value: user?.directors?.[0]?.generalDetails?.countryOfNationality,
        entityType: 'BUSINESS',
        parameter: 'directors',
      },
      {
        value: user?.shareHolders?.[0]?.generalDetails?.countryOfNationality,
        entityType: 'BUSINESS',
        parameter: 'shareHolders',
      },
    ],
  },
];

export const CONSUMER_DATA = (user: InternalConsumerUser): AIRiskScoreComponents[] => [
  {
    components: [
      {
        value: user?.userDetails?.countryOfResidence,
        entityType: 'CONSUMER_USER',
        parameter: 'userDetails.countryOfResidence',
      },
      {
        value: user?.userDetails?.countryOfNationality,
        entityType: 'CONSUMER_USER',
        parameter: 'userDetails.countryOfNationality',
      },
      {
        value: user?.userDetails?.dateOfBirth,
        entityType: 'CONSUMER_USER',
        parameter: 'userDetails.dateOfBirth',
      },
      {
        value: user?.userSegment,
        entityType: 'CONSUMER_USER',
        parameter: 'userSegment',
      },
    ],
  },
  {
    components: [
      {
        value: user?.employmentStatus,
        entityType: 'CONSUMER_USER',
        parameter: 'employmentStatus',
      },
      {
        value: user?.occupation,
        entityType: 'CONSUMER_USER',
        parameter: 'occupation',
      },
    ],
  },
  {
    components: [
      {
        value: user?.userDetails?.countryOfResidence,
        entityType: 'CONSUMER_USER',
        parameter: 'userDetails.countryOfResidence',
      },
      {
        value: user?.type,
        entityType: 'CONSUMER_USER',
        parameter: 'type',
      },
      {
        value: user?.userDetails?.countryOfNationality,
        entityType: 'CONSUMER_USER',
        parameter: 'userDetails.countryOfNationality',
      },
    ],
  },
];
