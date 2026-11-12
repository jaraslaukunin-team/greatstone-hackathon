import { lightColors } from '../theme/theme';

export type StoryCta = {
  label: string;
  href: string;
};

export type StorySlide = {
  title: string;
  body: string;
  bg: string;
  textColor?: string;
  cta?: StoryCta;
};

export type CompanyStory = {
  id: string;
  title: string;
  /** Кольцо и фон аватарки в ленте */
  accent: string;
  /** Буква/короткий значок в кружке */
  mark: string;
  slides: StorySlide[];
};

export const STORIES: CompanyStory[] = [
  {
    id: 'discounts',
    title: 'Скидки',
    accent: lightColors.accent,
    mark: '%',
    slides: [
      {
        title: '−15% на первую фотокнигу',
        body: 'Для новых клиентов PicPac: оформите первую книгу и получите скидку на заказ.',
        bg: lightColors.accent,
        textColor: lightColors.textOnAccent,
      },
      {
        title: 'Выпускной сезон',
        body: 'Общий альбом класса — выгоднее, чем печатать по одной. Соберите фото вместе и закажите копии.',
        bg: '#C44545',
        textColor: lightColors.textOnAccent,
        cta: { label: 'Создать альбом', href: '/album/create' },
      },
    ],
  },
  {
    id: 'price',
    title: 'Прайс',
    accent: lightColors.action,
    mark: 'Br',
    slides: [
      {
        title: 'Цена без сюрпризов',
        body: 'Итог считается в приложении: формат, число страниц, бумага и тираж. Тарифы не зашиты в интерфейс — только из каталога.',
        bg: lightColors.action,
        textColor: lightColors.textOnAccent,
      },
      {
        title: 'Смотрите варианты',
        body: 'Выберите фотокнигу или печать — сразу увидите ориентир по стоимости и сможете собрать макет.',
        bg: '#283837',
        textColor: lightColors.textOnAccent,
        cta: { label: 'Открыть каталог', href: '/catalog/books' },
      },
    ],
  },
  {
    id: 'designs',
    title: 'Дизайны',
    accent: '#7AA45A',
    mark: '✦',
    slides: [
      {
        title: 'Темы под настроение',
        body: 'Кино, путешествия, праздник, выпускной — готовые стили обложки и разворотов.',
        bg: lightColors.fillMint,
        textColor: lightColors.text,
      },
      {
        title: 'Правьте как хотите',
        body: 'Автораскладка — старт. Потом меняйте фото, подписи и фон страниц под себя.',
        bg: lightColors.fillSand,
        textColor: lightColors.text,
        cta: { label: 'Выбрать книгу', href: '/catalog/books' },
      },
    ],
  },
  {
    id: 'production',
    title: 'Производство',
    accent: '#5B7C99',
    mark: '◎',
    slides: [
      {
        title: 'Печатаем в Беларуси',
        body: 'Собственное производство: контроль цвета, бумаги и переплёта на каждом тираже.',
        bg: lightColors.fillSky,
        textColor: lightColors.text,
      },
      {
        title: 'Качество на ощупь',
        body: 'Плотная бумага, аккуратный корешок, обложка, которая не боится полок и переездов.',
        bg: '#3D5A73',
        textColor: lightColors.textOnAccent,
      },
    ],
  },
  {
    id: 'howto',
    title: 'Как заказать',
    accent: '#8B6BB0',
    mark: '1',
    slides: [
      {
        title: '1. Выберите формат',
        body: 'Фотокнига, печать или общий выпускной альбом — старт из каталога или раздела «Альбом».',
        bg: lightColors.fillLilac,
        textColor: lightColors.text,
      },
      {
        title: '2. Загрузите фото',
        body: 'С телефона или из облака. Мы подскажем, где качество слабое, до отправки в печать.',
        bg: '#D4C8E8',
        textColor: lightColors.text,
      },
      {
        title: '3. Оплатите и ждите',
        body: 'Макет уходит в производство. Статус заказа смотрите во вкладке «Заказы».',
        bg: lightColors.action,
        textColor: lightColors.textOnAccent,
        cta: { label: 'Начать', href: '/catalog/books' },
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Доставка',
    accent: '#B8612E',
    mark: '→',
    slides: [
      {
        title: 'По всей Беларуси',
        body: 'Курьер или пункт выдачи — способ выбираете при оформлении заказа.',
        bg: lightColors.fillSand,
        textColor: lightColors.text,
      },
      {
        title: 'Бережная упаковка',
        body: 'Книги едут в защитной упаковке, чтобы углы и обложка доехали целыми.',
        bg: '#E8996C',
        textColor: lightColors.text,
      },
    ],
  },
  {
    id: 'reviews',
    title: 'Отзывы',
    accent: lightColors.accent,
    mark: '★',
    slides: [
      {
        title: '«Собрали выпускной за вечер»',
        body: 'Родители класса загрузили фото по ссылке — получился общий альбом и копии для каждого.',
        bg: lightColors.fillRose,
        textColor: lightColors.text,
      },
      {
        title: '«Цвета как на экране»',
        body: 'Заказывали книгу путешествий — бумага плотная, печать ровная, переплёт крепкий.',
        bg: lightColors.accent,
        textColor: lightColors.textOnAccent,
        cta: { label: 'Сделать свою', href: '/catalog/books' },
      },
    ],
  },
];

export function storyById(id: string): CompanyStory | undefined {
  return STORIES.find((s) => s.id === id);
}

export function nextStoryId(id: string): string | undefined {
  const i = STORIES.findIndex((s) => s.id === id);
  if (i < 0 || i >= STORIES.length - 1) return undefined;
  return STORIES[i + 1]?.id;
}
