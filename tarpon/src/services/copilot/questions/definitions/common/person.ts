import { Person } from '@/@types/openapi-internal/Person'
import { TableHeadersColumnTypeEnum } from '@/@types/openapi-internal/TableHeaders'

export const personToRow = (person: Person): (string | undefined)[] => {
  return [
    person.generalDetails?.name?.firstName,
    person.generalDetails?.name?.middleName,
    person.generalDetails?.name?.lastName,
    person.generalDetails.countryOfResidence,
    person.generalDetails.countryOfNationality,
    person.generalDetails.dateOfBirth,
    person.generalDetails.gender,
  ]
}

export const personColumns: {
  name: string
  columnType: TableHeadersColumnTypeEnum
}[] = [
  { name: 'First name', columnType: 'STRING' },
  { name: 'Middle name', columnType: 'STRING' },
  { name: 'Last name', columnType: 'STRING' },
  { name: 'Country of residence', columnType: 'COUNTRY' },
  { name: 'Country of nationality', columnType: 'COUNTRY' },
  { name: 'Date of birth', columnType: 'STRING' },
  { name: 'Gender', columnType: 'STRING' },
]
