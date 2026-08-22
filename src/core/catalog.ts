/**
 * Combinatorial source tables for the SKU generator.
 *
 * Names are assembled as `brand + line + variant + format`, so generated
 * catalogues read like a real category ("Valcrest Cola Zero 1.5L") instead of
 * "Product A-124". Every brand carries a fixed hue so a generated planogram
 * shows recognisable brand blocks.
 */

import type { CategoryKey } from './model'

export type PackFormat = {
  label: string
  /** Single-unit packaging size, mm. */
  w: number
  h: number
  d: number
  /** Reference shelf price in EUR before brand/variant adjustment. */
  price: number
}

export type ProductLine = {
  name: string
  /** Variants that make sense for this line; '' means no suffix. */
  variants: readonly string[]
  /** Formats available, referenced by label. */
  formats: readonly string[]
}

export type BrandDef = {
  name: string
  /** Price multiplier — premium brands cost more and sell fewer units. */
  premium: number
  hue: number
}

export type CategoryDef = {
  key: CategoryKey
  label: string
  brands: readonly BrandDef[]
  lines: readonly ProductLine[]
  formats: readonly PackFormat[]
  /** Typical units sold per day across the whole category on one fixture. */
  dailyUnits: number
}

const F = (label: string, w: number, h: number, d: number, price: number): PackFormat => ({
  label,
  w,
  h,
  d,
  price,
})

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  beverages: {
    key: 'beverages',
    label: 'Beverages',
    dailyUnits: 340,
    brands: [
      { name: 'Valcrest', premium: 1.0, hue: 355 },
      { name: 'Aquilla', premium: 0.85, hue: 205 },
      { name: 'Nordvik', premium: 1.25, hue: 152 },
      { name: 'Solaro', premium: 0.95, hue: 32 },
      { name: 'Bramwell', premium: 1.15, hue: 268 },
      { name: 'Ostara', premium: 0.7, hue: 88 },
      { name: 'Kessari', premium: 1.05, hue: 12 },
    ],
    lines: [
      { name: 'Cola', variants: ['', 'Zero', 'Light'], formats: ['0.33L Can', '0.5L PET', '1.5L PET', '2L PET'] },
      { name: 'Lemon Soda', variants: ['', 'Zero'], formats: ['0.33L Can', '1.5L PET'] },
      { name: 'Orange', variants: ['', 'Zero', 'Blood Orange'], formats: ['0.33L Can', '1.5L PET'] },
      { name: 'Sparkling Water', variants: ['', 'Fine Bubble'], formats: ['0.5L PET', '1L PET', '1.5L PET'] },
      { name: 'Still Water', variants: ['', 'Low Mineral'], formats: ['0.5L PET', '1L PET', '2L PET'] },
      { name: 'Iced Tea', variants: ['Peach', 'Lemon', 'Zero Peach'], formats: ['0.5L PET', '1.5L PET'] },
      { name: 'Energy', variants: ['', 'Sugarfree', 'Tropical'], formats: ['0.25L Can', '0.5L Can'] },
      { name: 'Tonic', variants: ['', 'Bitter'], formats: ['0.2L Glass', '0.33L Can'] },
    ],
    formats: [
      F('0.2L Glass', 52, 165, 52, 0.79),
      F('0.25L Can', 53, 134, 53, 0.99),
      F('0.33L Can', 66, 115, 66, 1.09),
      F('0.5L Can', 66, 168, 66, 1.49),
      F('0.5L PET', 64, 218, 64, 1.19),
      F('1L PET', 78, 262, 78, 1.59),
      F('1.5L PET', 88, 318, 88, 1.89),
      F('2L PET', 95, 332, 95, 2.19),
    ],
  },

  snacks: {
    key: 'snacks',
    label: 'Snacks',
    dailyUnits: 280,
    brands: [
      { name: 'Crispa', premium: 0.9, hue: 42 },
      { name: 'Munchero', premium: 1.0, hue: 18 },
      { name: 'Golden Field', premium: 1.2, hue: 68 },
      { name: 'Snåkbar', premium: 1.35, hue: 340 },
      { name: 'Tavola', premium: 0.8, hue: 190 },
      { name: 'Belrose', premium: 1.1, hue: 300 },
    ],
    lines: [
      { name: 'Potato Chips', variants: ['Salted', 'Paprika', 'Sour Cream'], formats: ['45g Bag', '150g Bag', '250g Bag'] },
      { name: 'Tortilla', variants: ['Original', 'Chili'], formats: ['150g Bag', '250g Bag'] },
      { name: 'Pretzels', variants: ['', 'Sesame'], formats: ['45g Bag', '150g Bag'] },
      { name: 'Peanuts', variants: ['Roasted', 'Salted', 'Honey'], formats: ['100g Jar', '200g Jar'] },
      { name: 'Rice Cakes', variants: ['', 'Wholegrain'], formats: ['120g Box'] },
      { name: 'Crackers', variants: ['', 'Rosemary', 'Olive Oil'], formats: ['120g Box', '250g Box'] },
      { name: 'Popcorn', variants: ['Sweet', 'Salted'], formats: ['90g Bag', '150g Bag'] },
    ],
    formats: [
      F('45g Bag', 130, 200, 42, 0.99),
      F('90g Bag', 165, 250, 58, 1.49),
      F('100g Jar', 72, 118, 72, 2.29),
      F('120g Box', 155, 90, 62, 1.79),
      F('150g Bag', 190, 285, 72, 2.19),
      F('200g Jar', 88, 150, 88, 3.49),
      F('250g Bag', 225, 330, 85, 3.29),
      F('250g Box', 195, 110, 70, 2.89),
    ],
  },

  dairy: {
    key: 'dairy',
    label: 'Dairy & Chilled',
    dailyUnits: 300,
    brands: [
      { name: 'Alpvera', premium: 1.15, hue: 200 },
      { name: 'Marbella', premium: 0.9, hue: 48 },
      { name: 'Fjordal', premium: 1.3, hue: 172 },
      { name: 'Cascina Rossi', premium: 1.05, hue: 8 },
      { name: 'Prairie Co.', premium: 0.78, hue: 96 },
    ],
    lines: [
      { name: 'Whole Milk', variants: ['', 'Lactose Free'], formats: ['1L Carton', '0.5L Carton'] },
      { name: 'Semi Skimmed', variants: [''], formats: ['1L Carton', '0.5L Carton'] },
      { name: 'Yogurt', variants: ['Natural', 'Strawberry', 'Vanilla', 'Greek'], formats: ['125g x4 Pack', '500g Tub'] },
      { name: 'Butter', variants: ['', 'Unsalted'], formats: ['250g Block'] },
      { name: 'Cream', variants: ['Cooking', 'Whipping'], formats: ['200ml Brick'] },
      { name: 'Fresh Cheese', variants: ['', 'Light', 'Herbs'], formats: ['150g Tub', '250g Tub'] },
      { name: 'Mozzarella', variants: ['', 'Buffalo'], formats: ['125g Pouch'] },
    ],
    formats: [
      F('0.5L Carton', 65, 148, 65, 1.09),
      F('1L Carton', 70, 200, 70, 1.49),
      F('125g x4 Pack', 132, 78, 66, 2.39),
      F('500g Tub', 108, 92, 108, 2.79),
      F('250g Block', 118, 45, 62, 2.49),
      F('200ml Brick', 55, 120, 42, 1.29),
      F('150g Tub', 88, 62, 88, 1.99),
      F('250g Tub', 105, 70, 105, 2.69),
      F('125g Pouch', 115, 40, 95, 1.39),
    ],
  },

  homecare: {
    key: 'homecare',
    label: 'Home Care',
    dailyUnits: 150,
    brands: [
      { name: 'Lumavia', premium: 1.1, hue: 210 },
      { name: 'Brightpine', premium: 0.85, hue: 130 },
      { name: 'Ecoralis', premium: 1.4, hue: 100 },
      { name: 'Vantea', premium: 0.95, hue: 280 },
      { name: 'Norlux', premium: 1.2, hue: 20 },
    ],
    lines: [
      { name: 'Dish Soap', variants: ['Lemon', 'Aloe', 'Original'], formats: ['500ml Bottle', '1L Bottle'] },
      { name: 'Surface Cleaner', variants: ['', 'Antibacterial'], formats: ['750ml Spray', '1.5L Refill'] },
      { name: 'Glass Cleaner', variants: [''], formats: ['750ml Spray'] },
      { name: 'Laundry Gel', variants: ['Fresh', 'Sensitive'], formats: ['1.5L Refill', '2.5L Jug'] },
      { name: 'Fabric Softener', variants: ['Lavender', 'Cotton'], formats: ['1L Bottle', '1.5L Refill'] },
      { name: 'Floor Cleaner', variants: ['Pine', 'Marseille'], formats: ['1L Bottle', '2.5L Jug'] },
    ],
    formats: [
      F('500ml Bottle', 78, 235, 52, 1.99),
      F('750ml Spray', 100, 265, 62, 3.29),
      F('1L Bottle', 92, 275, 62, 3.79),
      F('1.5L Refill', 118, 300, 78, 4.49),
      F('2.5L Jug', 145, 320, 105, 6.49),
    ],
  },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[]
