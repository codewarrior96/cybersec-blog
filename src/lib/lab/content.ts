// Barrel — re-exports from domain content modules.
// Source data lives in `src/content/{modules,tools,challenges,training-sets}`.
// Existing consumers continue to import from this path; no call-site changes needed.

export { MODULES } from '@/content/modules'
export { TOOL_CATEGORIES, TOOLS } from '@/content/tools'
export { CHALLENGES } from '@/content/challenges'
export { TRAINING_SETS } from '@/content/training-sets'
