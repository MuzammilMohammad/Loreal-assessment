import type { ClaimFormValues } from '../types/assessment';

export const sampleClaim: ClaimFormValues = {
  claimText: 'Reduces wrinkles by 20% in 4 weeks',
  productName: 'Revitalift sample serum',
  population: 'Adults aged 40–65 with mild to moderate facial wrinkles',
  evidence:
    'A randomized, double-blind, vehicle-controlled 4-week study enrolled 120 adults aged 40–65. The active product group showed a 12% mean reduction in wrinkle depth versus 5% with vehicle. Between-group difference: 7 percentage points, 95% CI 2–12, p=0.01.',
};
