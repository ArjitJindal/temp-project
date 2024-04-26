import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { consumerName } from '@/utils/helpers'
import { traceable } from '@/core/xray'

@traceable
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
    attributes.setAttribute(
      'userComments',
      user.comments?.map((c) => c.body) || []
    )
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
  attributes.setAttribute('name', `${consumerName(user)}`)
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
    user.legalEntity.companyGeneralDetails?.legalName
  )
  attributes.setAttribute(
    'websites',
    user.legalEntity.contactDetails?.websites || []
  )
  attributes.setAttribute(
    'industry',
    user.legalEntity.companyGeneralDetails.businessIndustry || []
  )
  attributes.setAttribute(
    'productsSold',
    user.legalEntity.companyGeneralDetails.mainProductsServicesSold || []
  )
}
