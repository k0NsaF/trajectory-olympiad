import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildMinobrnaukiPageUrl,
  deduplicateRegistryRecords,
  deriveRegistryShortName,
  extractCityFromAddress,
  getOfficialHostname,
  getRootDomain,
  normalizeRegistryName,
  parseMicceduInstitutionPage,
  parseMicceduRegionPage,
  parseMicceduRegionsPage,
  parseMinobrnaukiAdmissionsPage,
  parseMinobrnaukiTotalPages
} from '../src/services/university-registry-parser.mjs'

test('реестр университетов: парсинг и нормализация государственных источников', async (t) => {
  await t.test('нормализует организационно-правовые префиксы и ё', () => {
    assert.equal(
      normalizeRegistryName('ФГБОУ ВО «Сургутский государственный университет»'),
      normalizeRegistryName('Сургутский государственный университет')
    )
    assert.equal(getRootDomain('https://abiturient.surgu.ru/admission'), 'surgu.ru')
    assert.equal(getOfficialHostname('https://www.sof.bsu.edu.ru/admission'), 'sof.bsu.edu.ru')
    assert.equal(getRootDomain('https://abitur.gnesin-academy.ru'), 'gnesin-academy.ru')
    assert.equal(
      normalizeRegistryName('Автономная некоммерческая организация высшего образования "Белгородский университет кооперации, экономики и права"'),
      normalizeRegistryName('Белгородский университет кооперации, экономики и права')
    )
    assert.equal(
      normalizeRegistryName('ФГБОУ ВО «Пермская государственная фармацевтическая академия» Министерства здравоохранения Российской Федерации'),
      normalizeRegistryName('Пермская государственная фармацевтическая академия')
    )
    assert.equal(deriveRegistryShortName('ФГБОУ ВО «Пермская государственная фармацевтическая академия» Министерства здравоохранения РФ'), 'Пермская государственная фармацевтическая академия')
    assert.equal(
      deriveRegistryShortName('Брянский филиал федерального государственного бюджетного образовательного учреждения высшего образования «Российская академия народного хозяйства и государственной службы при Президенте Российской Федерации»'),
      'Брянский филиал'
    )
    assert.equal(
      deriveRegistryShortName('Старооскольский технологический институт им. А.А. Угарова (филиал) федерального государственного автономного образовательного учреждения высшего образования «Национальный исследовательский технологический университет «МИСИС»'),
      'Старооскольский технологический институт им. А.А. Угарова (филиал)'
    )
    assert.equal(
      deriveRegistryShortName('Государственное автономное образовательное учреждение Высшего образования Новосибирской области Новосибирский государственный театральный институт'),
      'Новосибирский государственный театральный институт'
    )
    assert.equal(
      deriveRegistryShortName('Филиал Автономной некоммерческой образовательной организации высшего образования «Воронежский экономико-правовой институт» в г.Старый Оскол'),
      'Филиал: Воронежский экономико-правовой институт (Старый Оскол)'
    )
    assert.equal(
      normalizeRegistryName('Старооскольский филиал федерального государственного автономного образовательного учреждения высшего образования «Белгородский государственный национальный исследовательский университет»'),
      normalizeRegistryName('Старооскольский филиал «Белгородский государственный национальный исследовательский университет»')
    )
    assert.equal(extractCityFromAddress('309502, Белгородская обл., г Старый Оскол, мкр Солнечный, д 18'), 'Старый Оскол')
    assert.equal(extractCityFromAddress('Белгородская область 308503, Белгородский район, пс.Майский, Вавилова, д.1'), 'Майский')
    assert.equal(extractCityFromAddress('Брянская обл., 243365, Россия, Брянская обл., Выгоничский р-н, с. Кокино, ул. Советская 2а'), 'Кокино')
  })

  await t.test('извлекает университет и ссылки из каталога Минобрнауки', () => {
    const html = `
      <html><body>
        <h3>Государственные вузы</h3>
        <h4>ФГБОУ ВО «Сургутский государственный университет»</h4>
        <div>
          <a href="https://abiturient.surgu.ru/">Страница приемной кампании</a>
          <a href="https://surgu.ru/files/rules-2026.pdf">Правила приема</a>
          <a href="https://abiturient.surgu.ru/places">Число мест</a>
        </div>
        <h4>ФГБОУ ВО «Московский физико-технический институт»</h4>
        <div>
          <a href="https://pk.mipt.ru/">Страница приемной кампании</a>
          <a href="https://mipt.ru/docs/rules.pdf">Правила приема</a>
          <a href="https://pk.mipt.ru/places">Число мест</a>
        </div>
        <h3>Негосударственные вузы</h3>
      </body></html>`

    const records = parseMinobrnaukiAdmissionsPage(html)
    assert.equal(records.length, 2)
    assert.equal(records[0].organizationName, 'ФГБОУ ВО «Сургутский государственный университет»')
    assert.equal(records[0].officialDomain, 'surgu.ru')
    assert.equal(records[0].admissionUrl, 'https://abiturient.surgu.ru/')
    assert.equal(records[0].rulesUrl, 'https://surgu.ru/files/rules-2026.pdf')
    assert.equal(records[0].placesUrl, 'https://abiturient.surgu.ru/places')
    assert.equal(records[1].officialDomain, 'mipt.ru')
  })

  await t.test('определяет пагинацию каталога Минобрнауки', () => {
    assert.equal(parseMinobrnaukiTotalPages('<a href="?PAGEN_1=61&SIZEN_1=10">61</a>'), 61)
    assert.equal(buildMinobrnaukiPageUrl(1), 'https://minobrnauki.gov.ru/abitur/')
    assert.match(buildMinobrnaukiPageUrl(2), /PAGEN_1=2/u)
  })

  await t.test('собирает региональные карточки MICCEDU', () => {
    const html = `
      <a href="/iam/2025/_vpo/material.php?id=10301&amp;type=2">г.Москва</a>
      <a href="/iam/2025/_vpo/material.php?id=10302&amp;type=2">Московская область</a>`
    const regions = parseMicceduRegionsPage(html, 2025)
    assert.equal(regions.length, 2)
    assert.equal(regions[0].regionKey, '10301')
    assert.equal(regions[0].regionName, 'г.Москва')
  })

  await t.test('извлекает организации и идентификаторы MICCEDU из региона', () => {
    const region = {
      regionKey: '10301',
      regionName: 'г.Москва',
      url: 'https://monitoring.miccedu.ru/iam/2025/_vpo/material.php?id=10301&type=2'
    }
    const html = `
      <a href="inst.php?id=113493">Автономная некоммерческая образовательная организация высшего образования «Сколковский институт науки и технологий»</a>
      <a href="inst.php?id=111037">Московский государственный университет имени М. В. Ломоносова</a>`

    const records = parseMicceduRegionPage(html, region, 2025)
    assert.equal(records.length, 2)
    assert.equal(records[0].sourceRecordKey, '113493')
    assert.equal(records[0].dataYear, 2024)
    assert.equal(records[0].region, 'г.Москва')
    assert.match(records[0].sourceUrl, /inst\.php\?id=113493/u)
  })

  await t.test('обогащает карточку MICCEDU городом, адресом, сайтом и типом организации', () => {
    const baseRecord = {
      sourceKey: 'miccedu_monitoring',
      sourceRecordKey: '17',
      sourceYear: 2025,
      dataYear: 2024,
      organizationName: 'Федеральное государственное автономное образовательное учреждение высшего образования «Белгородский государственный национальный исследовательский университет»',
      normalizedName: 'белгородский государственный национальный исследовательский университет',
      shortName: 'Белгородский государственный национальный исследовательский университет',
      city: null,
      region: 'Белгородская область',
      isBranch: false,
      sourceUrl: 'https://monitoring.miccedu.ru/iam/2025/_vpo/inst.php?id=17',
      metadata: { source: 'Мониторинг высшего образования' }
    }
    const html = `
      <html><body><table>
        <tr><td>Наименование образовательной организации</td><td>Федеральное государственное автономное образовательное учреждение высшего образования «Белгородский государственный национальный исследовательский университет»</td></tr>
        <tr><td>Регион, адрес</td><td><a href="region.php?id=1">Белгородская область</a> 308015, г.Белгород, ул.Победы, д.85</td></tr>
        <tr><td>Ведомственная принадлежность</td><td>Министерство науки и высшего образования Российской Федерации</td></tr>
        <tr><td>web-сайт</td><td><a href="http://www.bsuedu.ru">http://www.bsuedu.ru</a></td></tr>
      </table></body></html>`

    const enriched = parseMicceduInstitutionPage(html, baseRecord)
    assert.equal(enriched.city, 'Белгород')
    assert.equal(enriched.region, 'Белгородская область')
    assert.equal(enriched.address, 'Белгородская область 308015, г.Белгород, ул.Победы, д.85')
    assert.equal(enriched.websiteUrl, 'http://www.bsuedu.ru/')
    assert.equal(enriched.officialDomain, 'bsuedu.ru')
    assert.equal(enriched.organizationType, 'public')
    assert.equal(enriched.metadata.profileEnriched, true)
  })

  await t.test('связывает карточку филиала MICCEDU с головной организацией', () => {
    const baseRecord = {
      sourceKey: 'miccedu_monitoring',
      sourceRecordKey: '10000055',
      sourceYear: 2025,
      dataYear: 2024,
      organizationName: 'Старооскольский филиал федерального государственного автономного образовательного учреждения высшего образования "Белгородский государственный национальный исследовательский университет"',
      normalizedName: 'старооскольский филиал белгородский государственный национальный исследовательский университет',
      city: null,
      region: 'Белгородская область',
      isBranch: true,
      sourceUrl: 'https://monitoring.miccedu.ru/iam/2025/_vpo/inst.php?id=10000055',
      metadata: {}
    }
    const html = `
      <table>
        <tr><td>Наименование образовательной организации</td><td>Старооскольский филиал федерального государственного автономного образовательного учреждения высшего образования "Белгородский государственный национальный исследовательский университет"</td></tr>
        <tr><td>Регион, адрес</td><td><a href="region.php?id=1">Белгородская область</a> 309502, Белгородская обл, г Старый Оскол, мкр Солнечный, д 18</td></tr>
        <tr><td>Ведомственная принадлежность</td><td>Министерство науки и высшего образования Российской Федерации</td></tr>
        <tr><td>web-сайт</td><td><a href="http://www.sof.bsu.edu.ru">http://www.sof.bsu.edu.ru</a></td></tr>
        <tr><td>Сведения о головной образовательной организации</td><td><a href="inst.php?id=17">Федеральное государственное автономное образовательное учреждение высшего образования «Белгородский государственный национальный исследовательский университет»</a></td></tr>
      </table>`

    const enriched = parseMicceduInstitutionPage(html, baseRecord)
    assert.equal(enriched.city, 'Старый Оскол')
    assert.equal(enriched.isBranch, true)
    assert.equal(enriched.parentSourceRecordKey, '17')
    assert.match(enriched.parentOrganizationName, /Белгородский государственный национальный исследовательский университет/u)
    assert.match(enriched.shortName, /^Старооскольский филиал/u)
    assert.equal(enriched.officialDomain, 'sof.bsu.edu.ru')
  })

  await t.test('не принимает ссылку на соседний вуз за головную организацию филиала', () => {
    const baseRecord = {
      sourceKey: 'miccedu_monitoring',
      sourceRecordKey: 'branch-2',
      sourceYear: 2025,
      dataYear: 2024,
      organizationName: 'Филиал университета в городе N',
      normalizedName: 'филиал университета в городе n',
      city: null,
      region: 'Регион',
      isBranch: true,
      sourceUrl: 'https://monitoring.miccedu.ru/iam/2025/_vpo/inst.php?id=branch-2',
      metadata: {}
    }
    const html = `
      <table>
        <tr><td>Наименование образовательной организации</td><td>Филиал университета в городе N</td></tr>
        <tr><td>Регион, адрес</td><td>г. Город N, ул. Центральная, д. 1</td></tr>
        <tr><td>Web-сайт</td><td><a href="https://branch.example.ru">https://branch.example.ru</a></td></tr>
      </table>
      <a href="inst.php?id=neighbor">Соседний университет</a>`
    const enriched = parseMicceduInstitutionPage(html, baseRecord)
    assert.equal(enriched.parentSourceRecordKey, null)
    assert.equal(enriched.parentOrganizationName, null)
  })

  await t.test('извлекает головной вуз из юридического названия филиала без отдельной строки MICCEDU', () => {
    const baseRecord = {
      sourceKey: 'miccedu_monitoring',
      sourceRecordKey: '10006726',
      sourceYear: 2025,
      dataYear: 2024,
      organizationName: 'Брянский филиал федерального государственного бюджетного образовательного учреждения высшего образования "Российская академия народного хозяйства и государственной службы при Президенте Российской Федерации"',
      normalizedName: 'брянский филиал российская академия народного хозяйства',
      shortName: 'Брянский филиал',
      city: null,
      region: 'Брянская область',
      isBranch: true,
      sourceUrl: 'https://monitoring.miccedu.ru/iam/2025/_vpo/inst.php?id=10006726',
      metadata: {}
    }
    const html = `
      <table>
        <tr><td>Наименование образовательной организации</td><td>${baseRecord.organizationName}</td></tr>
        <tr><td>Регион, адрес</td><td>Брянская область 241050, г Брянск, ул Горького, д 18</td></tr>
        <tr><td>Ведомственная принадлежность</td><td>Правительство Российской Федерации</td></tr>
      </table>`

    const enriched = parseMicceduInstitutionPage(html, baseRecord)
    assert.equal(enriched.isBranch, true)
    assert.equal(enriched.parentSourceRecordKey, null)
    assert.match(enriched.parentOrganizationName, /Российская академия народного хозяйства и государственной службы/u)
    assert.equal(enriched.city, 'Брянск')
  })

  await t.test('дедуплицирует повторные записи одного источника', () => {
    const base = {
      sourceKey: 'miccedu_monitoring',
      sourceRecordKey: '123',
      organizationName: 'Сургутский государственный университет',
      normalizedName: 'сургутский государственный университет',
      sourceUrl: 'https://monitoring.miccedu.ru/inst.php?id=123',
      city: null,
      region: 'Ханты-Мансийский автономный округ'
    }
    const result = deduplicateRegistryRecords([
      base,
      { ...base, city: 'Сургут', websiteUrl: 'https://surgu.ru' }
    ])

    assert.equal(result.length, 1)
    assert.equal(result[0].city, 'Сургут')
    assert.equal(result[0].websiteUrl, 'https://surgu.ru')
  })
})
