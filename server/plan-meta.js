// Machine-readable version of the tracking limits described in prose in
// src/data/plans.js ("4 rounds of revisions", "1 month of post-launch support").
//
// This lives server-side rather than importing src/data/plans.js because the
// production image only ships server.js, server/ and dist/ — src/ is not there.
// If a package's revision count or support window changes on the site, change
// it here too.

export const PLAN_META = {
  // "2 rounds", "2 weeks"
  launch: { name: 'Launch', price: '$800', monthly: '$19', revisionRounds: 2, supportDays: 14 },
  // "4 rounds", "1 month"
  grow: { name: 'Grow', price: '$1,500', monthly: '$34', revisionRounds: 4, supportDays: 30 },
  // "unlimited", "3 months"
  scale: { name: 'Scale', price: '$2,800+', monthly: '$49', revisionRounds: null, supportDays: 90 },
};

export function planMeta(planId) {
  return PLAN_META[planId] || { revisionRounds: null, supportDays: null };
}
