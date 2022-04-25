export * from './ACHDetails';
export * from './Address';
export * from './Address1';
export * from './Address2';
export * from './Amount';
export * from './Assignment';
export * from './Business';
export * from './BusinessUsersListResponse';
export * from './CardDetails';
export * from './Comment';
export * from './CompanyFinancialDetails';
export * from './CompanyGeneralDetails';
export * from './CompanyRegistrationDetails';
export * from './ConsumerName';
export * from './ConsumerUsersListResponse';
export * from './ContactDetails';
export * from './ContactDetails1';
export * from './DeviceData';
export * from './ExecutedRulesResult';
export * from './FailedRulesResult';
export * from './FileImport';
export * from './FileImportStatusChange';
export * from './FileInfo';
export * from './IBANDetails';
export * from './ImportRequest';
export * from './ImportResponse';
export * from './LegalDocument';
export * from './LegalDocument1';
export * from './LegalEntity';
export * from './ListImportRequest';
export * from './ModelDate';
export * from './Person';
export * from './PresignedUrlResponse';
export * from './Rule';
export * from './RuleAction';
export * from './RuleAction1';
export * from './RuleFailureException';
export * from './RuleImplementation';
export * from './RuleInstance';
export * from './Tag';
export * from './Transaction';
export * from './TransactionAmountDetails';
export * from './TransactionCaseManagement';
export * from './TransactionCaseManagementAllOf';
export * from './TransactionLimits';
export * from './TransactionStatusChange';
export * from './TransactionUpdateRequest';
export * from './TransactionWithRulesResult';
export * from './TransactionWithRulesResultAllOf';
export * from './TransactionsListResponse';
export * from './UPIDetails';
export * from './User';
export * from './UserDetails';
export * from './UserDetails1';

import { ACHDetails } from './ACHDetails';
import { Address } from './Address';
import { Address1 } from './Address1';
import { Address2 } from './Address2';
import { Amount } from './Amount';
import { Assignment } from './Assignment';
import { Business } from './Business';
import { BusinessUsersListResponse } from './BusinessUsersListResponse';
import { CardDetails } from './CardDetails';
import { Comment } from './Comment';
import { CompanyFinancialDetails } from './CompanyFinancialDetails';
import { CompanyGeneralDetails } from './CompanyGeneralDetails';
import { CompanyRegistrationDetails } from './CompanyRegistrationDetails';
import { ConsumerName } from './ConsumerName';
import { ConsumerUsersListResponse } from './ConsumerUsersListResponse';
import { ContactDetails } from './ContactDetails';
import { ContactDetails1 } from './ContactDetails1';
import { DeviceData } from './DeviceData';
import { ExecutedRulesResult } from './ExecutedRulesResult';
import { FailedRulesResult } from './FailedRulesResult';
import { FileImport, FileImportTypeEnum } from './FileImport';
import { FileImportStatusChange, FileImportStatusChangeStatusEnum } from './FileImportStatusChange';
import { FileInfo } from './FileInfo';
import { IBANDetails } from './IBANDetails';
import { ImportRequest, ImportRequestTypeEnum, ImportRequestFormatEnum } from './ImportRequest';
import { ImportResponse } from './ImportResponse';
import { LegalDocument } from './LegalDocument';
import { LegalDocument1 } from './LegalDocument1';
import { LegalEntity } from './LegalEntity';
import { ListImportRequest } from './ListImportRequest';
import { ModelDate } from './ModelDate';
import { Person } from './Person';
import { PresignedUrlResponse } from './PresignedUrlResponse';
import { Rule } from './Rule';
import { RuleAction } from './RuleAction';
import { RuleAction1 } from './RuleAction1';
import { RuleFailureException } from './RuleFailureException';
import { RuleImplementation } from './RuleImplementation';
import { RuleInstance, RuleInstanceStatusEnum } from './RuleInstance';
import { Tag } from './Tag';
import { Transaction } from './Transaction';
import { TransactionAmountDetails } from './TransactionAmountDetails';
import { TransactionCaseManagement } from './TransactionCaseManagement';
import { TransactionCaseManagementAllOf } from './TransactionCaseManagementAllOf';
import { TransactionLimits } from './TransactionLimits';
import { TransactionStatusChange } from './TransactionStatusChange';
import { TransactionUpdateRequest } from './TransactionUpdateRequest';
import { TransactionWithRulesResult } from './TransactionWithRulesResult';
import { TransactionWithRulesResultAllOf } from './TransactionWithRulesResultAllOf';
import { TransactionsListResponse } from './TransactionsListResponse';
import { UPIDetails } from './UPIDetails';
import { User } from './User';
import { UserDetails } from './UserDetails';
import { UserDetails1 } from './UserDetails1';

/* tslint:disable:no-unused-variable */
let primitives = ['string', 'boolean', 'double', 'integer', 'long', 'float', 'number', 'any'];

const supportedMediaTypes: { [mediaType: string]: number } = {
  'application/json': Infinity,
  'application/octet-stream': 0,
  'application/x-www-form-urlencoded': 0,
};

let enumsMap: Set<string> = new Set<string>([
  'FileImportTypeEnum',
  'FileImportStatusChangeStatusEnum',
  'ImportRequestTypeEnum',
  'ImportRequestFormatEnum',
  'RuleAction',
  'RuleAction1',
  'RuleInstanceStatusEnum',
]);

let typeMap: { [index: string]: any } = {
  ACHDetails: ACHDetails,
  Address: Address,
  Address1: Address1,
  Address2: Address2,
  Amount: Amount,
  Assignment: Assignment,
  Business: Business,
  BusinessUsersListResponse: BusinessUsersListResponse,
  CardDetails: CardDetails,
  Comment: Comment,
  CompanyFinancialDetails: CompanyFinancialDetails,
  CompanyGeneralDetails: CompanyGeneralDetails,
  CompanyRegistrationDetails: CompanyRegistrationDetails,
  ConsumerName: ConsumerName,
  ConsumerUsersListResponse: ConsumerUsersListResponse,
  ContactDetails: ContactDetails,
  ContactDetails1: ContactDetails1,
  DeviceData: DeviceData,
  ExecutedRulesResult: ExecutedRulesResult,
  FailedRulesResult: FailedRulesResult,
  FileImport: FileImport,
  FileImportStatusChange: FileImportStatusChange,
  FileInfo: FileInfo,
  IBANDetails: IBANDetails,
  ImportRequest: ImportRequest,
  ImportResponse: ImportResponse,
  LegalDocument: LegalDocument,
  LegalDocument1: LegalDocument1,
  LegalEntity: LegalEntity,
  ListImportRequest: ListImportRequest,
  ModelDate: ModelDate,
  Person: Person,
  PresignedUrlResponse: PresignedUrlResponse,
  Rule: Rule,
  RuleFailureException: RuleFailureException,
  RuleImplementation: RuleImplementation,
  RuleInstance: RuleInstance,
  Tag: Tag,
  Transaction: Transaction,
  TransactionAmountDetails: TransactionAmountDetails,
  TransactionCaseManagement: TransactionCaseManagement,
  TransactionCaseManagementAllOf: TransactionCaseManagementAllOf,
  TransactionLimits: TransactionLimits,
  TransactionStatusChange: TransactionStatusChange,
  TransactionUpdateRequest: TransactionUpdateRequest,
  TransactionWithRulesResult: TransactionWithRulesResult,
  TransactionWithRulesResultAllOf: TransactionWithRulesResultAllOf,
  TransactionsListResponse: TransactionsListResponse,
  UPIDetails: UPIDetails,
  User: User,
  UserDetails: UserDetails,
  UserDetails1: UserDetails1,
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
