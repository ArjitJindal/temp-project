import { AutocompleteService } from '@/services/copilot/questions/autocompletion-service'

describe('Autocompletion', () => {
  const ac = new AutocompleteService()
  test('3 suggestions returned', async () => {
    const suggestions = ac.autocomplete('Aerts')
    expect(suggestions).toEqual([
      'Alerts related to transaction',
      'Alerts that resulted in SAR',
      'Alert history',
    ])
  })
  test('10 returned with no input', async () => {
    const suggestions = ac.autocomplete('')
    expect(suggestions.length).toEqual(10)
  })
})
