import jvmMemory from './jvm-memory.js'
import objectsEquality from './objects-equality.js'
import collections from './collections.js'
import generics from './generics.js'
import exceptions from './exceptions.js'
import streamsOptional from './streams-optional.js'
import threadsExecutors from './threads-executors.js'
import synchronization from './synchronization.js'
import concurrentCollections from './concurrent-collections.js'
import completableFuture from './completable-future.js'
import virtualThreads from './virtual-threads.js'
import springIoc from './spring-ioc.js'
import springBootConfig from './spring-boot-config.js'
import restApis from './rest-apis.js'
import springDataJpa from './spring-data-jpa.js'
import transactions from './transactions.js'
import springSecurity from './spring-security.js'
import testing from './testing.js'
import caching from './caching.js'
import observability from './observability.js'
import resilience from './resilience.js'
import messaging from './messaging.js'
import performance from './performance.js'

export const topics = [
  jvmMemory, objectsEquality, collections, generics, exceptions, streamsOptional,
  threadsExecutors, synchronization, concurrentCollections, completableFuture,
  virtualThreads, springIoc, springBootConfig, restApis, springDataJpa,
  transactions, springSecurity, testing,
  caching, observability, resilience, messaging, performance,
]

export const tiers = [
  {
    name: 'Foundations',
    blurb: 'The language and the machine underneath it. Everything else assumes you are solid here.',
  },
  {
    name: 'Core',
    blurb: 'Concurrency and the Spring container — the daily working knowledge of a backend engineer.',
  },
  {
    name: 'Advanced',
    blurb: 'Building the actual service: web layer, persistence, transactions, security and tests.',
  },
  {
    name: 'Elite',
    blurb: 'What separates a service that runs from one that survives: caching, observability, resilience, messaging and tuning.',
  },
]
