export * from './ACHDetails';
export * from './ACHPaymentMethod';
export * from './Account';
export * from './AccountInvitePayload';
export * from './AccountRole';
export * from './Address';
export * from './Address1';
export * from './Address2';
export * from './Amount';
export * from './Assignment';
export * from './Business';
export * from './BusinessUsersListResponse';
export * from './CardDetails';
export * from './CardPaymentMethod';
export * from './ChangeTenantPayload';
export * from './Comment';
export * from './CompanyFinancialDetails';
export * from './CompanyGeneralDetails';
export * from './CompanyRegistrationDetails';
export * from './ConsumerName';
export * from './ConsumerUsersListResponse';
export * from './ContactDetails';
export * from './ContactDetails1';
export * from './DashboardStatsHitsPerUser';
export * from './DashboardStatsHitsPerUserData';
export * from './DashboardStatsRulesCount';
export * from './DashboardStatsRulesCountData';
export * from './DashboardStatsTransactionsCount';
export * from './DashboardStatsTransactionsCountData';
export * from './DeviceData';
export * from './ExecutedRulesResult';
export * from './Feature';
export * from './FileImport';
export * from './FileImportStatusChange';
export * from './FileInfo';
export * from './GeneralBankAccountPaymentMethod';
export * from './GenericBankAccountDetails';
export * from './HitRulesResult';
export * from './IBANDetails';
export * from './IBANPaymentMethod';
export * from './ImportRequest';
export * from './ImportResponse';
export * from './InlineResponse200';
export * from './InlineResponse400';
export * from './InternalBusinessUser';
export * from './InternalBusinessUserAllOf';
export * from './InternalConsumerUser';
export * from './InternalConsumerUserAllOf';
export * from './LegalDocument';
export * from './LegalDocument1';
export * from './LegalEntity';
export * from './ListImportRequest';
export * from './ManualRiskAssignmentPayload';
export * from './ManualRiskAssignmentUserState';
export * from './Person';
export * from './PresignedUrlResponse';
export * from './RiskClassificationScore';
export * from './RiskLevel';
export * from './RiskLevelRuleActions';
export * from './RiskLevelRuleParameters';
export * from './Rule';
export * from './RuleAction';
export * from './RuleAction1';
export * from './RuleImplementation';
export * from './RuleInstance';
export * from './SWIFTDetails';
export * from './SWIFTPaymentMethod';
export * from './Tag';
export * from './Tenant';
export * from './TenantSettings';
export * from './Transaction';
export * from './TransactionAmountDetails';
export * from './TransactionCaseManagement';
export * from './TransactionCaseManagementAllOf';
export * from './TransactionLimits';
export * from './TransactionLimits1';
export * from './TransactionState';
export * from './TransactionStatusChange';
export * from './TransactionUpdateRequest';
export * from './TransactionWithRulesResult';
export * from './TransactionWithRulesResultAllOf';
export * from './TransactionsListResponse';
export * from './UPIDetails';
export * from './UPIPaymentMethod';
export * from './User';
export * from './UserDetails';
export * from './UserDetails1';
export * from './WalletDetails';
export * from './WalletPaymentMethod';

import { ACHDetails } from './ACHDetails';
import { ACHPaymentMethod } from './ACHPaymentMethod';
import { Account } from './Account';
import { AccountInvitePayload } from './AccountInvitePayload';
import { AccountRole } from './AccountRole';
import { Address } from './Address';
import { Address1 } from './Address1';
import { Address2 } from './Address2';
import { Amount } from './Amount';
import { Assignment } from './Assignment';
import { Business } from './Business';
import { BusinessUsersListResponse } from './BusinessUsersListResponse';
import { CardDetails } from './CardDetails';
import { CardPaymentMethod } from './CardPaymentMethod';
import { ChangeTenantPayload } from './ChangeTenantPayload';
import { Comment } from './Comment';
import { CompanyFinancialDetails } from './CompanyFinancialDetails';
import { CompanyGeneralDetails } from './CompanyGeneralDetails';
import { CompanyRegistrationDetails } from './CompanyRegistrationDetails';
import { ConsumerName } from './ConsumerName';
import { ConsumerUsersListResponse } from './ConsumerUsersListResponse';
import { ContactDetails } from './ContactDetails';
import { ContactDetails1 } from './ContactDetails1';
import { DashboardStatsHitsPerUser } from './DashboardStatsHitsPerUser';
import { DashboardStatsHitsPerUserData } from './DashboardStatsHitsPerUserData';
import { DashboardStatsRulesCount } from './DashboardStatsRulesCount';
import { DashboardStatsRulesCountData } from './DashboardStatsRulesCountData';
import { DashboardStatsTransactionsCount } from './DashboardStatsTransactionsCount';
import { DashboardStatsTransactionsCountData } from './DashboardStatsTransactionsCountData';
import { DeviceData } from './DeviceData';
import { ExecutedRulesResult } from './ExecutedRulesResult';
import { Feature } from './Feature';
import { FileImport, FileImportTypeEnum } from './FileImport';
import { FileImportStatusChange, FileImportStatusChangeStatusEnum } from './FileImportStatusChange';
import { FileInfo } from './FileInfo';
import { GeneralBankAccountPaymentMethod } from './GeneralBankAccountPaymentMethod';
import { GenericBankAccountDetails } from './GenericBankAccountDetails';
import { HitRulesResult } from './HitRulesResult';
import { IBANDetails } from './IBANDetails';
import { IBANPaymentMethod } from './IBANPaymentMethod';
import { ImportRequest, ImportRequestTypeEnum, ImportRequestFormatEnum } from './ImportRequest';
import { ImportResponse } from './ImportResponse';
import { InlineResponse200 } from './InlineResponse200';
import { InlineResponse400 } from './InlineResponse400';
import { InternalBusinessUser, InternalBusinessUserTypeEnum } from './InternalBusinessUser';
import {
  InternalBusinessUserAllOf,
  InternalBusinessUserAllOfTypeEnum,
} from './InternalBusinessUserAllOf';
import { InternalConsumerUser, InternalConsumerUserTypeEnum } from './InternalConsumerUser';
import {
  InternalConsumerUserAllOf,
  InternalConsumerUserAllOfTypeEnum,
} from './InternalConsumerUserAllOf';
import { LegalDocument } from './LegalDocument';
import { LegalDocument1 } from './LegalDocument1';
import { LegalEntity } from './LegalEntity';
import { ListImportRequest } from './ListImportRequest';
import { ManualRiskAssignmentPayload } from './ManualRiskAssignmentPayload';
import { ManualRiskAssignmentUserState } from './ManualRiskAssignmentUserState';
import { Person } from './Person';
import { PresignedUrlResponse } from './PresignedUrlResponse';
import { RiskClassificationScore } from './RiskClassificationScore';
import { RiskLevel } from './RiskLevel';
import { RiskLevelRuleActions } from './RiskLevelRuleActions';
import { RiskLevelRuleParameters } from './RiskLevelRuleParameters';
import { Rule, RuleTypeEnum } from './Rule';
import { RuleAction } from './RuleAction';
import { RuleAction1 } from './RuleAction1';
import { RuleImplementation } from './RuleImplementation';
import { RuleInstance, RuleInstanceTypeEnum, RuleInstanceStatusEnum } from './RuleInstance';
import { SWIFTDetails } from './SWIFTDetails';
import { SWIFTPaymentMethod } from './SWIFTPaymentMethod';
import { Tag } from './Tag';
import { Tenant } from './Tenant';
import { TenantSettings } from './TenantSettings';
import { Transaction } from './Transaction';
import { TransactionAmountDetails } from './TransactionAmountDetails';
import { TransactionCaseManagement } from './TransactionCaseManagement';
import { TransactionCaseManagementAllOf } from './TransactionCaseManagementAllOf';
import { TransactionLimits } from './TransactionLimits';
import { TransactionLimits1 } from './TransactionLimits1';
import { TransactionState } from './TransactionState';
import { TransactionStatusChange } from './TransactionStatusChange';
import { TransactionUpdateRequest } from './TransactionUpdateRequest';
import { TransactionWithRulesResult } from './TransactionWithRulesResult';
import { TransactionWithRulesResultAllOf } from './TransactionWithRulesResultAllOf';
import { TransactionsListResponse } from './TransactionsListResponse';
import { UPIDetails } from './UPIDetails';
import { UPIPaymentMethod } from './UPIPaymentMethod';
import { User } from './User';
import { UserDetails } from './UserDetails';
import { UserDetails1 } from './UserDetails1';
import { WalletDetails } from './WalletDetails';
import { WalletPaymentMethod } from './WalletPaymentMethod';

/* tslint:disable:no-unused-variable */
let primitives = ['string', 'boolean', 'double', 'integer', 'long', 'float', 'number', 'any'];

const supportedMediaTypes: { [mediaType: string]: number } = {
  'application/json': Infinity,
  'application/octet-stream': 0,
  'application/x-www-form-urlencoded': 0,
};

let enumsMap: Set<string> = new Set<string>([
  'ACHPaymentMethod',
  'AccountRole',
  'CardPaymentMethod',
  'Feature',
  'FileImportTypeEnum',
  'FileImportStatusChangeStatusEnum',
  'GeneralBankAccountPaymentMethod',
  'IBANPaymentMethod',
  'ImportRequestTypeEnum',
  'ImportRequestFormatEnum',
  'InternalBusinessUserTypeEnum',
  'InternalBusinessUserAllOfTypeEnum',
  'InternalConsumerUserTypeEnum',
  'InternalConsumerUserAllOfTypeEnum',
  'RiskLevel',
  'RuleTypeEnum',
  'RuleAction',
  'RuleAction1',
  'RuleInstanceTypeEnum',
  'RuleInstanceStatusEnum',
  'SWIFTPaymentMethod',
  'TransactionState',
  'UPIPaymentMethod',
  'WalletPaymentMethod',
]);

let typeMap: { [index: string]: any } = {
  ACHDetails: ACHDetails,
  Account: Account,
  AccountInvitePayload: AccountInvitePayload,
  Address: Address,
  Address1: Address1,
  Address2: Address2,
  Amount: Amount,
  Assignment: Assignment,
  Business: Business,
  BusinessUsersListResponse: BusinessUsersListResponse,
  CardDetails: CardDetails,
  ChangeTenantPayload: ChangeTenantPayload,
  Comment: Comment,
  CompanyFinancialDetails: CompanyFinancialDetails,
  CompanyGeneralDetails: CompanyGeneralDetails,
  CompanyRegistrationDetails: CompanyRegistrationDetails,
  ConsumerName: ConsumerName,
  ConsumerUsersListResponse: ConsumerUsersListResponse,
  ContactDetails: ContactDetails,
  ContactDetails1: ContactDetails1,
  DashboardStatsHitsPerUser: DashboardStatsHitsPerUser,
  DashboardStatsHitsPerUserData: DashboardStatsHitsPerUserData,
  DashboardStatsRulesCount: DashboardStatsRulesCount,
  DashboardStatsRulesCountData: DashboardStatsRulesCountData,
  DashboardStatsTransactionsCount: DashboardStatsTransactionsCount,
  DashboardStatsTransactionsCountData: DashboardStatsTransactionsCountData,
  DeviceData: DeviceData,
  ExecutedRulesResult: ExecutedRulesResult,
  FileImport: FileImport,
  FileImportStatusChange: FileImportStatusChange,
  FileInfo: FileInfo,
  GenericBankAccountDetails: GenericBankAccountDetails,
  HitRulesResult: HitRulesResult,
  IBANDetails: IBANDetails,
  ImportRequest: ImportRequest,
  ImportResponse: ImportResponse,
  InlineResponse200: InlineResponse200,
  InlineResponse400: InlineResponse400,
  InternalBusinessUser: InternalBusinessUser,
  InternalBusinessUserAllOf: InternalBusinessUserAllOf,
  InternalConsumerUser: InternalConsumerUser,
  InternalConsumerUserAllOf: InternalConsumerUserAllOf,
  LegalDocument: LegalDocument,
  LegalDocument1: LegalDocument1,
  LegalEntity: LegalEntity,
  ListImportRequest: ListImportRequest,
  ManualRiskAssignmentPayload: ManualRiskAssignmentPayload,
  ManualRiskAssignmentUserState: ManualRiskAssignmentUserState,
  Person: Person,
  PresignedUrlResponse: PresignedUrlResponse,
  RiskClassificationScore: RiskClassificationScore,
  RiskLevelRuleActions: RiskLevelRuleActions,
  RiskLevelRuleParameters: RiskLevelRuleParameters,
  Rule: Rule,
  RuleImplementation: RuleImplementation,
  RuleInstance: RuleInstance,
  SWIFTDetails: SWIFTDetails,
  Tag: Tag,
  Tenant: Tenant,
  TenantSettings: TenantSettings,
  Transaction: Transaction,
  TransactionAmountDetails: TransactionAmountDetails,
  TransactionCaseManagement: TransactionCaseManagement,
  TransactionCaseManagementAllOf: TransactionCaseManagementAllOf,
  TransactionLimits: TransactionLimits,
  TransactionLimits1: TransactionLimits1,
  TransactionStatusChange: TransactionStatusChange,
  TransactionUpdateRequest: TransactionUpdateRequest,
  TransactionWithRulesResult: TransactionWithRulesResult,
  TransactionWithRulesResultAllOf: TransactionWithRulesResultAllOf,
  TransactionsListResponse: TransactionsListResponse,
  UPIDetails: UPIDetails,
  User: User,
  UserDetails: UserDetails,
  UserDetails1: UserDetails1,
  WalletDetails: WalletDetails,
};

export class ObjectSerializer {
  public static findCorrectType(data: any, expectedType: string) {
    if (data == undefined) {
      return expectedType;
    } else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
      return expectedType;
    } else if (expectedType === 'Date') {
      return expectedType;
    } else {
      if (enumsMap.has(expectedType)) {
        return expectedType;
      }

      if (!typeMap[expectedType]) {
        return expectedType; // w/e we don't know the type
      }

      // Check the discriminator
      let discriminatorProperty = typeMap[expectedType].discriminator;
      if (discriminatorProperty == null) {
        return expectedType; // the type does not have a discriminator. use it.
      } else {
        if (data[discriminatorProperty]) {
          var discriminatorType = data[discriminatorProperty];
          if (typeMap[discriminatorType]) {
            return discriminatorType; // use the type given in the discriminator
          } else {
            return expectedType; // discriminator did not map to a type
          }
        } else {
          return expectedType; // discriminator was not present (or an empty string)
        }
      }
    }
  }

  public static serialize(data: any, type: string, format: string) {
    if (data == undefined) {
      return data;
    } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
      return data;
    } else if (type.lastIndexOf('Array<', 0) === 0) {
      // string.startsWith pre es6
      let subType: string = type.replace('Array<', ''); // Array<Type> => Type>
      subType = subType.substring(0, subType.length - 1); // Type> => Type
      let transformedData: any[] = [];
      for (let index in data) {
        let date = data[index];
        transformedData.push(ObjectSerializer.serialize(date, subType, format));
      }
      return transformedData;
    } else if (type === 'Date') {
      if (format == 'date') {
        let month = data.getMonth() + 1;
        month = month < 10 ? '0' + month.toString() : month.toString();
        let day = data.getDate();
        day = day < 10 ? '0' + day.toString() : day.toString();

        return data.getFullYear() + '-' + month + '-' + day;
      } else {
        return data.toISOString();
      }
    } else {
      if (enumsMap.has(type)) {
        return data;
      }
      if (!typeMap[type]) {
        // in case we dont know the type
        return data;
      }

      // Get the actual type of this object
      type = this.findCorrectType(data, type);

      // get the map for the correct type.
      let attributeTypes = typeMap[type].getAttributeTypeMap();
      let instance: { [index: string]: any } = {};
      for (let index in attributeTypes) {
        let attributeType = attributeTypes[index];
        instance[attributeType.baseName] = ObjectSerializer.serialize(
          data[attributeType.name],
          attributeType.type,
          attributeType.format,
        );
      }
      return instance;
    }
  }

  public static deserialize(data: any, type: string, format: string) {
    // polymorphism may change the actual type.
    type = ObjectSerializer.findCorrectType(data, type);
    if (data == undefined) {
      return data;
    } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
      return data;
    } else if (type.lastIndexOf('Array<', 0) === 0) {
      // string.startsWith pre es6
      let subType: string = type.replace('Array<', ''); // Array<Type> => Type>
      subType = subType.substring(0, subType.length - 1); // Type> => Type
      let transformedData: any[] = [];
      for (let index in data) {
        let date = data[index];
        transformedData.push(ObjectSerializer.deserialize(date, subType, format));
      }
      return transformedData;
    } else if (type === 'Date') {
      return new Date(data);
    } else {
      if (enumsMap.has(type)) {
        // is Enum
        return data;
      }

      if (!typeMap[type]) {
        // dont know the type
        return data;
      }
      let instance = new typeMap[type]();
      let attributeTypes = typeMap[type].getAttributeTypeMap();
      for (let index in attributeTypes) {
        let attributeType = attributeTypes[index];
        instance[attributeType.name] = ObjectSerializer.deserialize(
          data[attributeType.baseName],
          attributeType.type,
          attributeType.format,
        );
      }
      return instance;
    }
  }

  /**
   * Normalize media type
   *
   * We currently do not handle any media types attributes, i.e. anything
   * after a semicolon. All content is assumed to be UTF-8 compatible.
   */
  public static normalizeMediaType(mediaType: string | undefined): string | undefined {
    if (mediaType === undefined) {
      return undefined;
    }
    return mediaType.split(';')[0].trim().toLowerCase();
  }

  /**
   * From a list of possible media types, choose the one we can handle best.
   *
   * The order of the given media types does not have any impact on the choice
   * made.
   */
  public static getPreferredMediaType(mediaTypes: Array<string>): string {
    /** According to OAS 3 we should default to json */
    if (!mediaTypes) {
      return 'application/json';
    }

    const normalMediaTypes = mediaTypes.map(this.normalizeMediaType);
    let selectedMediaType: string | undefined = undefined;
    let selectedRank: number = -Infinity;
    for (const mediaType of normalMediaTypes) {
      if (supportedMediaTypes[mediaType!] > selectedRank) {
        selectedMediaType = mediaType;
        selectedRank = supportedMediaTypes[mediaType!];
      }
    }

    if (selectedMediaType === undefined) {
      throw new Error('None of the given media types are supported: ' + mediaTypes.join(', '));
    }

    return selectedMediaType!;
  }

  /**
   * Convert data to a string according the given media type
   */
  public static stringify(data: any, mediaType: string): string {
    if (mediaType === 'application/json') {
      return JSON.stringify(data);
    }

    throw new Error(
      'The mediaType ' + mediaType + ' is not supported by ObjectSerializer.stringify.',
    );
  }

  /**
   * Parse data from a string according to the given media type
   */
  public static parse(rawData: string, mediaType: string | undefined) {
    if (mediaType === undefined) {
      throw new Error('Cannot parse content. No Content-Type defined.');
    }

    if (mediaType === 'application/json') {
      return JSON.parse(rawData);
    }

    throw new Error('The mediaType ' + mediaType + ' is not supported by ObjectSerializer.parse.');
  }
}
