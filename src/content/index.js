import complexity from './topics/complexity.js'
import arrays from './topics/arrays.js'
import twoPointers from './topics/two-pointers.js'
import binarySearch from './topics/binary-search.js'
import hashing from './topics/hashing.js'
import strings from './topics/strings.js'
import sorting from './topics/sorting.js'
import linkedList from './topics/linked-list.js'
import stacksQueues from './topics/stacks-queues.js'
import recursion from './topics/recursion.js'
import trees from './topics/trees.js'
import heaps from './topics/heaps.js'
import graphs from './topics/graphs.js'
import intervals from './topics/intervals.js'
import greedy from './topics/greedy.js'
import dp from './topics/dp.js'
import tries from './topics/tries.js'
import unionFind from './topics/union-find.js'
import bitManipulation from './topics/bit-manipulation.js'
import math from './topics/math.js'
import advancedStructures from './topics/advanced-structures.js'

export const topics = [
  complexity, arrays, twoPointers, binarySearch, hashing, strings, sorting,
  linkedList, stacksQueues, recursion, trees, heaps, graphs, intervals, greedy,
  dp, tries, unionFind, bitManipulation, math, advancedStructures,
].sort((a, b) => a.order - b.order)

export const topicsById = Object.fromEntries(topics.map((t) => [t.id, t]))

export const TIERS = [
  {
    name: 'Foundations',
    blurb: 'The substrate. Every later chapter assumes you are fluent here — do not skip ahead.',
  },
  {
    name: 'Core',
    blurb: 'The structures that make up the bulk of real interviews. This is where most of your time goes.',
  },
  {
    name: 'Advanced',
    blurb: 'The techniques that separate a good candidate from a strong one. Slower to learn, high payoff.',
  },
  {
    name: 'Elite',
    blurb: 'Rare in a screen, decisive in a hard round or a contest. Learn to recognise them first, implement second.',
  },
]

export const topicsByTier = TIERS.map((tier) => ({
  ...tier,
  topics: topics.filter((t) => t.tier === tier.name),
}))

export const allProblems = topics.flatMap((t) =>
  (t.problems || []).map((p) => ({
    ...p,
    topicId: t.id,
    topicTitle: t.short || t.title,
  })),
)

export const allPatterns = topics.flatMap((t) =>
  (t.patterns || []).map((p) => ({
    ...p,
    topicId: t.id,
    topicTitle: t.short || t.title,
    tier: t.tier,
  })),
)

export const stats = {
  topics: topics.length,
  patterns: allPatterns.length,
  problems: allProblems.length,
  hours: topics.reduce((sum, t) => sum + (t.estHours || 0), 0),
  sections: topics.reduce((sum, t) => sum + (t.sections?.length || 0), 0),
}

export function neighbours(topicId) {
  const i = topics.findIndex((t) => t.id === topicId)
  return {
    prev: i > 0 ? topics[i - 1] : null,
    next: i >= 0 && i < topics.length - 1 ? topics[i + 1] : null,
  }
}

export const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 }
