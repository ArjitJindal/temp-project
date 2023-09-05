import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

export class UserAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return []
  }
  build(attributes: AttributeSet, inputData: InputData) {
    attributes.setAttribute('userType', inputData.user.type)
    const user = inputData.user
    if (user.type === 'BUSINESS') {
      businessAttributes(attributes, user)
    } else {
      consumerAttributes(attributes, user)
    }
  }
}

function consumerAttributes(
  attributes: AttributeSet,
  user: InternalConsumerUser
) {
  attributes.setAttribute(
    'country',
    user.userDetails?.countryOfResidence ||
      user.userDetails?.countryOfNationality
  )
  attributes.setAttribute(
    'name',
    `${user.userDetails?.name.firstName} ${user.userDetails?.name.middleName} ${user.userDetails?.name.lastName}`,
    true
  )
}
function businessAttributes(
  attributes: AttributeSet,
  user: InternalBusinessUser
) {
  attributes.setAttribute(
    'country',
    user.legalEntity.companyRegistrationDetails?.registrationCountry
  )
  attributes.setAttribute(
    'name',
    user.legalEntity.companyGeneralDetails?.legalName,
    true
  )
  attributes.setAttribute(
    'websites',
    user.legalEntity.contactDetails?.websites || [],
    true
  )
  attributes.setAttribute(
    'industry',
    user.legalEntity.companyGeneralDetails.businessIndustry || []
  )
  attributes.setAttribute(
    'productsSold',
    user.legalEntity.companyGeneralDetails.mainProductsServicesSold || []
  )
  attributes.setAttribute('userComments', user.comments || [])
}
