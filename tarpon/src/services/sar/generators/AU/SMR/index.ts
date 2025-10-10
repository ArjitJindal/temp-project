import path from 'path'
import fs from 'fs'
import cloneDeep from 'lodash/cloneDeep'
import uniq from 'lodash/uniq'
import { XMLBuilder } from 'fast-xml-parser'
import { v4 as uuidv4 } from 'uuid'
import { BadRequest } from 'http-errors'
import { GenerateResult, InternalReportType, ReportGenerator } from '../..'
import {
  AdditionalDetails,
  GroundsForSuspicion,
  DetailsOfSuspiciousMatter,
  ReportingEntity,
  DetailsOfPerson,
  DetailsOfOtherParty,
  DetailsOfUnidentifiedPerson,
  TransactionsRelatedToMatter,
} from './schema'
import { AustracJsonSchemaResolved } from './resources/SMRSchema_Resolved'
import { traceable } from '@/core/xray'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Report } from '@/@types/openapi-internal/Report'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'

@traceable
export class AuSmrReportGenerator implements ReportGenerator {
  public static getInstance(tenantId: string): AuSmrReportGenerator {
    const generator = new AuSmrReportGenerator()
    generator.setTenantId(tenantId)
    return generator
  }

  public setTenantId(tenantId: string): void {
    this.tenantId = tenantId
  }
  tenantId!: string
  getType(): InternalReportType {
    return {
      countryCode: 'AU',
      type: 'SMR',
      directSubmission: false,
      subjectTypes: ['CASE', 'USER'],
    }
  }
  async getPopulatedParameters(
    _c: Case,
    _transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    const params: ReportParameters = {
      report: {},
    }
    return params
  }
  getUserPopulatedParameters(
    _user: InternalConsumerUser | InternalBusinessUser,
    _transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    throw new Error('Method not implemented.')
  }
  getSchema(): ReportSchema {
    return {
      reportSchema: {
        type: 'object',
        properties: {
          detailsOfSuspiciousMatter: DetailsOfSuspiciousMatter,
          groundsForSuspicion: GroundsForSuspicion,
          additionalDetails: AdditionalDetails,
          reportingEntity: ReportingEntity,
        },
        required: [
          'detailsOfSuspiciousMatter',
          'groundsForSuspicion',
          'additionalDetails',
          'reportingEntity',
        ],
        definitions: AustracJsonSchemaResolved.definitions,
      },
      customerAndAccountDetailsSchema: {
        type: 'object',
        properties: {
          detailsOfPerson: DetailsOfPerson,
          detailsOfOtherParty: DetailsOfOtherParty,
          detailsOfUnidentifiedPerson: DetailsOfUnidentifiedPerson,
        },
        definitions: AustracJsonSchemaResolved.definitions,
      },
      currencyTransactionSchema: {
        type: 'object',
        properties: {
          transactionsRelatedToMatter: TransactionsRelatedToMatter,
        },
        definitions: AustracJsonSchemaResolved.definitions,
      },
    }
  }

  private isValidAmount(amount: string): boolean {
    const pattern1 = /^[0-9]{1,3}(,[0-9]{3}){0,4}(\.[0-9]{0,2})?$/
    const pattern2 = /^[0-9]{1,15}([.,][0-9]{0,2})?$/
    return pattern1.test(amount) || pattern2.test(amount)
  }
  private isValidSignedAmount(amount: string): boolean {
    const pattern1 = /^-?[0-9]{1,3}(,[0-9]{3}){0,4}(\.[0-9]{0,2})?$/
    const pattern2 = /^-?[0-9]{1,15}([.,][0-9]{0,2})?$/
    return pattern1.test(amount) || pattern2.test(amount)
  }
  private isValidLength(value: string, maxLength: number): boolean {
    return value.length <= maxLength
  }
  private isValidEmail(email: string): boolean {
    const pattern = /^[^@]+@[^@]+$/
    return pattern.test(email) && this.isValidLength(email, 250)
  }
  private isValidDecimalNumber(decimalNumber: string): boolean {
    const pattern =
      /^([0-9]{1,15}([.,][0-9]{0,10})?|[0-9]{1,3}(,[0-9]{3}){0,4}(\.[0-9]{0,10})?)$/
    return pattern.test(decimalNumber)
  }
  private isValidInccCode(inccCode: string): boolean {
    const pattern = /^[0-9]{4}(-?[0-9]{2})?$/
    return pattern.test(inccCode)
  }
  private isValidDate(date: string): boolean {
    const pattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

    if (!pattern.test(date)) {
      return false
    }

    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) {
      return false
    }

    const minDate = new Date('1800-01-01')
    const maxDate = new Date('2099-12-31')

    return parsed >= minDate && parsed <= maxDate
  }
  private isValidDigitalCurrencyWallet(currency: string): boolean {
    const pattern = /^[0-9a-zA-Z]{0,1024}$/
    return pattern.test(currency)
  }
  private isValidABN(abn: string): boolean {
    const pattern = /^[0-9]{11}$/
    return pattern.test(abn)
  }
  private isValidACN(acn: string): boolean {
    const pattern = /^[0-9]{9}$/
    return pattern.test(acn)
  }
  private isValidDigitalCurrency(currency: string): boolean {
    const pattern = /^[a-zA-Z0-9]+[\\@\\$a-zA-Z0-9]*$/
    return pattern.test(currency) || this.isValidLength(currency, 20)
  }
  private isValidBlockchainTransactionId(
    blockchainTransactionId: string
  ): boolean {
    const pattern = /^[0-9a-zA-Z]*$/
    return (
      pattern.test(blockchainTransactionId) ||
      this.isValidLength(blockchainTransactionId, 4000)
    )
  }
  private isValidReportName(reportName: string): boolean {
    const pattern =
      /^SMR(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(0[1-9]|[1-9]\d)$/
    return pattern.test(reportName)
  }
  private isValidBsb(bsb: string): boolean {
    const pattern = /^[0-9]{6}$/
    return pattern.test(bsb)
  }

  private transformAllOptionalAddress(
    part: string,
    prefix: string,
    address: any
  ): {
    address: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //addr
    const addr = address?.['Street address'] ?? undefined
    if (addr && !this.isValidLength(addr, 140)) {
      errors.push({
        part,
        field: `${prefix} - address`,
        message: 'Address must be less than 140 characters',
      })
    }
    //suburb
    const suburb = address?.['Suburb/town/city'] ?? undefined
    if (suburb && !this.isValidLength(suburb, 35)) {
      errors.push({
        part,
        field: `${prefix} - suburb`,
        message: 'Suburb must be less than 35 characters',
      })
    }
    //state
    const state = address?.['State or province'] ?? undefined
    if (state && !this.isValidLength(state, 35)) {
      errors.push({
        part,
        field: `${prefix} - state`,
        message: 'State must be less than 35 characters',
      })
    }
    //postcode
    const postcode = address?.['Postcode'] ?? undefined
    if (postcode && !this.isValidLength(postcode, 15)) {
      errors.push({
        part,
        field: `${prefix} - postcode`,
        message: 'Postcode must be less than 15 characters',
      })
    }
    //country
    const country = address?.['Country name'] ?? undefined
    if (country && !this.isValidLength(country, 35)) {
      errors.push({
        part,
        field: `${prefix} - country`,
        message: 'Country must be less than 35 characters',
      })
    }
    return {
      address: { '@id': uuidv4(), addr, suburb, state, postcode, country },
      errors,
    }
  }

  private transfromAccount(
    part: string,
    prefix: string,
    account: any
  ): {
    account: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //title
    const title = account?.['Account title'] ?? undefined
    if (title && !this.isValidLength(title, 140)) {
      errors.push({
        part,
        field: `${prefix} - account title`,
        message: 'Account title must be less than 140 characters',
      })
    }
    //bsb
    const bsb = account?.['Bank state branch number'] ?? undefined
    if (bsb && !this.isValidBsb(bsb)) {
      errors.push({
        part,
        field: `${prefix} - bsb`,
        message: 'BSB must be in format [0-9]{6}',
      })
    }
    //number
    const number = account?.['Account number'] ?? undefined
    if (number && !this.isValidLength(number, 34)) {
      errors.push({
        part,
        field: `${prefix} - account number`,
        message: 'Account number must be less than 34 characters',
      })
    }
    //type
    const type = account?.['Account type']
    if (!type) {
      errors.push({
        part,
        field: `${prefix} - type`,
        message: 'Account type is required',
      })
    }
    //otherDesc
    const otherDesc = account?.['Other account type description']
    if (type === 'OTHERS' && !otherDesc) {
      errors.push({
        part,
        field: `${prefix} - other description`,
        message: 'Other description is required when account type is OTHER',
      })
    }
    if (type === 'OTHERS' && otherDesc && !this.isValidLength(otherDesc, 20)) {
      errors.push({
        part,
        field: `${prefix} - other description`,
        message: 'Other description must be less than 20 characters',
      })
    }
    //acctSigName
    const acctSigName = account?.['Signatories']?.map((sig, idx) => {
      const acctSigName = sig.Name
      if (!this.isValidLength(acctSigName, 140)) {
        errors.push({
          part,
          field: `${prefix} - signatories #${idx + 1}`,
          message: 'Account signature name must be less than 140 characters',
        })
      }
    })
    //acctOpenDate
    const acctOpenDate = account?.['Account open date'] ?? undefined
    if (acctOpenDate && !this.isValidDate(acctOpenDate)) {
      errors.push({
        part,
        field: `${prefix} - account open date`,
        message: 'Account open date must be a valid date',
      })
    }
    //acctBal
    const acctBal = account?.['Account balance'] ?? undefined
    if (acctBal && !this.isValidSignedAmount(acctBal)) {
      errors.push({
        part,
        field: `${prefix} - account balance`,
        message: 'Account balance must be a valid amount',
      })
    }
    //documentation
    const documentation = account?.['Documentation'] ?? undefined
    if (documentation && !this.isValidLength(documentation, 4000)) {
      errors.push({
        part,
        field: `${prefix} - documentation`,
        message: 'Documentation must be less than 4000 characters',
      })
    }
    return {
      account: {
        title,
        bsb,
        number,
        type: type === 'OTHERS' ? undefined : type,
        otherDesc,
        acctSigName,
        acctOpenDate,
        acctBal,
        documentation,
      },
      errors,
    }
  }

  private transformIndOcc(
    part: string,
    prefix: string,
    indOcc: any
  ): {
    indOcc: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //type
    const type = indOcc?.['Industry/occupation type'] ?? undefined
    if (!type) {
      errors.push({
        part,
        field: `${prefix} - type`,
        message: 'Industry/Occupation type is required',
      })
    }
    //code
    let code = indOcc?.['Industry/occupation code'] ?? undefined
    if (type !== 'OTHERS') {
      if (!code) {
        errors.push({
          part,
          field: `${prefix} - code`,
          message:
            'Industry/Occupation code is required when type is not OTHER',
        })
      }
      if (code && !this.isValidInccCode(code)) {
        errors.push({
          part,
          field: `${prefix} - code`,
          message:
            'Industry/Occupation code must be a valid incc code, format: [0-9]{4}(-?[0-9]{2})',
        })
      }
    } else {
      code = undefined
    }
    //description
    const description = indOcc?.['Industry/occupation description'] ?? undefined
    if (type === 'OTHERS' && !description) {
      errors.push({
        part,
        field: `${prefix} - description`,
        message:
          'Industry/Occupation description is required when type is OTHER',
      })
    }
    if (
      type === 'OTHERS' &&
      description &&
      !this.isValidLength(description, 150)
    ) {
      errors.push({
        part,
        field: `${prefix} - description`,
        message:
          'Industry/Occupation description must be less than 15 characters',
      })
    }
    return {
      indOcc: {
        '@id': uuidv4(),
        type: type === 'OTHERS' ? undefined : type,
        code,
        description,
      },
      errors,
    }
  }

  private transformBusinessDetails(
    part: string,
    prefix: string,
    businessDetails: any
  ): {
    businessDetails: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //businessStruct
    const businessStruct = businessDetails?.['Business structure'] ?? undefined
    //benName
    let benNames = businessDetails?.['Beneficial owners']
      ? businessDetails?.['Beneficial owners'].map((name) => name.Name)
      : undefined
    benNames?.forEach((name, idx) => {
      if (!this.isValidLength(name, 140)) {
        errors.push({
          part,
          field: `${prefix} - benifical owner name #${idx + 1}`,
          message: 'Benifical owner name must be less than 140 characters',
        })
      }
    })
    benNames = uniq(benNames)
    //holderName
    let holderNames = businessDetails?.['Office holders']
      ? businessDetails?.['Office holders'].map((name) => name.Name)
      : undefined
    holderNames?.forEach((name, idx) => {
      if (!this.isValidLength(name, 140)) {
        errors.push({
          part,
          field: `${prefix} - holder name #${idx + 1}`,
          message: 'Holder name must be less than 140 characters',
        })
      }
    })
    holderNames = uniq(holderNames)
    //incorpCountry
    const incorpCountry = businessDetails?.['Country name'] ?? undefined
    //documentation
    const documentation = businessDetails?.['Documentations']
      ? businessDetails?.['Documentations'].map((doc, idx) => {
          const documentation = doc.documentation
          if (documentation && !this.isValidLength(documentation, 4000)) {
            errors.push({
              part,
              field: `${prefix} - documentation #${idx + 1}`,
              message: 'Documentation must be less than 4000 characters',
            })
            return undefined
          }
          return documentation
        })
      : undefined

    return {
      businessDetails: {
        businessStruct,
        benName: benNames,
        holderName: holderNames,
        incorpCountry,
        documentation,
      },
      errors,
    }
  }

  private transformIndividualDetails(
    part: string,
    prefix: string,
    individualDetails: any
  ): {
    individualDetails: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //dob
    const dob = individualDetails?.['Date of birth'] ?? undefined
    if (dob && !this.isValidDate(dob)) {
      errors.push({
        part,
        field: `${prefix} - date of birth`,
        message: 'Date of birth must be a valid date, format: YYYY-MM-DD',
      })
    }
    //citizenCountry
    const citizenCountries = individualDetails?.['Citizenship countries']
      ? individualDetails?.['Citizenship countries'].map(
          (country) => country?.['Country name']
        )
      : undefined
    return {
      individualDetails: { dob, citizenCountry: citizenCountries },
      errors,
    }
  }

  private transformIdentification(
    part: string,
    prefix: string,
    identification: any
  ): {
    identification: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //type
    const type = identification?.['Identification type'] ?? undefined
    if (!type) {
      errors.push({
        part,
        field: `${prefix} - type`,
        message: 'Id type is required',
      })
    }
    //typeOther
    let typeOther = identification?.['Other description'] ?? undefined
    if (type === 'OTHERS' && !typeOther) {
      errors.push({
        part,
        field: `${prefix} - type other`,
        message: 'Id type other is required when type is OTHERS',
      })
    }
    if (type === 'OTHERS' && typeOther && !this.isValidLength(typeOther, 30)) {
      errors.push({
        part,
        field: `${prefix} - type other`,
        message: 'Id type other must be less than 30 characters',
      })
    }
    if (type !== 'OTHERS' && typeOther) {
      typeOther = undefined
    }
    //number
    const number = identification?.['Identification number'] ?? undefined
    if (number && !this.isValidLength(number, 20)) {
      errors.push({
        part,
        field: `${prefix} - number`,
        message: 'Id number must be less than 20 characters',
      })
    }
    //issuer
    const issuer = identification?.['Identification issuer'] ?? undefined
    if (issuer && !this.isValidLength(issuer, 100)) {
      errors.push({
        part,
        field: `${prefix} - issuer`,
        message: 'Id Issuer must be less than 100 characters',
      })
    }
    //country
    const country = identification?.['Country name'] ?? undefined
    //idIssueDate
    const idIssueDate = identification?.['Id issue date'] ?? undefined
    if (idIssueDate && !this.isValidDate(idIssueDate)) {
      errors.push({
        part,
        field: `${prefix} - issue date`,
        message: 'Id issue issue date must be a valid date',
      })
    }
    //idExpiryDate
    const idExpiryDate = identification?.['Id expiry date'] ?? undefined
    if (idExpiryDate && !this.isValidDate(idExpiryDate)) {
      errors.push({
        part,
        field: `${prefix} - expiry date`,
        message: 'Id expiry date must be a valid date',
      })
    }
    return {
      identification: {
        '@id': uuidv4(),
        type,
        typeOther,
        number,
        issuer,
        country,
        idIssueDate,
        idExpiryDate,
      },
      errors,
    }
  }

  private transformDeviceIdentifier(
    part: string,
    prefix: string,
    deviceIdentifier: any
  ): {
    deviceIdentifier: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //type
    const type = deviceIdentifier?.['Device type'] ?? undefined
    if (!type) {
      errors.push({
        part,
        field: `${prefix} - device type`,
        message: 'Device identifier type is required',
      })
    }
    //typeOther
    let typeOther = deviceIdentifier?.['Other description'] ?? undefined
    if (type === 'OTHERS' && !typeOther) {
      errors.push({
        part,
        field: `${prefix} - other description`,
        message: 'Device identifier type other is required when type is OTHERS',
      })
    } else {
      typeOther = undefined
    }
    //identifier
    const identifier = deviceIdentifier?.['Identification number'] ?? undefined
    if (identifier && !this.isValidLength(identifier, 20)) {
      errors.push({
        part,
        field: `${prefix} - identification number`,
        message: 'Device identifier must be less than 20 characters',
      })
    }
    return {
      deviceIdentifier: {
        '@id': uuidv4(),
        type,
        typeOther,
        identifier,
      },
      errors,
    }
  }

  private transformSuspiciousPerson(
    part: string,
    prefix: string,
    personData: any
  ): {
    person: object & { '@id': string }
    errors: { part: string; field: string; message: string }[]
  } {
    personData = personData.person
    const errors: { part: string; field: string; message: string }[] = []
    //fullName
    const fullName = personData?.fullName ?? undefined
    //altName
    const altNames = personData?.['Alternative name'] ?? []
    // mainAddress
    const mainAddress = this.transformAllOptionalAddress(
      part,
      prefix + ' - main address',
      personData?.['Main address']
    )
    if (mainAddress.errors.length > 0) {
      errors.push(...mainAddress.errors)
    }
    //postalAddress
    const postalAddress = this.transformAllOptionalAddress(
      part,
      prefix + ' - postal address',
      personData?.['Other address']
    )
    if (postalAddress.errors.length > 0) {
      errors.push(...postalAddress.errors)
    }
    //phone
    const phones = personData?.['Phone numbers']
      ? personData?.['Phone numbers'].map((phone) => phone.phone)
      : []
    phones.forEach((phone, index) => {
      if (!this.isValidLength(phone, 20)) {
        errors.push({
          part,
          field: `${prefix} - phone ${index + 1}`,
          message: 'Phone must be less than 20 characters',
        })
      }
    })
    //email
    const emails = personData?.['Email addresses']
      ? personData?.['Email addresses'].map((email) => email.email)
      : []
    emails.forEach((email, idx) => {
      if (!this.isValidEmail(email)) {
        errors.push({
          part,
          field: `${prefix} - email ${idx + 1}`,
          message:
            'Email must be a valid email address, less than 250 characters and follow this pattern: [^@]+@[^@]+',
        })
      }
    })
    //account
    const accounts = personData?.['Accounts'] ?? []
    accounts.forEach((account, idx) => {
      const accountResult = this.transfromAccount(
        part,
        prefix + ' - account #' + (idx + 1),
        account
      )
      if (accountResult.errors.length > 0) {
        errors.push(...accountResult.errors)
      }
      account = accountResult.account
    })
    //digitalCurrencyWallet
    const digitalCurrencyWallets = personData?.[
      'Digital currency wallet addresses'
    ]
      ? personData?.['Digital currency wallet addresses'].map(
          (wallet) => wallet.digitalCurrencyWallet
        )
      : []
    digitalCurrencyWallets.forEach((wallet, idx) => {
      if (!this.isValidDigitalCurrencyWallet(wallet)) {
        errors.push({
          part,
          field: `${prefix} - digital currency wallet #${idx + 1}`,
          message:
            'Digital currency must be a valid digital currency, following pattern [0-9a-zA-Z]{0,1024}',
        })
      }
    })
    //indOcc
    const indOcc = personData?.indOcc
      ? this.transformIndOcc(
          part,
          prefix + 'Industry or occupation',
          personData.indOcc
        )
      : undefined
    if (indOcc && indOcc.errors.length > 0) {
      errors.push(...indOcc.errors)
    }
    //abn
    const abn = personData?.abn ?? undefined
    if (abn && !this.isValidABN(abn)) {
      errors.push({
        part,
        field: `${prefix} - abn`,
        message: 'ABN must be a valid ABN',
      })
    }
    //acn
    const acn = personData?.acn ?? undefined
    if (acn && !this.isValidACN(acn)) {
      errors.push({
        part,
        field: `${prefix} - acn`,
        message: 'ACN must be a valid ACN',
      })
    }
    //arbn
    const arbn = personData?.arbn ?? undefined
    if (arbn && !this.isValidACN(arbn)) {
      errors.push({
        part,
        field: `${prefix} - arbn`,
        message: 'ARBN must be a valid ARBN',
      })
    }
    //businessDetails
    const businessDetails = personData?.['Business details']
      ? this.transformBusinessDetails(
          part,
          prefix + ' - business details',
          personData['Business details']
        )
      : undefined
    if (businessDetails && businessDetails.errors.length > 0) {
      errors.push(...businessDetails.errors)
    }
    //individualDetails
    const individualDetails = personData?.['Individual details']
      ? this.transformIndividualDetails(
          part,
          prefix + ' - individual details',
          personData?.['Individual details']
        )
      : undefined
    if (individualDetails && individualDetails.errors.length > 0) {
      errors.push(...individualDetails.errors)
    }
    //identification
    const identification = personData?.['Identification document']
      ? personData?.['Identification document'].map((id, idx) => {
          const idResult = this.transformIdentification(
            part,
            prefix + ' - identification #' + (idx + 1),
            id
          )
          if (idResult.errors.length > 0) {
            errors.push(...idResult.errors)
          }
          return idResult.identification
        })
      : undefined
    //electDataSrc
    const electDataSrc = personData?.['Electronic data source']
      ? personData?.['Electronic data source'].map((src, idx) => {
          if (!this.isValidLength(src, 70)) {
            errors.push({
              part,
              field: `${prefix} - electronic data source $${idx + 1}`,
              message:
                'Electronic data source must be less than 100 characters',
            })
          }
          return src
        })
      : undefined
    //deviceIdentifier
    const deviceIdentifier = personData?.['Device identifier']
      ? personData?.['Device identifier'].map((device, idx) => {
          const deviceResult = this.transformDeviceIdentifier(
            part,
            prefix + ' - device identifier ' + (idx + 1),
            device
          )
          if (deviceResult.errors.length > 0) {
            errors.push(...deviceResult.errors)
          }
          return deviceResult.deviceIdentifier
        })
      : undefined
    //personIsCustomer
    const personIsCustomer =
      personData?.['Person is customer'] === 'Y' ? 'Y' : 'N'

    const person = {
      '@id': uuidv4(),
      fullName: fullName,
      altName: altNames,
      mainAddress: mainAddress.address,
      postalAddress: postalAddress.address,
      phone: phones,
      email: emails,
      account: accounts,
      digitalCurrencyWallet: digitalCurrencyWallets,
      indOcc: indOcc?.indOcc,
      abn,
      acn,
      arbn,
      businessDetails: businessDetails?.businessDetails,
      individualDetails: individualDetails?.individualDetails,
      identification,
      electDataSrc,
      deviceIdentifier,
      personIsCustomer,
    }

    return {
      person,
      errors,
    }
  }

  private transformOtherPerson(
    part: string,
    prefix: string,
    otherPerson: any
  ): {
    otherPerson: any
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    otherPerson = otherPerson.otherParty
    const validatedPerson = this.transformSuspiciousPerson(part, prefix, {
      person: otherPerson,
    })
    if (validatedPerson.errors.length > 0) {
      errors.push(...validatedPerson.errors)
    }
    //personIsCustomer
    const personIsCustomer =
      otherPerson?.['Person is customer'] === 'Y' ? 'Y' : 'N'
    //partyIsCustomer
    const partyIsCustomer =
      otherPerson?.['Party is customer'] === 'Y' ? 'Y' : 'N'
    //partyIsAgent
    const partyIsAgent = otherPerson?.['Party is agent'] === 'Y' ? 'Y' : 'N'
    //relationship
    const relationship =
      otherPerson?.['Relationship to suspicious person'] ?? undefined
    if (relationship && !this.isValidLength(relationship, 4000)) {
      errors.push({
        part,
        field: `${prefix} - relationship`,
        message: 'Relationship must be less than 100 characters',
      })
    }
    //evidence
    const evidence = otherPerson?.['Evidence of relationship'] ?? undefined
    if (evidence && !this.isValidLength(evidence, 4000)) {
      errors.push({
        part,
        field: `${prefix} - evidence`,
        message: 'Evidence must be less than 4000 characters',
      })
    }
    return {
      otherPerson: {
        ...validatedPerson.person,
        personIsCustomer,
        partyIsCustomer,
        partyIsAgent,
        relationship,
        evidence,
      },
      errors,
    }
  }

  private transformUnidentPerson(
    part: string,
    prefix: string,
    unidentPerson: any
  ): {
    unidentPerson: object
    errors: { part: string; field: string; message: string }[]
  } {
    unidentPerson = unidentPerson.unidentifiedPerson
    const errors: { part: string; field: string; message: string }[] = []
    //descOfPerson
    const descOfPerson =
      unidentPerson?.['Description of unidentified person'] ?? undefined
    if (!descOfPerson) {
      errors.push({
        part,
        field: `${prefix} - description of person`,
        message: 'Description of person is required',
      })
    }
    if (descOfPerson && !this.isValidLength(descOfPerson, 4000)) {
      errors.push({
        part,
        field: `${prefix} - description of person`,
        message: 'Description of person must be less than 4000 characters',
      })
    }
    //descOfDocs
    const descOfDocs = unidentPerson?.['Documentations']
      ? unidentPerson?.['Documentations'].map((doc) => doc.documentation)
      : []
    descOfDocs?.forEach((doc) => {
      if (!this.isValidLength(doc, 4000)) {
        errors.push({
          part,
          field: `${prefix} - description of documents`,
          message: 'Description of documents must be less than 4000 characters',
        })
      }
    })
    //descOfDocsOther
    return {
      unidentPerson: {
        '@id': uuidv4(),
        descOfPerson,
        descOfDocs,
      },
      errors,
    }
  }

  private transformTfrType(
    part: string,
    prefix: string,
    tfrType: any
  ): {
    tfrType: object
    errors: { part: string; field: string; message: string }[]
  } {
    tfrType = tfrType.tfrType
    const errors: { part: string; field: string; message: string }[] = []
    //money
    let money = tfrType?.['Money'] ? '' : undefined
    //property
    const property = tfrType?.['Property'] ?? undefined
    if (property && !this.isValidLength(property, 20)) {
      errors.push({
        part,
        field: `${prefix} - property`,
        message: 'Property description must be less than 20 characters',
      })
    }
    if (property) {
      money = undefined
    }
    return {
      tfrType: {
        '@id': uuidv4(),
        money,
        property: property ? property : '',
      },
      errors,
    }
  }

  private transformForeignCurrency(
    part: string,
    prefix: string,
    foreignCurrency: any
  ): {
    foreignCurrency: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //currency
    const currency = foreignCurrency?.['Currency code'] ?? undefined
    if (!currency || currency.length !== 3) {
      errors.push({
        part,
        field: `${prefix} - currency code`,
        message: 'Currency must be a valid currency code, 3 characters long',
      })
    }
    //amount
    const amount = foreignCurrency?.['Amount'] ?? undefined
    if (!amount || !this.isValidAmount(amount)) {
      errors.push({
        part,
        field: `${prefix} - amount`,
        message:
          'Amount must in this format [0-9]{1,3}(,[0-9]{3}){0,4}(\\.[0-9]{0,2})?',
      })
    }
    return {
      foreignCurrency: { '@id': uuidv4(), currency, amount },
      errors,
    }
  }

  private transformDigitalCurrency(
    part: string,
    prefix: string,
    digitalCurrency: any
  ): {
    digitalCurrency: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //code
    const code = digitalCurrency?.['Code'] ?? undefined
    if (!code || !this.isValidDigitalCurrency(code)) {
      errors.push({
        part,
        field: `${prefix} - code`,
        message:
          'Code must be a valid digital currency, following pattern [a-zA-Z0-9]+[\\@\\$a-zA-Z0-9]*',
      })
    }
    //description
    const description = digitalCurrency?.['Description'] ?? undefined
    if (!description || !this.isValidLength(description, 40)) {
      errors.push({
        part,
        field: `${prefix} - description`,
        message: 'Description must be less than 40 characters',
      })
    }
    //numberOfUnits
    const numberOfUnits = digitalCurrency?.['Number of units'] ?? undefined
    if (!numberOfUnits || !this.isValidDecimalNumber(numberOfUnits)) {
      errors.push({
        part,
        field: `${prefix} - number of units`,
        message:
          'Number of units must in this format [0-9]{1,15}([.,][0-9]{0,10})? | [0-9]{1,3}(,[0-9]{3}){0,4}(.[0-9]{0,10})?',
      })
    }
    //backingAsset
    const backingAsset = digitalCurrency?.['Backing asset'] ?? undefined
    if (backingAsset && !this.isValidLength(backingAsset, 35)) {
      errors.push({
        part,
        field: `${prefix} - backing asset`,
        message: 'Backing asset must be less than 35 characters',
      })
    }
    //fiatCurrencyAmount
    const fiatCurrencyAmount = digitalCurrency?.['Currency and amount']
      ? this.transformForeignCurrency(
          part,
          prefix + ` - fiat currency amount`,
          digitalCurrency?.['Currency and amount']
        )
      : undefined
    if (fiatCurrencyAmount && fiatCurrencyAmount.errors.length > 0) {
      errors.push(...fiatCurrencyAmount.errors)
    }
    //blockchainTransactionId
    const blockchainTransactionId =
      digitalCurrency?.['Blockchain transaction id'] ?? undefined
    if (
      blockchainTransactionId &&
      !this.isValidBlockchainTransactionId(blockchainTransactionId)
    ) {
      errors.push({
        part,
        field: `${prefix} - blockchain transaction ID`,
        message: 'Blockchain transaction ID must be less than 4000 characters',
      })
    }
    return {
      digitalCurrency: {
        '@id': uuidv4(),
        code,
        description,
        numberOfUnits,
        backingAsset,
        fiatCurrencyAmount,
        blockchainTransactionId,
      },
      errors,
    }
  }

  private transformInstitutionWithBranch(
    part: string,
    prefix: string,
    institutionWithBranch: any
  ): {
    institutionWithBranch: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //name
    const name = institutionWithBranch?.['Institution name'] ?? undefined
    if (!name || !this.isValidLength(name, 35)) {
      errors.push({
        part,
        field: `${prefix} - name`,
        message: 'Name must be less than 35 characters',
      })
    }
    //branch
    const branch = institutionWithBranch?.['Branch name'] ?? undefined
    if (!branch || !this.isValidLength(branch, 120)) {
      errors.push({
        part,
        field: `${prefix} - branch`,
        message: 'Branch must be less than 120 characters',
      })
    }
    //country
    const country = institutionWithBranch?.['Institution country'] ?? []
    return {
      institutionWithBranch: {
        '@id': uuidv4(),
        name,
        branch,
        country,
      },
      errors,
    }
  }

  private transformTxnPerson(
    part: string,
    prefix: string,
    txnPerson: any,
    institutionKey: string,
    personMap: Map<string, string>,
    otherPersonMap: Map<string, string>
  ): {
    txnPerson: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    //sendingInstitution
    const institutions = txnPerson?.[institutionKey]
      ? txnPerson.sendingInstitution.map((institution, idx) => {
          const institutionResult = this.transformInstitutionWithBranch(
            part,
            prefix + ` - ${institutionKey} ${idx + 1}`,
            institution
          )
          if (institutionResult.errors.length > 0) {
            errors.push(...institutionResult.errors)
          }
          return institutionResult.institutionWithBranch
        })
      : undefined
    //sameAsSuspPerson
    let sameAsSuspPerson = txnPerson?.sameAsSuspPerson ?? undefined
    if (sameAsSuspPerson) {
      if (!personMap.has(sameAsSuspPerson)) {
        errors.push({
          part,
          field: `${prefix} - same as suspicious person`,
          message: 'Same as suspicious person is not a valid person',
        })
      }
      sameAsSuspPerson = personMap.get(sameAsSuspPerson)
      return {
        txnPerson: {
          '@id': uuidv4(),
          sameAsSuspPerson,
          [institutionKey]: institutions,
        },
        errors,
      }
    }
    //sameAsOtherPerson
    let sameAsOtherPerson = txnPerson?.sameAsOtherPerson ?? undefined
    if (sameAsOtherPerson) {
      if (!otherPersonMap.has(sameAsOtherPerson)) {
        errors.push({
          part,
          field: `${prefix} - same as other person`,
          message: 'Same as other person is not a valid person',
        })
      }
      sameAsOtherPerson = otherPersonMap.get(sameAsOtherPerson)
      return {
        txnPerson: {
          '@id': uuidv4(),
          sameAsOtherPerson,
          [institutionKey]: institutions,
        },
        errors,
      }
    }
    //other
    const other: any = txnPerson?.other
      ? this.transformSuspiciousPerson(part, prefix, {
          person: txnPerson.other,
        })
      : undefined
    if (other && other.errors.length > 0) {
      errors.push(...other.errors)
    }
    return {
      txnPerson: {
        '@id': uuidv4(),
        fullName: other?.person?.fullName,
        altName: other?.person?.altName,
        mainAddress: other?.person?.mainAddress,
        postalAddress: other?.person?.postalAddress,
        phones: other?.person?.phones,
        emails: other?.person?.emails,
        account: other?.person?.account,
        digitalCurrencyWallet: other?.person?.digitalCurrencyWallet,
        [institutionKey]: institutions,
      },
      errors,
    }
  }

  private transformTxnDetail(
    part: string,
    prefix: string,
    txnDetail: any,
    personMap: Map<string, string>,
    otherPersonMap: Map<string, string>
  ): {
    txnDetail: object
    errors: { part: string; field: string; message: string }[]
  } {
    txnDetail = txnDetail.transaction
    const errors: { part: string; field: string; message: string }[] = []
    //txnDate
    const txnDate = txnDetail?.['Transaction date'] ?? undefined
    if (!txnDate) {
      errors.push({
        part,
        field: `${prefix} - transaction date`,
        message: 'Transaction date is required',
      })
    }
    if (txnDate && !this.isValidDate(txnDate)) {
      errors.push({
        part,
        field: `${prefix} - transaction date`,
        message: 'Transaction date must be a valid date',
      })
    }
    //txnType
    const txnType = txnDetail?.['Transaction type code'] ?? undefined
    if (!txnType) {
      errors.push({
        part,
        field: `${prefix} - transaction type`,
        message: 'Transaction type is required',
      })
    }
    //txnTypeOther
    let txnTypeOther = txnDetail?.['Other transaction type'] ?? undefined
    if (txnType === 'OTHERS' && !txnTypeOther) {
      errors.push({
        part,
        field: `${prefix} - other transaction type`,
        message:
          'Other transaction type is required when transaction type is OTHER',
      })
    } else {
      txnTypeOther = undefined
    }
    //tfrType
    const tfrType = txnDetail?.['Transfer type']
      ? this.transformTfrType(part, prefix, txnDetail?.['Transfer type'])
      : undefined
    if (tfrType && tfrType.errors.length > 0) {
      errors.push(...tfrType.errors)
    }
    //txnCompleted
    const txnCompleted = txnDetail?.['Transaction completed'] ? 'Y' : 'N'
    //txnRefNo
    const txnRefNos = txnDetail?.['Transaction reference number'] ?? []
    txnRefNos.forEach((refNo, idx) => {
      if (!this.isValidLength(refNo, 20)) {
        errors.push({
          part,
          field: `${prefix} - transaction reference number #${idx + 1}`,
          message:
            'Transaction reference number must be less than 20 characters',
        })
      }
    })
    //txnAmount
    const txnAmount = txnDetail?.['Total transaction amount'] ?? undefined
    if (!txnAmount) {
      errors.push({
        part,
        field: `${prefix} - transaction amount`,
        message: 'Transaction amount is required',
      })
    }
    if (txnAmount && !this.isValidAmount(txnAmount)) {
      errors.push({
        part,
        field: `${prefix} - transaction amount`,
        message:
          'Transaction amount must in this format [0-9]{1,3}(,[0-9]{3}){0,4}(\\.[0-9]{0,2})?',
      })
    }
    //cashAmount
    const cashAmount = txnDetail?.['Cash amount'] ?? undefined
    if (cashAmount && !this.isValidAmount(cashAmount)) {
      errors.push({
        part,
        field: `${prefix} - cash amount`,
        message:
          'Cash amount must in this format [0-9]{1,3}(,[0-9]{3}){0,4}(\\.[0-9]{0,2})?',
      })
    }
    //foreignCurr
    const foreignCurr = txnDetail?.['Foreign currency']
      ? txnDetail?.['Foreign currency'].map((curr, idx) => {
          const currResult = this.transformForeignCurrency(
            part,
            prefix + ` - foreign currency #${idx + 1}`,
            curr
          )
          if (currResult.errors.length > 0) {
            errors.push(...currResult.errors)
          }
          return currResult.foreignCurrency
        })
      : undefined

    //digitalCurrency
    const digitalCurrency = txnDetail?.['Digital currency']
      ? txnDetail?.['Digital currency'].map((currency, idx) => {
          const currencyResult = this.transformDigitalCurrency(
            part,
            prefix + ` - digital currency #${idx + 1}`,
            currency
          )
          if (currencyResult.errors.length > 0) {
            errors.push(...currencyResult.errors)
          }
          return currencyResult.digitalCurrency
        })
      : undefined

    //senderDrawerIssuer
    const senderDrawerIssuer = txnDetail?.['Sender drawer issuer']
      ? txnDetail?.['Sender drawer issuer'].map((person, idx) => {
          const personResult = this.transformTxnPerson(
            part,
            prefix + ` - sender drawer issuer #${idx + 1}`,
            person,
            'sendingInstitution',
            personMap,
            otherPersonMap
          )
          if (personResult.errors.length > 0) {
            errors.push(...personResult.errors)
          }
          return personResult.txnPerson
        })
      : undefined
    //payee
    const payee = txnDetail?.['Payee']
      ? txnDetail?.['Payee'].map((person, idx) => {
          const personResult = this.transformTxnPerson(
            part,
            prefix + ` - payee #${idx + 1}`,
            person,
            'receivingInstitution',
            personMap,
            otherPersonMap
          )
          if (personResult.errors.length > 0) {
            errors.push(...personResult.errors)
          }
          return personResult.txnPerson
        })
      : undefined
    //beneficiary
    const beneficiary = txnDetail?.['Beneficiary']
      ? txnDetail?.['Beneficiary'].map((person, idx) => {
          const personResult = this.transformTxnPerson(
            part,
            prefix + ` - beneficiary #${idx + 1}`,
            person,
            'receivingInstitution',
            personMap,
            otherPersonMap
          )
          if (personResult.errors.length > 0) {
            errors.push(...personResult.errors)
          }
          return personResult.txnPerson
        })
      : undefined
    //otherInstitution
    const otherInstitution = txnDetail?.['Other institution']
      ? txnDetail?.['Other institution'].map((institution, idx) => {
          const institutionResult = this.transformInstitutionWithBranch(
            part,
            prefix + ` - other institution #${idx + 1}`,
            institution
          )
          if (institutionResult.errors.length > 0) {
            errors.push(...institutionResult.errors)
          }
          return institutionResult.institutionWithBranch
        })
      : undefined
    return {
      txnDetail: {
        '@id': uuidv4(),
        txnDate,
        txnType,
        txnTypeOther,
        tfrType,
        txnCompleted,
        txnRefNo: txnRefNos,
        txnAmount,
        cashAmount,
        foreignCurr,
        digitalCurrency,
        senderDrawerIssuer,
        payee,
        beneficiary,
        otherInstitution,
      },
      errors,
    }
  }

  private transformPreviousOrOtherAgencyReports(
    part: string,
    prefix: string,
    previousOrOtherAgencyReports: any
  ): {
    previousOrOtherAgencyReports: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    const prevReportDate =
      previousOrOtherAgencyReports?.['Previous report date'] ?? undefined
    if (!prevReportDate) {
      errors.push({
        part,
        field: `${prefix} - previous report date`,
        message: 'Previous report date is required',
      })
    }
    if (!this.isValidDate(prevReportDate)) {
      errors.push({
        part,
        field: `${prefix} - previous report date`,
        message: 'Previous report date must be a valid date',
      })
    }
    const prevReportRef =
      previousOrOtherAgencyReports?.['Previous report reference'] ?? undefined
    return {
      previousOrOtherAgencyReports: {
        '@id': uuidv4(),
        prevReportDate,
        prevReportRef,
      },
      errors,
    }
  }

  private transformOtherAustralianGovernmentAgency(
    part: string,
    prefix: string,
    otherAustralianGovernmentAgency: any
  ): {
    otherAustralianGovernmentAgency: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    const name = otherAustralianGovernmentAgency?.['Name'] ?? undefined
    if (!name) {
      errors.push({
        part,
        field: `${prefix} - name`,
        message: 'Name is required',
      })
    }
    const austracDate =
      otherAustralianGovernmentAgency?.['Austrac date'] ?? undefined
    if (!austracDate) {
      errors.push({
        part,
        field: `${prefix} - austrac date`,
        message: 'Austrac date is required',
      })
    }
    if (!this.isValidDate(austracDate)) {
      errors.push({
        part,
        field: `${prefix} - austrac date`,
        message: 'Austrac date must be a valid date',
      })
    }
    const infoProvided =
      otherAustralianGovernmentAgency?.['Information provided'] ?? undefined
    if (!infoProvided) {
      errors.push({
        part,
        field: `${prefix} - information provided`,
        message: 'Information provided is required',
      })
    }
    if (!this.isValidLength(infoProvided, 4000)) {
      errors.push({
        part,
        field: `${prefix} - information provided`,
        message: 'Information provided must be less than 4000 characters',
      })
    }
    const addr =
      otherAustralianGovernmentAgency?.['Address without country']?.[
        'Street address'
      ] ?? undefined

    if (!addr) {
      errors.push({
        part,
        field: `${prefix} - street address`,
        message: 'Street address is required',
      })
    }
    if (!this.isValidLength(addr, 140)) {
      errors.push({
        part,
        field: `${prefix} - street address`,
        message: 'Street address must be less than 140 characters',
      })
    }

    const suburb =
      otherAustralianGovernmentAgency?.['Address without country']?.[
        'Suburb/town/city'
      ] ?? undefined
    if (!suburb) {
      errors.push({
        part,
        field: `${prefix} - Suburb/town/city`,
        message: 'Suburb/town/city is required',
      })
    }
    if (!this.isValidLength(suburb, 35)) {
      errors.push({
        part,
        field: `${prefix} - Suburb/town/city`,
        message: 'Suburb/town/city must be less than 35 characters',
      })
    }

    const state =
      otherAustralianGovernmentAgency?.['Address without country']?.[
        'State or province'
      ] ?? undefined
    if (!state) {
      errors.push({
        part,
        field: `${prefix} - State or province`,
        message: 'State or province is required',
      })
    }
    if (!this.isValidLength(state, 35)) {
      errors.push({
        part,
        field: `${prefix} - State or province`,
        message: 'State or province must be less than 35 characters',
      })
    }

    const postcode =
      otherAustralianGovernmentAgency?.['Address without country']?.[
        'Postcode'
      ] ?? undefined
    if (!postcode) {
      errors.push({
        part,
        field: `${prefix} - Postcode`,
        message: 'Postcode is required',
      })
    }
    if (!this.isValidLength(postcode, 15)) {
      errors.push({
        part,
        field: `${prefix} - Postcode`,
        message: 'Postcode must be less than 15 characters',
      })
    }
    return {
      otherAustralianGovernmentAgency: {
        '@id': uuidv4(),
        name,
        austracDate,
        infoProvided,
        addressWithoutCountry: {
          addr,
          suburb,
          state,
          postcode,
        },
      },
      errors,
    }
  }

  private transformAdditionalDetails(
    part: string,
    prefix: string,
    additionalDetails: any
  ): {
    additionalDetails: object
    errors: { part: string; field: string; message: string }[]
  } {
    const errors: { part: string; field: string; message: string }[] = []
    {
      const offenceType = additionalDetails?.['Offence type'] ?? undefined
      if (!offenceType) {
        errors.push({
          part,
          field: `${prefix} - offence type`,
          message: 'Offence type is required',
        })
      }

      const prevReported = additionalDetails?.[
        'Previous or other agency reports'
      ]
        ? additionalDetails?.['Previous or other agency reports'].map(
            (report) => {
              const prevReportedResult =
                this.transformPreviousOrOtherAgencyReports(part, prefix, report)
              if (prevReportedResult.errors.length > 0) {
                errors.push(...prevReportedResult.errors)
              }
              return prevReportedResult.previousOrOtherAgencyReports
            }
          )
        : undefined

      const otherAusGov = additionalDetails?.[
        'Other australian government agency'
      ]
        ? additionalDetails?.['Other australian government agency'].map(
            (agency) => {
              const otherAusGovResult =
                this.transformOtherAustralianGovernmentAgency(
                  part,
                  prefix,
                  agency
                )
              if (otherAusGovResult.errors.length > 0) {
                errors.push(...otherAusGovResult.errors)
              }
              return otherAusGovResult.otherAustralianGovernmentAgency
            }
          )
        : undefined

      return {
        additionalDetails: {
          '@id': uuidv4(),
          offenceType,
          prevReported,
          otherAusGov,
        },
        errors,
      }
    }
  }

  private transform(reportParams: ReportParameters): object {
    // transforming the report params to the Austrac XML format
    const errors: { part: string; field: string; message: string }[] = []

    const personsMap = new Map<string, string>()
    const otherPersonsMap = new Map<string, string>()

    let fileName = reportParams.report?.reportingEntity?.fileName ?? undefined
    if (!fileName || !this.isValidReportName(fileName)) {
      errors.push({
        part: 'PART H',
        field: 'Report name',
        message: 'Report name is required and must in the format SMRyyyymmddss',
      })
    }
    const reNumber = reportParams.report?.reportingEntity?.reNumber ?? undefined
    if (!reNumber) {
      errors.push({
        part: 'PART H',
        field: 'Reporting entity number',
        message: 'Reporting entity number is required',
      })
    }
    fileName = fileName + '.xml'
    //header
    const reReportRef =
      reportParams.report?.reportingEntity?.reReportRef ?? undefined
    if (reReportRef && !this.isValidLength(reReportRef, 40)) {
      errors.push({
        part: 'PART H',
        field: 'Reporting entity reference number',
        message:
          'Reporting entity reference number must be less than 4 characters',
      })
    }
    const header = {
      '@id': uuidv4(),
      reReportRef,
      reportingBranch: {
        '@id': uuidv4(),
        name: reportParams.report?.reportingEntity?.name,
        branchId: reportParams.report?.reportingEntity?.branchId,
        address: reportParams.report?.reportingEntity?.address,
      },
    }

    //smDetails
    // designatedSvc
    const designatedSvcs =
      uniq(
        reportParams.report?.detailsOfSuspiciousMatter?.['Designated services']
      ) ?? []
    // designatedSvcProvided
    const designatedSvcProvided = reportParams.report?.[
      'Designated services provided'
    ]?.designatedSvcProvided
      ? 'Y'
      : 'N'
    // designatedSvcRequested
    const designatedSvcRequested = reportParams.report
      ?.detailsOfSuspiciousMatter?.['Designated services requested']
      ? 'Y'
      : 'N'
    // designatedSvcEnquiry
    const designatedSvcEnquiry = reportParams.report?.[
      'Designated services enquiry'
    ]?.designatedSvcEnquiry
      ? 'Y'
      : 'N'
    //suspReason
    const suspReason = reportParams.report?.detailsOfSuspiciousMatter?.[
      'Suspicion reason'
    ].filter((suspReason) => {
      if (suspReason?.['Suspicion reason code'] !== 'OTHERS') {
        return suspReason?.['Suspicion reason code']
      }
    })
    //suspReasonOther
    const suspReasonOther = reportParams.report?.detailsOfSuspiciousMatter?.[
      'Suspicion reason'
    ]?.map((suspReason, index) => {
      if (suspReason?.['Suspicion reason code'] === 'OTHERS') {
        if (suspReason?.['Other reason for suspicion']) {
          return suspReason?.['Other reason for suspicion']
        }
        errors.push({
          part: 'PART A',
          field: `Suspicion reason #${index + 1}`,
          message:
            'Suspicion reason other is required when suspicion reason is OTHER',
        })
      }
    })
    //grandTotal
    const grandTotal =
      reportParams.report?.detailsOfSuspiciousMatter?.['Total value'] ??
      undefined
    if (!grandTotal || !this.isValidAmount(grandTotal)) {
      errors.push({
        part: 'PART A',
        field: 'Total value',
        message:
          'Total value is required and must in this format [0-9]{1,3}(,[0-9]{3}){0,4}(\\.[0-9]{0,2})?',
      })
    }
    const smDetails = {
      '@id': uuidv4(),
      designatedSvc: designatedSvcs,
      designatedSvcProvided,
      designatedSvcRequested,
      designatedSvcEnquiry,
      suspReason: suspReason.map((reason) => reason?.['Suspicion reason code']),
      suspReasonOther,
      grandTotal,
    }

    //suspGrounds
    //groundsForSuspicion
    const groundsForSuspicion =
      reportParams.report?.groundsForSuspicion?.['Grounds for suspicion'] ??
      undefined
    if (!groundsForSuspicion) {
      errors.push({
        part: 'PART B',
        field: 'Grounds for suspicion',
        message: 'Grounds for suspicion is required',
      })
    }
    const suspGrounds = {
      '@id': uuidv4(),
      groundsForSuspicion,
    }

    //suspPerson
    const suspPerson = reportParams.customerAndAccountDetails?.detailsOfPerson
      ? reportParams.customerAndAccountDetails?.detailsOfPerson.map(
          (person, index) => {
            const personResult = this.transformSuspiciousPerson(
              'Part C',
              `Details of person #${index + 1}`,
              person
            )
            if (personResult.errors.length > 0) {
              errors.push(...personResult.errors)
            }
            personsMap.set(index + 1, personResult.person?.['@id'] ?? '')
            return personResult.person
          }
        )
      : undefined

    //otherPerson
    const otherPerson = reportParams.customerAndAccountDetails
      ?.detailsOfOtherParty
      ? reportParams.customerAndAccountDetails?.detailsOfOtherParty.map(
          (person, index) => {
            const personResult = this.transformOtherPerson(
              'Part D',
              `Details of other party #${index + 1}`,
              person
            )
            if (personResult.errors.length > 0) {
              errors.push(...personResult.errors)
            }
            otherPersonsMap.set(index + 1, personResult.otherPerson.id ?? '')
            return personResult.otherPerson
          }
        )
      : undefined

    //unidentPerson
    const unidentPerson = reportParams.customerAndAccountDetails
      ?.detailsOfUnidentifiedPerson
      ? reportParams.customerAndAccountDetails?.detailsOfUnidentifiedPerson.map(
          (person, index) => {
            const personResult = this.transformUnidentPerson(
              'Part E',
              `Details of unidentified person #${index + 1}`,
              person
            )
            if (personResult.errors.length > 0) {
              errors.push(...personResult.errors)
            }
            return personResult.unidentPerson
          }
        )
      : undefined

    //txnDetail
    const txnDetail = reportParams.currencyTransaction
      ?.transactionsRelatedToMatter
      ? reportParams.currencyTransaction?.transactionsRelatedToMatter.map(
          (detail, index) => {
            const detailResult = this.transformTxnDetail(
              'Part F',
              `Transactions related to matter #${index + 1}`,
              detail,
              personsMap,
              otherPersonsMap
            )
            if (detailResult.errors.length > 0) {
              errors.push(...detailResult.errors)
            }
            return detailResult.txnDetail
          }
        )
      : undefined

    //additionalDetails
    let additionalDetails = reportParams.report?.additionalDetails ?? undefined
    if (!additionalDetails) {
      errors.push({
        part: 'PART G',
        field: 'Additional details',
        message: 'Additional details is required',
      })
    }
    const additionalDetailsResult = this.transformAdditionalDetails(
      'PART G',
      'Additional details',
      additionalDetails
    )
    additionalDetails = additionalDetailsResult.additionalDetails
    errors.push(...additionalDetailsResult.errors)

    if (errors.length > 0) {
      throw new BadRequest(
        errors
          .map((error) => `${error.part} - ${error.field}: ${error.message} `)
          .join(',')
      )
    }
    return {
      smrList: {
        '@xmlns': 'http://austrac.gov.au/schema/reporting/SMR-2-0',
        reNumber,
        fileName,
        reportCount: 1,
        smr: {
          header,
          smDetails,
          suspGrounds,
          suspPerson,
          otherPerson,
          unidentPerson,
          txnDetail,
          additionalDetails,
        },
      },
    }
  }
  getAugmentedReportParams(report?: Report): ReportParameters {
    return report?.parameters ?? {}
  }
  async generate(
    reportParams: ReportParameters,
    _report: Report
  ): Promise<GenerateResult> {
    const builder = new XMLBuilder({
      attributeNamePrefix: '@',
      ignoreAttributes: false,
    })
    const xmlContent =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      builder.build(this.transform(cloneDeep(reportParams)))
    const outputFile = `${path.join('/tmp', 'input.xml')}`
    fs.writeFileSync(outputFile, xmlContent)
    return {
      type: 'STRING',
      value: xmlContent,
    }
  }
}
