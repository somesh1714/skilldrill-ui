import mqWhy from './mq-why.js'
import mqPrimitives from './mq-primitives.js'
import mqEda from './mq-eda.js'
import mqDelivery from './mq-delivery.js'
import mqBrokers from './mq-brokers.js'
import kafkaArchitecture from './kafka-architecture.js'
import kafkaProducer from './kafka-producer.js'
import kafkaConsumer from './kafka-consumer.js'
import kafkaStorage from './kafka-storage.js'
import kafkaExactlyOnce from './kafka-exactly-once.js'
import mqOutbox from './mq-outbox.js'
import mqSaga from './mq-saga.js'
import mqErrors from './mq-errors.js'
import mqSchema from './mq-schema.js'
import mqSpring from './mq-spring.js'
import kafkaStreams from './kafka-streams.js'
import mqCqrs from './mq-cqrs.js'
import kafkaOps from './kafka-ops.js'
import mqTesting from './mq-testing.js'

export const topics = [
  mqWhy, mqPrimitives, mqEda, mqDelivery, mqBrokers,
  kafkaArchitecture, kafkaProducer, kafkaConsumer, kafkaStorage, kafkaExactlyOnce,
  mqOutbox, mqSaga, mqErrors, mqSchema, mqSpring,
  kafkaStreams, mqCqrs, kafkaOps, mqTesting,
]

export const tiers = [
  {
    name: 'Foundations',
    blurb: 'What a message actually is, what a broker guarantees, and when asynchrony is the right trade.',
  },
  {
    name: 'Core',
    blurb: 'How Kafka works underneath — partitions, offsets, replication and the log. Everything later rests on this.',
  },
  {
    name: 'Advanced',
    blurb: 'The patterns that make event-driven systems correct: outbox, sagas, schema evolution and error handling.',
  },
  {
    name: 'Elite',
    blurb: 'Stream processing, event sourcing, and running a cluster that stays healthy under real load.',
  },
]
