import type { RoomContext } from '@/lib/db/schema';

export type RoomObjective =
  | 'landing_page'
  | 'mobile_app_flow'
  | 'product_concept'
  | 'website'
  | 'customer_journey'
  | 'ux_copy'
  | 'business_solution';

export type RoomOutputType =
  | 'react_landing_page'
  | 'react_website'
  | 'react_mobile_screens'
  | 'react_dashboard'
  | 'react_product_flow'
  | 'html_static';

export type Template = {
  id: string;
  name: string;
  description: string;
  objective: RoomObjective;
  outputType: RoomOutputType;
};

export const TEMPLATES: Template[] = [
  {
    id: 'premium-saas-landing',
    name: 'Premium SaaS Landing',
    description: 'Hero, benefits, social proof, pricing, FAQ, CTA.',
    objective: 'landing_page',
    outputType: 'react_landing_page',
  },
  {
    id: 'consumer-onboarding',
    name: 'Consumer App Onboarding',
    description: 'Welcome, value props, sign-up, dashboard handoff.',
    objective: 'mobile_app_flow',
    outputType: 'react_mobile_screens',
  },
  {
    id: 'ecommerce-product-page',
    name: 'Ecommerce Product Page',
    description: 'Product gallery, details, reviews, related, checkout.',
    objective: 'landing_page',
    outputType: 'react_landing_page',
  },
  {
    id: 'b2b-product',
    name: 'B2B Product Page',
    description: 'Problem framing, solution, integrations, demo CTA.',
    objective: 'landing_page',
    outputType: 'react_landing_page',
  },
  {
    id: 'waitlist-page',
    name: 'Waitlist Page',
    description: 'Hero, single CTA, email capture, social proof.',
    objective: 'landing_page',
    outputType: 'react_landing_page',
  },
  {
    id: 'customer-journey-map',
    name: 'Customer Journey Map',
    description: 'Phases, touchpoints, emotions, opportunities.',
    objective: 'customer_journey',
    outputType: 'react_product_flow',
  },
  {
    id: 'product-concept-brief',
    name: 'Product Concept Brief',
    description: 'Problem, solution, core features, wireframes, copy.',
    objective: 'product_concept',
    outputType: 'react_product_flow',
  },
];

export const OBJECTIVE_LABELS: Record<RoomObjective, string> = {
  landing_page: 'Design landing page',
  mobile_app_flow: 'Design mobile app flow',
  product_concept: 'Create product concept',
  website: 'Design website',
  customer_journey: 'Create customer journey',
  ux_copy: 'Improve UX copy',
  business_solution: 'Business solution prototype',
};

export const OUTPUT_TYPE_LABELS: Record<RoomOutputType, string> = {
  react_landing_page: 'React landing page',
  react_website: 'React website',
  react_mobile_screens: 'React mobile screens',
  react_dashboard: 'React dashboard',
  react_product_flow: 'React product flow',
  html_static: 'Static HTML/CSS/JS',
};

export function getTemplate(id: string | null | undefined): Template | undefined {
  if (!id) return undefined;
  return TEMPLATES.find((t) => t.id === id);
}
