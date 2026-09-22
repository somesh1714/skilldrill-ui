export default {
  id: 'objects-equality',
  title: 'Objects, equals, hashCode & Immutability',
  short: 'Objects & Equality',
  icon: 'DataObjectRounded',
  tier: 'Foundations',
  order: 2,
  estHours: 6,
  prereqs: ['jvm-memory'],
  tagline: 'Get equality wrong and your data silently disappears inside a HashMap.',
  mentalModel:
    '`==` asks "are these the same object?". `equals` asks "do these mean the same thing?". `hashCode` is the label used to file the object in a bucket. If two things are equal but filed under different labels, one of them is lost.',
  whyItMatters:
    'This is the most common source of quiet, hard-to-trace bugs in Java — an entity added to a `Set` that suddenly appears twice, a `Map` lookup that returns null for a key you can see is there. It is also the fastest way for an interviewer to tell whether you have actually debugged Java or only written it.',

  reference: {
    title: 'The rules you must not break',
    head: ['Rule', 'What it means', 'What breaks if you ignore it'],
    rows: [
      ['**Equal ⇒ same hash**', 'If `a.equals(b)` then `a.hashCode() == b.hashCode()`', 'Hash lookups miss; duplicates appear in Sets'],
      ['Same hash ⇏ equal', 'Different objects may share a hash (a collision)', 'Nothing — collisions are normal and handled'],
      ['Reflexive', '`a.equals(a)` is true', 'Collections behave unpredictably'],
      ['Symmetric', '`a.equals(b)` ⇔ `b.equals(a)`', '`contains` gives different answers depending on order'],
      ['Transitive', '`a=b` and `b=c` ⇒ `a=c`', 'Set membership becomes incoherent'],
      ['Consistent', 'Repeated calls give the same answer (if nothing changed)', 'Objects vanish from maps after mutation'],
      ['`a.equals(null)` is false', 'Never throw on null', '`NullPointerException` from inside collections'],
    ],
  },

  sections: [
    {
      id: 'identity-vs-equality',
      title: '== versus equals',
      blocks: [
        { t: 'p', text: '`==` compares the arrows. For objects it is true only when both variables point at the *same* object in the heap. `equals` is a method you get to define, so it can compare contents.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The classic demonstration — and the reason it confuses people',
          code: `
String a = "hello";
String b = "hello";
System.out.println(a == b);        // true  — both point at the SAME pooled literal

String c = new String("hello");
System.out.println(a == c);        // false — new String() forces a separate object
System.out.println(a.equals(c));   // true  — same characters

Integer x = 127, y = 127;
System.out.println(x == y);        // true  — small Integers are cached (-128..127)

Integer p = 128, q = 128;
System.out.println(p == q);        // false — outside the cache, separate objects!
System.out.println(p.equals(q));   // true`,
        },
        {
          t: 'trap',
          title: 'The Integer cache is a real production bug',
          text: 'Comparing boxed numbers with `==` works in your tests (small values) and fails in production (large ones). Never use `==` on `Integer`, `Long` or `String`. Use `equals`, or unbox deliberately with `intValue()`.',
        },
        {
          t: 'tip',
          title: 'Null-safe comparison',
          text: 'Use `Objects.equals(a, b)` when either side might be null — it handles both nulls being equal and avoids the NPE. And `Objects.hash(...)` builds a hash from several fields in one line.',
        },
      ],
    },
    {
      id: 'contract',
      title: 'Why hashCode exists at all',
      blocks: [
        { t: 'p', text: 'A `HashMap` does not scan its contents looking for your key — that would be linear. It computes `hashCode()`, uses it to pick a bucket, and only then compares with `equals` inside that small bucket. So **`hashCode` decides where to look, and `equals` decides what matched.**' },
        {
          t: 'ascii',
          caption: 'Override equals but not hashCode, and you look in the wrong bucket forever.',
          code: `
  map.put(new User(1, "Somesh"), "value")
        │
        ├── hashCode() = 4821  ──▶ bucket 5 ──▶ [ User(1,"Somesh") -> "value" ]
        │
  map.get(new User(1, "Somesh"))          <- equal by equals(), but...
        │
        └── hashCode() = 9137  ──▶ bucket 1 ──▶ [ empty ]  ──▶ returns null

  Two objects that are equal MUST produce the same hash, or the map
  never even looks in the right place.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The bug, in ten lines',
          code: `
class User {
    final int id; final String name;
    User(int id, String name) { this.id = id; this.name = name; }

    @Override public boolean equals(Object o) {          // equals overridden...
        if (this == o) return true;
        if (!(o instanceof User other)) return false;
        return id == other.id && Objects.equals(name, other.name);
    }
    // ...and hashCode FORGOTTEN — inherits Object's identity hash
}

Set<User> set = new HashSet<>();
set.add(new User(1, "Somesh"));
set.add(new User(1, "Somesh"));
System.out.println(set.size());      // 2  — they are "equal" but filed separately`,
        },
        {
          t: 'key',
          title: 'The rule in one sentence',
          text: '**Always override `equals` and `hashCode` together, from the same fields.** If you only ever remember one thing from this chapter, remember this. Your IDE will generate both correctly — use it.',
        },
      ],
    },
    {
      id: 'writing-them',
      title: 'Writing them correctly',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The modern form, using a pattern-matching instanceof',
          code: `
public final class User {
    private final long id;
    private final String email;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;                       // fast path
        if (!(o instanceof User other)) return false;     // handles null too
        return id == other.id && Objects.equals(email, other.email);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, email);                   // SAME fields as equals
    }

    @Override
    public String toString() {                            // always worth having
        return "User[id=" + id + ", email=" + email + "]";
    }
}`,
        },
        {
          t: 'note',
          title: 'Why `instanceof` beats `getClass()`',
          text: '`o instanceof User` accepts subclasses; `getClass() != o.getClass()` rejects them. `getClass` is stricter and keeps symmetry safe under inheritance, but it breaks with proxied classes — and Hibernate and Spring both hand you proxies. For entities, `instanceof` is the safer default.',
        },
        { t: 'h', text: 'Records: equality for free' },
        { t: 'p', text: 'Since Java 16, a `record` generates a constructor, accessors, `equals`, `hashCode` and `toString` from its components — all correct, all consistent. For any immutable data carrier, this should be your default.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'A record replaces forty lines of boilerplate',
          code: `
public record User(long id, String email) { }

// equals and hashCode already use both components:
new User(1, "a@b.com").equals(new User(1, "a@b.com"));   // true

// You can still validate in a compact constructor:
public record Money(BigDecimal amount, String currency) {
    public Money {
        if (amount.signum() < 0) throw new IllegalArgumentException("negative");
        currency = currency.toUpperCase();      // normalise before assignment
    }
}`,
        },
        {
          t: 'warn',
          title: 'Records are shallowly immutable',
          text: 'A `record Team(String name, List<User> members)` still lets a caller mutate the list you handed in. If the component is mutable, copy it in the compact constructor (`members = List.copyOf(members)`) and you get real immutability.',
        },
      ],
    },
    {
      id: 'mutability',
      title: 'Mutable keys: the bug that hides for months',
      blocks: [
        { t: 'p', text: 'If you put an object in a `HashMap` and then change a field that `hashCode` uses, the object is now filed under the wrong label. It is still in the map, still reachable, and completely unfindable.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The object is in the set — and the set says it is not',
          code: `
class Tag {
    String name;
    Tag(String name) { this.name = name; }
    @Override public boolean equals(Object o) {
        return o instanceof Tag t && Objects.equals(name, t.name);
    }
    @Override public int hashCode() { return Objects.hash(name); }
}

Set<Tag> tags = new HashSet<>();
Tag t = new Tag("java");
tags.add(t);

t.name = "spring";                 // mutated AFTER being filed

System.out.println(tags.contains(t));   // false — wrong bucket now
System.out.println(tags.size());        // 1    — it is still in there
for (Tag x : tags) System.out.println(x.name);   // "spring" — you can see it!`,
        },
        {
          t: 'key',
          title: 'Make keys immutable and the whole class of bug disappears',
          text: 'Use `final` fields, no setters, and a `record` where you can. That is the real reason immutability matters in day-to-day Java — not purity, but the fact that an immutable object is always findable, always thread-safe, and always safe to cache.',
        },
        {
          t: 'h',
          text: 'How to build an immutable class',
        },
        {
          t: 'ol',
          items: [
            'Make the class `final` so nobody can subclass and add mutability.',
            'Make every field `private final`.',
            'Set everything in the constructor; provide no setters.',
            '**Defensively copy** any mutable field on the way in *and* on the way out.',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Defensive copying is the step people forget',
          code: `
public final class Team {
    private final String name;
    private final List<String> members;

    public Team(String name, List<String> members) {
        this.name = name;
        this.members = List.copyOf(members);     // copy IN — caller cannot mutate ours
    }

    public List<String> getMembers() {
        return members;                          // already unmodifiable, safe to share
        // If it were an ArrayList you would need:
        // return Collections.unmodifiableList(members);
    }
}`,
        },
      ],
    },
    {
      id: 'comparable',
      title: 'Ordering: Comparable and Comparator',
      blocks: [
        { t: 'p', text: 'Equality says whether two things match. Ordering says which comes first. They are separate, and they should agree — a `TreeMap` uses ordering, not `equals`, to decide whether a key is already present.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Natural order lives on the class; alternative orders live outside it',
          code: `
// Comparable: "this type has one obvious order"
public record Version(int major, int minor) implements Comparable<Version> {
    @Override public int compareTo(Version o) {
        return major != o.major
             ? Integer.compare(major, o.major)
             : Integer.compare(minor, o.minor);
    }
}

// Comparator: any number of other orders, defined where they are needed
users.sort(Comparator.comparing(User::lastName)
                     .thenComparing(User::firstName)
                     .reversed());

users.sort(Comparator.comparing(User::joinDate,
                                Comparator.nullsLast(Comparator.naturalOrder())));`,
        },
        {
          t: 'trap',
          title: 'Never write `a.value - b.value`',
          text: 'It overflows for large or negative values and produces an inconsistent comparator. Java’s TimSort detects this and throws `IllegalArgumentException: Comparison method violates its general contract!` — usually only on big inputs, in production. Use `Integer.compare` or `Comparator.comparingInt`.',
        },
        {
          t: 'note',
          title: '"Consistent with equals"',
          text: 'A comparator is consistent with equals when `compareTo` returns 0 exactly when `equals` returns true. `TreeSet` uses only the comparator, so an inconsistent one makes two "unequal" objects collapse into one entry. `BigDecimal` is the famous example: `new BigDecimal("1.0").equals(new BigDecimal("1.00"))` is false, but `compareTo` returns 0.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'record-first',
      name: 'Reach for a Record First',
      oneLiner: 'If it carries data and does not need identity, make it a record.',
      useWhen: ['DTOs, API request/response bodies, value objects, map keys, events.'],
      recognize: ['A class that is only fields, a constructor, getters, equals and hashCode.'],
      steps: [
        'Declare the components in the header.',
        'Add validation and normalisation in a compact constructor.',
        'Copy any mutable component to make it genuinely immutable.',
      ],
      template: {
        lang: 'java',
        caption: 'A validated, genuinely immutable value object',
        code: `
public record Order(String id, List<Item> items, Instant placedAt) {
    public Order {
        Objects.requireNonNull(id, "id");
        items = List.copyOf(items);          // deep enough: the list cannot be swapped
    }

    public BigDecimal total() {              // behaviour is fine on records
        return items.stream()
                    .map(Item::price)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}`,
      },
      complexity: 'Removes ~40 lines per class and eliminates a whole bug category.',
      gotchas: [
        'Records are final and cannot extend a class — fine for data, wrong for entities with inheritance.',
        'JPA entities cannot be records: Hibernate needs a no-args constructor and mutable fields.',
        'Records are shallowly immutable — copy mutable components.',
      ],
      problems: ['Convert a DTO to a record', 'Make a record with a mutable list truly immutable'],
    },
    {
      id: 'equals-hashcode-together',
      name: 'Override equals and hashCode Together, From the Same Fields',
      oneLiner: 'The two methods are one decision, not two.',
      useWhen: ['Any class used as a map key, in a set, or compared by value.'],
      recognize: ['Duplicates appearing in a `Set`.', '`map.get(key)` returning null for a key you can see in the map.'],
      steps: [
        'Pick the fields that define identity — usually a business key, not every field.',
        'Use exactly those fields in both methods.',
        'Prefer a record, or let the IDE generate both.',
      ],
      complexity: 'O(1) per comparison; correctness is the point, not speed.',
      gotchas: [
        'Excluding a field from `hashCode` that `equals` uses is legal but slow; including one `equals` does not use is a bug.',
        'Do not use a mutable field in either method if the object will be a key.',
        'For JPA entities, base equality on a business key or the id — never on a lazily loaded association.',
      ],
      problems: ['Find the missing hashCode bug', 'Write equals/hashCode for a JPA entity'],
    },
    {
      id: 'immutable-by-default',
      name: 'Immutable by Default',
      oneLiner: 'Make everything final until something forces you to allow change.',
      useWhen: ['Value objects, configuration, anything shared between threads, anything cached.'],
      recognize: ['Setters that exist only because a framework once needed them.', 'Bugs where an object changes "by itself" — because something else held a reference.'],
      steps: [
        'Fields `private final`; no setters.',
        'Copy mutable inputs in the constructor and mutable outputs in the getters.',
        'Return a new instance for changes (`withX`) instead of mutating.',
      ],
      template: {
        lang: 'java',
        caption: 'A "wither" gives you change without mutation',
        code: `
public record Money(BigDecimal amount, String currency) {
    public Money plus(Money other) {
        if (!currency.equals(other.currency))
            throw new IllegalArgumentException("currency mismatch");
        return new Money(amount.add(other.amount), currency);   // new instance
    }
    public Money withCurrency(String c) { return new Money(amount, c); }
}`,
      },
      complexity: 'Allocates more objects; young-generation GC makes that nearly free.',
      gotchas: [
        'Immutability is not automatically thread-safe if you leak a reference during construction.',
        '`Collections.unmodifiableList` wraps the original — later changes to the backing list show through. `List.copyOf` actually copies.',
      ],
      problems: ['Build an immutable class with defensive copying', 'Show unmodifiableList leaking a mutation'],
    },
  ],

  pitfalls: [
    { title: 'Using == on Integer or String', text: 'Works for cached small values and short literals, fails everywhere else. Always `equals`.' },
    { title: 'Overriding equals without hashCode', text: 'Objects vanish from hash-based collections. The single most common Java bug of this kind.' },
    { title: 'Mutating an object after using it as a key', text: 'It stays in the map but can never be found again.' },
    { title: 'Using every field in equals for an entity', text: 'Two loads of the same database row should be equal. Base it on the id or a business key.' },
    { title: 'Subtraction in compareTo', text: 'Overflows and breaks the comparator contract.' },
    { title: 'Assuming a record is deeply immutable', text: 'A record holding an `ArrayList` is not immutable. Copy it.' },
    { title: 'Forgetting toString', text: 'Not a correctness bug, but it turns every log line and test failure into a useless `com.acme.User@4f3a2b1`.' },
  ],

  cheatsheet: [
    { label: '==', value: 'same object (reference)' },
    { label: 'equals', value: 'same value (you define it)' },
    { label: 'Golden rule', value: 'equal ⇒ same hashCode' },
    { label: 'Null-safe compare', value: 'Objects.equals(a, b)' },
    { label: 'Build a hash', value: 'Objects.hash(f1, f2)' },
    { label: 'Integer cache', value: '−128..127 — == lies outside it' },
    { label: 'Data carrier', value: 'use a record' },
    { label: 'Record immutability', value: 'shallow — copy mutable parts' },
    { label: 'Real copy', value: 'List.copyOf (not unmodifiableList)' },
    { label: 'Natural order', value: 'implement Comparable' },
    { label: 'Other orders', value: 'Comparator.comparing(...)' },
    { label: 'Never', value: 'a.x − b.x in a comparator' },
    { label: 'Map key must be', value: 'immutable' },
  ],

  problems: [
    { name: 'Break a HashSet with a missing hashCode', difficulty: 'Easy', pattern: 'Contract', insight: 'Override equals only, add two "equal" objects to a HashSet, and print the size. You get 2. Add hashCode and it becomes 1.' },
    { name: 'Catch the Integer cache', difficulty: 'Easy', pattern: 'Boxing', insight: 'Compare Integer 127 == 127 and 128 == 128. The first is true, the second false. Explain why in one sentence.' },
    { name: 'Convert a POJO to a record', difficulty: 'Easy', pattern: 'Records', insight: 'Take a 45-line DTO with getters, equals, hashCode and toString and reduce it to one line. Verify equality still behaves.' },
    { name: 'Lose an object inside a HashSet', difficulty: 'Medium', pattern: 'Mutable keys', insight: 'Add an object, mutate a field used by hashCode, then call contains(). It returns false while iteration still shows the object.' },
    { name: 'Make a record genuinely immutable', difficulty: 'Medium', pattern: 'Defensive copying', insight: 'Give a record a List component, mutate the caller’s list, and watch the record change. Fix it with List.copyOf in the compact constructor.' },
    { name: 'Show unmodifiableList leaking', difficulty: 'Medium', pattern: 'Defensive copying', insight: 'Wrap an ArrayList with Collections.unmodifiableList, then add to the original. The "unmodifiable" view changes. List.copyOf does not.' },
    { name: 'Break TimSort with a bad comparator', difficulty: 'Medium', pattern: 'Ordering', insight: 'Sort a large list of objects with a subtraction comparator and values near Integer.MAX_VALUE. Expect IllegalArgumentException about the general contract.' },
    { name: 'Write equals/hashCode for a JPA entity', difficulty: 'Hard', pattern: 'Entity identity', insight: 'Base it on a business key, not the generated id — the id is null before persist, so a pre-persist entity added to a Set becomes unfindable after save.' },
    { name: 'Demonstrate BigDecimal equals vs compareTo', difficulty: 'Medium', pattern: 'Consistent with equals', insight: 'new BigDecimal("1.0") equals "1.00" is false; compareTo returns 0. Put both in a HashSet and then a TreeSet and compare the sizes.' },
    { name: 'Make a class properly immutable', difficulty: 'Medium', pattern: 'Immutability', insight: 'final class, private final fields, copy on the way in and out. Then try to break it from a test and fail.' },
  ],
}
