import {
  AutocompleteService,
  splitStringIntoSubstrings,
} from '@/services/copilot/questions/autocompletion-service'

describe('Autocompletion', () => {
  const ac = new AutocompleteService()
  test('3 suggestions returned', async () => {
    const suggestions = ac.autocomplete('Aerts')
    expect(suggestions).toEqual([
      'Alerts',
      'Alerts related to transaction',
      'Alert transactions',
    ])
  })
  test('1 suggestions returned', async () => {
    const suggestions = ac.autocomplete('user de')
    expect(suggestions).toEqual(['User details'])
  })
  test('At least 10 returned with no input', async () => {
    const suggestions = ac.autocomplete('')
    expect(suggestions.length).toBeGreaterThan(10)
  })
})
describe('splitStringIntoSubstrings', () => {
  test('Correct strings returned', async () => {
    const suggestions = splitStringIntoSubstrings('The string to split up')
    expect(suggestions).toEqual([
      'The string to split up',
      'The',
      'string to split up',
      'The string',
      'to split up',
      'The string to',
      'split up',
      'The string to split',
      'up',
      'The string to split up',
    ])
  })
})
