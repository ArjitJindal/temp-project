import { ACHDetails } from './ACHDetails'
import { ACHPaymentMethod } from './ACHPaymentMethod'
import { Address } from './Address'
import { Amount } from './Amount'
import { Business } from './Business'
import { BusinessUsersResponse } from './BusinessUsersResponse'
import { CardDetails } from './CardDetails'
import { CardPaymentMethod } from './CardPaymentMethod'
import { CaseManagementEvent } from './CaseManagementEvent'
import { CompanyFinancialDetails } from './CompanyFinancialDetails'
import { CompanyGeneralDetails } from './CompanyGeneralDetails'
import { CompanyRegistrationDetails } from './CompanyRegistrationDetails'
import { ConsumerName } from './ConsumerName'
import { ConsumerUsersResponse } from './ConsumerUsersResponse'
import { ContactDetails } from './ContactDetails'
import { DeviceData } from './DeviceData'
import { ExecutedRulesResult } from './ExecutedRulesResult'
import { FailedRulesResult } from './FailedRulesResult'
import { GeneralBankAccountPaymentMethod } from './GeneralBankAccountPaymentMethod'
import { GenericBankAccountDetails } from './GenericBankAccountDetails'
import { HitRulesResult } from './HitRulesResult'
import { IBANDetails } from './IBANDetails'
import { IBANPaymentMethod } from './IBANPaymentMethod'
import { InternalUser } from './InternalUser'
import { LegalDocument } from './LegalDocument'
import { LegalEntity } from './LegalEntity'
import { ModelDate } from './ModelDate'
import { Person } from './Person'
import { RiskScoringResult } from './RiskScoringResult'
import { RuleAction } from './RuleAction'
import { RuleFailureException } from './RuleFailureException'
import { RulesResults } from './RulesResults'
import { SWIFTDetails } from './SWIFTDetails'
import { SWIFTPaymentMethod } from './SWIFTPaymentMethod'
import { Tag } from './Tag'
import { Transaction } from './Transaction'
import { TransactionAmountDetails } from './TransactionAmountDetails'
import { TransactionEvent } from './TransactionEvent'
import { TransactionEventMonitoringResult } from './TransactionEventMonitoringResult'
import { TransactionEventMonitoringResultAllOf } from './TransactionEventMonitoringResultAllOf'
import { TransactionLimits } from './TransactionLimits'
import { TransactionMonitoringResult } from './TransactionMonitoringResult'
import { TransactionMonitoringResultAllOf } from './TransactionMonitoringResultAllOf'
import { TransactionState } from './TransactionState'
import { TransactionWithRulesResult } from './TransactionWithRulesResult'
import { TransactionWithRulesResultAllOf } from './TransactionWithRulesResultAllOf'
import { UPIDetails } from './UPIDetails'
import { UPIPaymentMethod } from './UPIPaymentMethod'
import { User } from './User'
import { UserDetails } from './UserDetails'
import { UserEvent } from './UserEvent'
import { UserEventWithRulesResult } from './UserEventWithRulesResult'
import { UserEventWithRulesResultAllOf } from './UserEventWithRulesResultAllOf'
import { UserMonitoringResult } from './UserMonitoringResult'
import { UserMonitoringResultAllOf } from './UserMonitoringResultAllOf'
import { UserStatus } from './UserStatus'
import { WalletDetails } from './WalletDetails'
import { WalletPaymentMethod } from './WalletPaymentMethod'

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

export interface DefaultApiPostTransactionEventRequest {
  /**
   *
   * @type TransactionEvent
   * @memberof DefaultApipostTransactionEvent
   */
  TransactionEvent?: TransactionEvent
}
