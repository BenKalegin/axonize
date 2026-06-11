import { describe, it, expect } from 'vitest'
import { isDocLink, matchDocTarget } from '../../../src/renderer/lib/doc-link'

const CORPUS = [
  'corpus/idm/Techpubs_GenAI_Document-303469-1-LATEST_m3udi_latest_en-us_m3beud_busctrlhs_cas950.txt',
  'corpus/idm/Techpubs_GenAI_Document-263560-1-LATEST_ln_latest_en-us_lnolh_tcolh_help_tc_tax_tctax1100m000.txt',
  'corpus/idm/Techpubs_GenAI_Document-225177-1-LATEST_pub_latest_en-us_installtechlib_cloud_techdoc_ManagePeopleEntities.md',
  'questions/golden-set.md',
  'README.md'
]

describe('doc-link', () => {
  it('detects doc:// hrefs', () => {
    expect(isDocLink('doc://TechDoc-Foo-1-ACTIVE')).toBe(true)
    expect(isDocLink('https://example.com')).toBe(false)
    expect(isDocLink('./other.md')).toBe(false)
  })

  it('matches decorated targets to the corpus file (prefix + suffix tolerated)', () => {
    const target =
      'TechDoc-Techpubs_GenAI_Document-263560-1-LATEST_ln_latest_en-us_lnolh_tcolh_help_tc_tax_tctax1100m000-1-ACTIVE'
    expect(matchDocTarget(target, CORPUS)).toBe(CORPUS[1])
  })

  it('matches exact basenames', () => {
    const target = 'Techpubs_GenAI_Document-303469-1-LATEST_m3udi_latest_en-us_m3beud_busctrlhs_cas950'
    expect(matchDocTarget(target, CORPUS)).toBe(CORPUS[0])
  })

  it('matches case-insensitively', () => {
    const target =
      'techdoc-TECHPUBS_GENAI_DOCUMENT-225177-1-LATEST_pub_latest_en-us_installtechlib_cloud_techdoc_managepeopleentities-1-ACTIVE'
    expect(matchDocTarget(target, CORPUS)).toBe(CORPUS[2])
  })

  it('returns null when nothing matches', () => {
    expect(matchDocTarget('TechDoc-Unknown_Document-999999-1-ACTIVE', CORPUS)).toBeNull()
  })

  it('never matches on short ambiguous basenames', () => {
    expect(matchDocTarget('TechDoc-README-1-ACTIVE', CORPUS)).toBeNull()
  })

  it('prefers md over txt when both match equally', () => {
    const files = ['corpus/a/Some_Long_Document_Name.txt', 'corpus/b/Some_Long_Document_Name.md']
    expect(matchDocTarget('TechDoc-Some_Long_Document_Name-1-ACTIVE', files)).toBe(files[1])
  })

  it('prefers the longest (most specific) contained basename', () => {
    const files = ['corpus/Doc-100.md', 'corpus/Doc-100-1-LATEST_full_name.md']
    expect(matchDocTarget('TechDoc-Doc-100-1-LATEST_full_name-1-ACTIVE', files)).toBe(files[1])
  })
})
