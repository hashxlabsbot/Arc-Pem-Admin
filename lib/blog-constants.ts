/** Blog categories — must match the marketing app's category styling map (categoryStyle.ts). */
export const BLOG_CATEGORIES = [
  'GST & Compliance',
  'BOQ & Cost Estimation',
  'Vendor & Contractor Management',
  'Case Studies',
  'Product Guides',
] as const

/** Free tools a post can link to — slugs must match the marketing app's lib/tools.ts. */
export const BLOG_RELATED_TOOLS = [
  { slug: 'contractor-bill-generator', name: 'GST Contractor Bill Generator' },
  { slug: 'construction-cost-calculator', name: 'Construction Cost Calculator' },
  { slug: 'concrete-calculator', name: 'Concrete Calculator' },
] as const

export const BLOG_STATUSES = ['DRAFT', 'PUBLISHED'] as const
