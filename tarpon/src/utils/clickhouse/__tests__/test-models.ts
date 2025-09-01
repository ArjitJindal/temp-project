/**
 * Test models for ClickHouse schema parser testing
 * These models simulate the structure of real OpenAPI-generated models
 */

// Simple enum for testing
export enum TestStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

export enum TestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Complex object types for testing
export interface TestAddress {
  street: string
  city: string
  country: string
  zipCode: string
}

export interface TestContactInfo {
  email: string
  phone: string
  address: TestAddress
}

export interface TestMetadata {
  createdBy: string
  tags: string[]
  version: number
}

// Union type for testing
export type TestPaymentMethod =
  | TestCardPayment
  | TestBankPayment
  | TestWalletPayment

export interface TestCardPayment {
  type: 'CARD'
  cardNumber: string
  expiryDate: string
}

export interface TestBankPayment {
  type: 'BANK'
  accountNumber: string
  routingNumber: string
}

export interface TestWalletPayment {
  type: 'WALLET'
  walletId: string
  provider: string
}

/**
 * Simple test model with basic types
 */
export class SimpleTestModel {
  static readonly discriminator: string | undefined = undefined

  static readonly attributeTypeMap: Array<{
    name: string
    baseName: string
    type: string
    format: string
  }> = [
    {
      name: 'id',
      baseName: 'id',
      type: 'string',
      format: '',
    },
    {
      name: 'name',
      baseName: 'name',
      type: 'string',
      format: '',
    },
    {
      name: 'age',
      baseName: 'age',
      type: 'number',
      format: '',
    },
    {
      name: 'isActive',
      baseName: 'isActive',
      type: 'boolean',
      format: '',
    },
    {
      name: 'createdAt',
      baseName: 'createdAt',
      type: 'number',
      format: '',
    },
  ]

  static getAttributeTypeMap() {
    return SimpleTestModel.attributeTypeMap
  }

  public constructor() {}
}

/**
 * Complex test model with enums, objects, arrays, and unions
 */
export class ComplexTestModel {
  static readonly discriminator: string | undefined = undefined

  static readonly attributeTypeMap: Array<{
    name: string
    baseName: string
    type: string
    format: string
  }> = [
    {
      name: 'id',
      baseName: 'id',
      type: 'string',
      format: '',
    },
    {
      name: 'timestamp',
      baseName: 'timestamp',
      type: 'number',
      format: '',
    },
    {
      name: 'title',
      baseName: 'title',
      type: 'string',
      format: '',
    },
    {
      name: 'isEnabled',
      baseName: 'isEnabled',
      type: 'boolean',
      format: '',
    },
    {
      name: 'status',
      baseName: 'status',
      type: 'TestStatus',
      format: '',
    },
    {
      name: 'priority',
      baseName: 'priority',
      type: 'TestPriority',
      format: '',
    },
    // Complex object fields
    {
      name: 'contactInfo',
      baseName: 'contactInfo',
      type: 'TestContactInfo',
      format: '',
    },
    {
      name: 'metadata',
      baseName: 'metadata',
      type: 'TestMetadata',
      format: '',
    },
    {
      name: 'tags',
      baseName: 'tags',
      type: 'Array<string>',
      format: '',
    },
    {
      name: 'scores',
      baseName: 'scores',
      type: 'Array<number>',
      format: '',
    },
    {
      name: 'addresses',
      baseName: 'addresses',
      type: 'Array<TestAddress>',
      format: '',
    },
    {
      name: 'statusHistory',
      baseName: 'statusHistory',
      type: 'Array<TestStatus>',
      format: '',
    },
    {
      name: 'paymentMethod',
      baseName: 'paymentMethod',
      type: 'TestCardPayment | TestBankPayment | TestWalletPayment',
      format: '',
    },
    {
      name: 'alternativePayment',
      baseName: 'alternativePayment',
      type: 'TestCardPayment | TestBankPayment | null',
      format: '',
    },
    {
      name: 'updateCount',
      baseName: 'updateCount',
      type: 'number',
      format: '',
    },
    {
      name: 'lastModified',
      baseName: 'lastModified',
      type: 'number',
      format: '',
    },
  ]

  static getAttributeTypeMap() {
    return ComplexTestModel.attributeTypeMap
  }

  public constructor() {}
}

/**
 * Model with enum arrays for testing LowCardinality arrays
 */
export class EnumArrayTestModel {
  static readonly discriminator: string | undefined = undefined

  static readonly attributeTypeMap: Array<{
    name: string
    baseName: string
    type: string
    format: string
  }> = [
    {
      name: 'id',
      baseName: 'id',
      type: 'string',
      format: '',
    },
    {
      name: 'allowedStatuses',
      baseName: 'allowedStatuses',
      type: 'Array<TestStatus>',
      format: '',
    },
    {
      name: 'priorities',
      baseName: 'priorities',
      type: 'Array<TestPriority>',
      format: '',
    },
  ]

  static getAttributeTypeMap() {
    return EnumArrayTestModel.attributeTypeMap
  }

  public constructor() {}
}

/**
 * Invalid model without attributeTypeMap for error testing
 */
export class InvalidTestModel {
  static readonly discriminator: string | undefined = undefined
  // No attributeTypeMap - this should cause validation to fail

  public constructor() {}
}

/**
 * Export all test models in a way that mimics the real Models import
 */
export const TestModels = {
  SimpleTestModel,
  ComplexTestModel,
  EnumArrayTestModel,
  InvalidTestModel,
}
