import SEARCH_EMPTY from '@/test-utils/resources/empty/details.json'
import SEARCH_1794517025 from '@/test-utils/resources/1794517025/details.json'
import SEARCH_1794517025_ENTITIES_PAGE1 from '@/test-utils/resources/1794517025/entities/page1.json'
import SEARCH_1794517025_ENTITIES_PAGE2 from '@/test-utils/resources/1794517025/entities/page2.json'
import SEARCH_1794517025_ENTITIES_PAGE3 from '@/test-utils/resources/1794517025/entities/page3.json'
import SEARCH_1794517025_ENTITIES_PAGE4 from '@/test-utils/resources/1794517025/entities/page4.json'
import SEARCH_1794517025_ENTITIES_PAGE5 from '@/test-utils/resources/1794517025/entities/page5.json'

export const MOCK_SEARCH_1794517025_DATA = {
  details: SEARCH_1794517025,
  entities: [
    SEARCH_1794517025_ENTITIES_PAGE1,
    SEARCH_1794517025_ENTITIES_PAGE2,
    SEARCH_1794517025_ENTITIES_PAGE3,
    SEARCH_1794517025_ENTITIES_PAGE4,
    SEARCH_1794517025_ENTITIES_PAGE5,
  ],
}

export const MOCK_SEARCH_EMPTY_DATA = {
  details: SEARCH_EMPTY,
  entities: [],
}

export const MOCK_CA_SEARCH_RESPONSE = MOCK_SEARCH_1794517025_DATA.details

export const MOCK_CA_SEARCH_NO_HIT_RESPONSE = MOCK_SEARCH_EMPTY_DATA.details
