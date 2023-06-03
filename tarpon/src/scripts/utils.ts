import { v4 as uuidv4 } from 'uuid'
import {
  uniqueNamesGenerator,
  Config as namesConfig,
  names,
} from 'unique-names-generator'

export const createUuid = () => {
  return uuidv4().replace(/-/g, '')
}

export const getRandomIntInclusive = (min: number, max: number) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min //The maximum is inclusive and the minimum is inclusive
}

const uniqueNamesConfig: namesConfig = {
  dictionaries: [names],
  length: 1,
}

export const createNameEntity = () => {
  return {
    firstName: uniqueNamesGenerator(uniqueNamesConfig),
    middleName: uniqueNamesGenerator(uniqueNamesConfig),
    lastName: uniqueNamesGenerator(uniqueNamesConfig),
  }
}

export const getNameString = () => {
  uniqueNamesGenerator(uniqueNamesConfig)
}

export const generateRandomString = (length: number) => {
  return (Math.random() + 1).toString(36).substring(length)
}
