import type { Layout, ThemeId } from '@picpac/shared';

/** A single showcase photo entry — local asset (require) plus dimensions for layout. */
export type ExamplePhoto = {
  /** Stable id referenced in the layout cells. */
  id: string;
  /** React Native image asset (static require). */

  asset: any;
  width: number;
  height: number;
};

/** A pre-built showcase example: title, theme, photo strip, and a full layout literal. */
export type ShowcaseExample = {
  id: string;
  title: string;
  themeId: ThemeId;
  description: string;
  photos: ExamplePhoto[];
  /** Full precomputed layout (6–12 pages). */
  layout: Layout;
};

// ---------------------------------------------------------------------------
// Precomputed layouts
// ---------------------------------------------------------------------------

const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };

function cell(photoId: string) {
  return { photoId, crop };
}

function emptyCell() {
  return { photoId: null, crop };
}

// FILM — 8 pages, dark cinematic, mix of one/two/four templates
const FILM_LAYOUT: Layout = {
  themeId: 'film',
  pages: [
    // cover-equivalent: 1 hero photo
    { template: 'one', cells: [cell('film_1')] },
    // spread: two landscape-ish stills
    { template: 'two', cells: [cell('film_2'), cell('film_3')] },
    { template: 'one', cells: [cell('film_1')] },
    { template: 'four', cells: [cell('film_2'), cell('film_3'), cell('film_1'), cell('film_2')] },
    { template: 'two', cells: [cell('film_3'), cell('film_1')] },
    { template: 'one', cells: [cell('film_2')] },
    { template: 'two', cells: [cell('film_3'), cell('film_2')] },
    { template: 'one', cells: [cell('film_1')] },
  ],
};

// TRAVEL — 10 pages, sky/sand/ocean palette
const TRAVEL_LAYOUT: Layout = {
  themeId: 'travel',
  pages: [
    { template: 'one', cells: [cell('travel_1')] },
    { template: 'two', cells: [cell('travel_2'), cell('travel_3')] },
    { template: 'one', cells: [cell('travel_1')] },
    { template: 'four', cells: [cell('travel_2'), cell('travel_3'), cell('travel_1'), cell('travel_2')] },
    { template: 'two', cells: [cell('travel_3'), cell('travel_1')] },
    { template: 'one', cells: [cell('travel_2')] },
    { template: 'four', cells: [cell('travel_3'), cell('travel_1'), cell('travel_2'), cell('travel_3')] },
    { template: 'two', cells: [cell('travel_1'), cell('travel_2')] },
    { template: 'one', cells: [cell('travel_3')] },
    { template: 'one', cells: [emptyCell()] },
  ],
};

// HOLIDAY — 9 pages, warm rose festive
const HOLIDAY_LAYOUT: Layout = {
  themeId: 'holiday',
  pages: [
    { template: 'one', cells: [cell('holiday_1')] },
    { template: 'two', cells: [cell('holiday_2'), cell('holiday_3')] },
    { template: 'four', cells: [cell('holiday_1'), cell('holiday_2'), cell('holiday_3'), cell('holiday_1')] },
    { template: 'one', cells: [cell('holiday_2')] },
    { template: 'two', cells: [cell('holiday_3'), cell('holiday_1')] },
    { template: 'one', cells: [cell('holiday_2')] },
    { template: 'four', cells: [cell('holiday_3'), cell('holiday_1'), cell('holiday_2'), cell('holiday_3')] },
    { template: 'two', cells: [cell('holiday_1'), cell('holiday_2')] },
    { template: 'one', cells: [cell('holiday_3')] },
  ],
};

// GRADUATION — 12 pages, lavender/formal
const GRADUATION_LAYOUT: Layout = {
  themeId: 'graduation',
  pages: [
    { template: 'one', cells: [cell('graduation_1')] },
    { template: 'two', cells: [cell('graduation_2'), cell('graduation_3')] },
    { template: 'one', cells: [cell('graduation_1')] },
    { template: 'four', cells: [cell('graduation_2'), cell('graduation_3'), cell('graduation_1'), cell('graduation_2')] },
    { template: 'two', cells: [cell('graduation_3'), cell('graduation_1')] },
    { template: 'one', cells: [cell('graduation_2')] },
    { template: 'four', cells: [cell('graduation_3'), cell('graduation_1'), cell('graduation_2'), cell('graduation_3')] },
    { template: 'two', cells: [cell('graduation_1'), cell('graduation_2')] },
    { template: 'one', cells: [cell('graduation_3')] },
    { template: 'two', cells: [cell('graduation_1'), cell('graduation_3')] },
    { template: 'four', cells: [cell('graduation_2'), cell('graduation_1'), cell('graduation_3'), cell('graduation_2')] },
    { template: 'one', cells: [cell('graduation_1')] },
  ],
};

// ---------------------------------------------------------------------------
// Photo registries (static require — resolved at bundle time)
// ---------------------------------------------------------------------------


const FILM_PHOTOS: ExamplePhoto[] = [
  { id: 'film_1', asset: require('../../assets/showcase/film_1.jpg'), width: 400, height: 400 },
  { id: 'film_2', asset: require('../../assets/showcase/film_2.jpg'), width: 400, height: 400 },
  { id: 'film_3', asset: require('../../assets/showcase/film_3.jpg'), width: 400, height: 400 },
];

const TRAVEL_PHOTOS: ExamplePhoto[] = [
  { id: 'travel_1', asset: require('../../assets/showcase/travel_1.jpg'), width: 400, height: 400 },
  { id: 'travel_2', asset: require('../../assets/showcase/travel_2.jpg'), width: 400, height: 400 },
  { id: 'travel_3', asset: require('../../assets/showcase/travel_3.jpg'), width: 400, height: 400 },
];

const HOLIDAY_PHOTOS: ExamplePhoto[] = [
  { id: 'holiday_1', asset: require('../../assets/showcase/holiday_1.jpg'), width: 400, height: 400 },
  { id: 'holiday_2', asset: require('../../assets/showcase/holiday_2.jpg'), width: 400, height: 400 },
  { id: 'holiday_3', asset: require('../../assets/showcase/holiday_3.jpg'), width: 400, height: 400 },
];

const GRADUATION_PHOTOS: ExamplePhoto[] = [
  { id: 'graduation_1', asset: require('../../assets/showcase/graduation_1.jpg'), width: 400, height: 400 },
  { id: 'graduation_2', asset: require('../../assets/showcase/graduation_2.jpg'), width: 400, height: 400 },
  { id: 'graduation_3', asset: require('../../assets/showcase/graduation_3.jpg'), width: 400, height: 400 },
];


// ---------------------------------------------------------------------------
// Exported EXAMPLES
// ---------------------------------------------------------------------------

export const EXAMPLES: ShowcaseExample[] = [
  {
    id: 'film',
    title: 'Кино',
    themeId: 'film',
    description: 'Тёмные тона и кинематографичные кадры — для историй, которые помнишь годами.',
    photos: FILM_PHOTOS,
    layout: FILM_LAYOUT,
  },
  {
    id: 'travel',
    title: 'Путешествия',
    themeId: 'travel',
    description: 'Небо, море и новые горизонты — лучший способ вернуться к любимым поездкам.',
    photos: TRAVEL_PHOTOS,
    layout: TRAVEL_LAYOUT,
  },
  {
    id: 'holiday',
    title: 'Праздник',
    themeId: 'holiday',
    description: 'Тёплые тона и радостные моменты — чтобы каждый повод стал вечным воспоминанием.',
    photos: HOLIDAY_PHOTOS,
    layout: HOLIDAY_LAYOUT,
  },
  {
    id: 'graduation',
    title: 'Выпускной',
    themeId: 'graduation',
    description: 'Торжественные и нежные страницы для самого важного праздника в жизни.',
    photos: GRADUATION_PHOTOS,
    layout: GRADUATION_LAYOUT,
  },
];

/** Find an example by id; returns undefined if not found. */
export function exampleById(id: string): ShowcaseExample | undefined {
  return EXAMPLES.find((e) => e.id === id);
}

/**
 * Returns the app-router href that opens the photobook catalog
 * pre-filtered to this example's theme.
 */
export function showcaseSourceOf(example: ShowcaseExample): string {
  return `/catalog/books?theme=${example.themeId}`;
}
