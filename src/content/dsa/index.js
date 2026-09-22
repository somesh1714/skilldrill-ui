import complexity from './complexity.js'
import arrays from './arrays.js'
import twoPointers from './two-pointers.js'
import binarySearch from './binary-search.js'
import hashing from './hashing.js'
import strings from './strings.js'
import sorting from './sorting.js'
import linkedList from './linked-list.js'
import stacksQueues from './stacks-queues.js'
import recursion from './recursion.js'
import trees from './trees.js'
import heaps from './heaps.js'
import graphs from './graphs.js'
import intervals from './intervals.js'
import greedy from './greedy.js'
import dp from './dp.js'
import tries from './tries.js'
import unionFind from './union-find.js'
import bitManipulation from './bit-manipulation.js'
import math from './math.js'
import advancedStructures from './advanced-structures.js'

export const topics = [
  complexity, arrays, twoPointers, binarySearch, hashing, strings, sorting,
  linkedList, stacksQueues, recursion, trees, heaps, graphs, intervals, greedy,
  dp, tries, unionFind, bitManipulation, math, advancedStructures,
]

export const tiers = [
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
