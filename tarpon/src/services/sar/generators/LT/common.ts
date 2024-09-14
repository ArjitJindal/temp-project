import Ajv from 'ajv'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import dayjs from '@/utils/dayjs'
import { DAY_DATE_FORMAT_JS } from '@/utils/mongodb-utils'

// Currently unused
export const transactionMethods = [
  ['KODAS', 'PAVADINIMAS'],
  ['DOVS', 'DOVANOJIMO SUTARTIS'],
  ['HPTL', 'HIPOTEKOS LAKŠTAS'],
  ['MAIN', 'MAINŲ SUTARTIS'],
  ['P/PS', 'PIRKIMAS-PARDAVIMAS'],
  ['PAR', 'PARAMOS SUTARTIS'],
  ['PASK', 'PASKOLOS SUTARTIS'],
  ['PAVS', 'PAVELDĖJIMO SUTARTIS'],
  ['PRDS', 'PERDAVIMO SUTARTIS'],
  ['PRLMS', 'PRELIMINARIOJI SUTARTIS'],
  ['PRLS', 'PERLEIDIMO SUTARTIS'],
  ['RNS', 'RENTOS SUTARTIS'],
  ['SERVS', 'SERVITUTO SUTARTIS'],
  ['SKPS', 'SKOLOS PADENGIMO SUTARTIS'],
  ['SS', 'SUSITARIMAS'],
  ['SUS', 'SUJUNGIMO SUTARTIS'],
  ['TĮKS', 'TURTO ĮKEITIMO SUTARTIS'],
  ['TPS', 'TURTO PASIDALIJIMO SUTARTIS'],
]
export const transactionTypes = [
  ['CONVER.CC3', 'Currency conversion to virtual currency'],
  ['CONVER.CC4', 'Transaction in virtual currency'],
  ['CONVER.CC5', 'Conversion of virtual currency to  currency'],
  ['CONVERSION', 'Converting cash to another currency'],
  ['CONVIRT', 'Converting cash to virt. currency'],
  ['CUSTDECL', 'Customs cash declarations'],
  ['DEPOS.CC1', 'Depositing virtual currency into a virtual wallet'],
  ['DEPOSITING', 'Cash deposit'],
  ['WITHD.CC1', 'Withdrawal of virtual currency from a virtual wallet'],
  ['WITHDRAWAL', 'Cash withdrawals'],
]

export function subject(
  user: InternalConsumerUser | InternalBusinessUser | undefined
) {
  if (!user) {
    return
  }
  if (user.type === 'CONSUMER') {
    const ld =
      user.legalDocuments && user.legalDocuments.length > 0
        ? user.legalDocuments[0]
        : undefined
    let legalDocumentData = {}
    if (legalDocument) {
      legalDocumentData = legalDocument(ld)
    }
    const address =
      user.contactDetails &&
      user.contactDetails?.addresses &&
      user.contactDetails?.addresses?.length > 0
        ? user.contactDetails?.addresses[0]
        : undefined
    const contactNumber =
      user.contactDetails &&
      user.contactDetails?.contactNumbers &&
      user.contactDetails?.contactNumbers?.length > 0
        ? user.contactDetails?.contactNumbers[0]
        : undefined
    return {
      Country: user.userDetails?.countryOfResidence,
      Citizenship: user.userDetails?.countryOfNationality,
      BirthDate: user.userDetails?.dateOfBirth,
      FirstName: user.userDetails?.name?.firstName,
      LastName: user.userDetails?.name?.lastName,
      ...legalDocumentData,
      Address: address?.addressLines.join(', '),
      PhoneNumber: contactNumber,
    }
  }
  if (user.type === 'BUSINESS') {
    const address =
      user.legalEntity.contactDetails &&
      user.legalEntity.contactDetails?.addresses &&
      user.legalEntity.contactDetails?.addresses?.length > 0
        ? user.legalEntity.contactDetails?.addresses[0]
        : undefined
    const contactNumber =
      user.legalEntity.contactDetails &&
      user.legalEntity.contactDetails?.contactNumbers &&
      user.legalEntity.contactDetails?.contactNumbers?.length > 0
        ? user.legalEntity.contactDetails?.contactNumbers[0]
        : undefined
    const ld =
      user.directors &&
      user.directors.length > 0 &&
      user.directors[0].legalDocuments &&
      user.directors[0].legalDocuments.length > 0
        ? user.directors[0].legalDocuments[0]
        : undefined
    let legalDocumentData = {}
    if (legalDocument) {
      legalDocumentData = legalDocument(ld)
    }
    return {
      Country: user.legalEntity.companyRegistrationDetails?.registrationCountry,
      Citizenship:
        user.legalEntity.companyRegistrationDetails?.registrationCountry,
      BirthDate:
        user.legalEntity.companyRegistrationDetails?.dateOfRegistration,
      Address: address?.addressLines.join(', '),
      PhoneNumber: contactNumber,
      ...legalDocumentData,
    }
  }
  return undefined
}

function legalDocument(ld: LegalDocument | undefined) {
  if (!ld) {
    return {}
  }
  return {
    DocumentType: ld.documentType,
    DocumentNumber: ld.documentNumber,
    DocumentIssueDate: ld.documentIssuedDate
      ? new Date(ld.documentIssuedDate).toISOString()
      : undefined,
  }
}

export function account(pm: PaymentDetails | undefined) {
  if (!pm) {
    return
  }
  if (pm.method === 'IBAN') {
    return {
      Bank: pm.bankName,
      IBAN: pm.IBAN,
      AccountOwner: pm.name,
      SubjectCode: pm.bankBranchCode,
    }
  }
  return undefined
}

const ajv = new Ajv({
  formats: {
    date: (str) => {
      return dayjs(str, DAY_DATE_FORMAT_JS).isValid()
    },
  },
})

ajv.addKeyword('ui:schema')
ajv.addKeyword('enumNames')

export const ajvLithuaniaValidator = ajv
