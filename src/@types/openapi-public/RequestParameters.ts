import { ACHDetails } from './ACHDetails'
import { Address } from './Address'
import { Amount } from './Amount'
import { Business } from './Business'
import { BusinessUsersResponse } from './BusinessUsersResponse'
import { CardDetails } from './CardDetails'
import { CompanyFinancialDetails } from './CompanyFinancialDetails'
import { CompanyGeneralDetails } from './CompanyGeneralDetails'
import { CompanyRegistrationDetails } from './CompanyRegistrationDetails'
import { ConsumerName } from './ConsumerName'
import { ConsumerUsersResponse } from './ConsumerUsersResponse'
import { ContactDetails } from './ContactDetails'
import { DeviceData } from './DeviceData'
import { ExecutedRulesResult } from './ExecutedRulesResult'
import { FailedRulesResult } from './FailedRulesResult'
import { IBANDetails } from './IBANDetails'
import { InlineResponse201 } from './InlineResponse201'
import { InternalUser } from './InternalUser'
import { LegalDocument } from './LegalDocument'
import { LegalEntity } from './LegalEntity'
import { ModelDate } from './ModelDate'
import { Person } from './Person'
import { RiskScoringResult } from './RiskScoringResult'
import { RuleAction } from './RuleAction'
import { RuleFailureException } from './RuleFailureException'
import { SWIFTDetails } from './SWIFTDetails'
import { Tag } from './Tag'
import { Transaction } from './Transaction'
import { TransactionAmountDetails } from './TransactionAmountDetails'
import { TransactionEvent } from './TransactionEvent'
import { TransactionLimits } from './TransactionLimits'
import { TransactionMonitoringResult } from './TransactionMonitoringResult'
import { TransactionWithRulesResult } from './TransactionWithRulesResult'
import { TransactionWithRulesResultAllOf } from './TransactionWithRulesResultAllOf'
import { UPIDetails } from './UPIDetails'
import { User } from './User'
import { UserDetails } from './UserDetails'
import { WalletDetails } from './WalletDetails'

export interface DefaultApiGetBusinessUserUserIdRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetBusinessUserUserId
   */
  userId: string
}

export interface DefaultApiGetConsumerTransactionRequest {
  /**
   * Unique Transaction Identifier
   * @type string
   * @memberof DefaultApigetConsumerTransaction
   */
  transactionId: string
}

export interface DefaultApiGetConsumerUserRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetConsumerUser
   */
  userId: string
}

export interface DefaultApiGetInternalUserRequest {
  /**
   *
   * @type string
   * @memberof DefaultApigetInternalUser
   */
  employeeId: string
}

export interface DefaultApiGetTransactionEventRequest {
  /**
   * Unique Transaction Identifier
   * @type string
   * @memberof DefaultApigetTransactionEvent
   */
  eventId: string
}

export interface DefaultApiPostBusinessUserRequest {
  /**
   *
   * @type Business
   * @memberof DefaultApipostBusinessUser
   */
  Business?: Business
}

export interface DefaultApiPostConsumerTransactionRequest {
  /**
   *
   * @type Transaction
   * @memberof DefaultApipostConsumerTransaction
   */
  Transaction?: Transaction
}

export interface DefaultApiPostConsumerUserRequest {
  /**
   *
   * @type User
   * @memberof DefaultApipostConsumerUser
   */
  User?: User
}

export interface DefaultApiPostInteralUserRequest {
  /**
   *
   * @type InternalUser
   * @memberof DefaultApipostInteralUser
   */
  InternalUser?: InternalUser
}

export interface DefaultApiPostTransactionEventRequest {
  /**
   *
   * @type TransactionEvent
   * @memberof DefaultApipostTransactionEvent
   */
  TransactionEvent?: TransactionEvent
}
