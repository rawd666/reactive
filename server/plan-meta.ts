// Machine-readable version of the tracking limits described in prose in
// src/data/plans.ts ("4 rounds of revisions", "1 month of post-launch support").
//
// This lives server-side rather than importing src/data/plans.ts because the
// production image only ships server.ts, server/ and dist/ — src/ is not there.
// If a package's revision count or support window changes on the site, change
// it here too.

export type PlanId = 'launch' | 'grow' | 'scale';

export interface PlanMeta {
  name?: string;
  price?: string;
  monthly?: string;
  /** null = unlimited */
  revisionRounds: number | null;
  supportDays: number | null;
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  // "2 rounds", "2 weeks"
  launch: { name: 'Launch', price: '$800', monthly: '$19', revisionRounds: 2, supportDays: 14 },
  // "4 rounds", "1 month"
  grow: { name: 'Grow', price: '$1,500', monthly: '$34', revisionRounds: 4, supportDays: 30 },
  // "unlimited", "3 months"
  scale: { name: 'Scale', price: '$2,800+', monthly: '$49', revisionRounds: null, supportDays: 90 },
};

export function isPlanId(planId: string): planId is PlanId {
  return Object.hasOwn(PLAN_META, planId);
}

export function planMeta(planId: string): PlanMeta {
  return isPlanId(planId) ? PLAN_META[planId] : { revisionRounds: null, supportDays: null };
}
