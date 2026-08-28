/**
 * Шаблоны статей — быстрый старт для типовых записей. Заполняют тело
 * (заголовки разделов) и поля инфобокса, при желании подставляют категорию.
 */
export const ARTICLE_TEMPLATES = [
  {
    key: 'npc',
    label: 'Персонаж',
    category: 'Персонажи',
    facts: [
      { label: 'Раса', value: '' },
      { label: 'Роль', value: '' },
      { label: 'Место', value: '' },
    ],
    body: '## Внешность\n\n\n\n## Характер\n\n\n\n## История\n\n\n\n## Связи\n\n',
  },
  {
    key: 'location',
    label: 'Локация',
    category: 'Локации',
    facts: [
      { label: 'Тип', value: '' },
      { label: 'Правитель', value: '' },
      { label: 'Население', value: '' },
    ],
    body: '## Описание\n\n\n\n## История\n\n\n\n## Достопримечательности\n\n\n\n## Жители\n\n',
  },
  {
    key: 'artifact',
    label: 'Артефакт',
    category: 'Артефакты',
    facts: [
      { label: 'Тип', value: '' },
      { label: 'Владелец', value: '' },
      { label: 'Сила', value: '' },
    ],
    body: '## Описание\n\n\n\n## Свойства\n\n\n\n## История\n\n',
  },
  {
    key: 'state',
    label: 'Государство',
    category: 'Государства',
    facts: [
      { label: 'Столица', value: '' },
      { label: 'Правитель', value: '' },
      { label: 'Бог-покровитель', value: '' },
    ],
    body: '## Обзор\n\n\n\n## История\n\n\n\n## Политика и общество\n\n\n\n## Известные жители\n\n',
  },
  {
    key: 'god',
    label: 'Бог',
    category: 'Боги',
    facts: [
      { label: 'Сфера', value: '' },
      { label: 'Покровительствует', value: '' },
      { label: 'Символ', value: '' },
    ],
    body: '## Мифы\n\n\n\n## Культ и жрецы\n\n\n\n## Символы и облик\n\n',
  },
  {
    key: 'creature',
    label: 'Существо',
    category: 'Существа',
    facts: [
      { label: 'Тип', value: '' },
      { label: 'Ареал', value: '' },
      { label: 'Опасность', value: '' },
    ],
    body: '## Описание\n\n\n\n## Повадки\n\n\n\n## Где обитает\n\n',
  },
];
