import * as dsa from './dsa/index.js'
import * as spring from './spring/index.js'

/**
 * Every track's chapters live in its own folder and expose the same two
 * exports: `topics` and `tiers`. Everything a page needs is derived from those
 * here, so pages never care which track they are rendering.
 */
const TRACK_CONTENT = { dsa, spring }

/** Tier names are shared across tracks so colours and cards stay consistent. */
export const TIER_NAMES = ['Foundations', 'Core', 'Advanced', 'Elite']

export const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 }

const cache = new Map()

function build(trackId) {
  const source = TRACK_CONTENT[trackId]
  if (!source) {
    return {
      trackId, topics: [], topicsById: {}, tiers: [], topicsByTier: [],
      allProblems: [], allPatterns: [], stats: { topics: 0, patterns: 0, problems: 0, hours: 0, sections: 0 },
    }
  }

  const topics = [...(source.topics || [])].sort((a, b) => a.order - b.order)
  const tiers = source.tiers || []

  const allProblems = topics.flatMap((t) =>
    (t.problems || []).map((p) => ({ ...p, trackId, topicId: t.id, topicTitle: t.short || t.title })),
  )
  const allPatterns = topics.flatMap((t) =>
    (t.patterns || []).map((p) => ({ ...p, trackId, topicId: t.id, topicTitle: t.short || t.title, tier: t.tier })),
  )

  return {
    trackId,
    topics,
    topicsById: Object.fromEntries(topics.map((t) => [t.id, t])),
    tiers,
    topicsByTier: tiers
      .map((tier) => ({ ...tier, topics: topics.filter((t) => t.tier === tier.name) }))
      .filter((tier) => tier.topics.length > 0),
    allProblems,
    allPatterns,
    stats: {
      topics: topics.length,
      patterns: allPatterns.length,
      problems: allProblems.length,
      hours: topics.reduce((sum, t) => sum + (t.estHours || 0), 0),
      sections: topics.reduce((sum, t) => sum + (t.sections?.length || 0), 0),
    },
  }
}

/** Everything a page needs for one track. Memoised — the result is immutable. */
export function contentFor(trackId) {
  if (!cache.has(trackId)) cache.set(trackId, build(trackId))
  return cache.get(trackId)
}

/** Previous/next chapter within a track, for the footer navigation. */
export function neighbours(trackId, topicId) {
  const { topics } = contentFor(trackId)
  const i = topics.findIndex((t) => t.id === topicId)
  return {
    prev: i > 0 ? topics[i - 1] : null,
    next: i >= 0 && i < topics.length - 1 ? topics[i + 1] : null,
  }
}
