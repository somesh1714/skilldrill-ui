export default {
  id: 'generics',
  title: 'Generics & Type Erasure',
  short: 'Generics',
  icon: 'CategoryRounded',
  tier: 'Foundations',
  order: 4,
  estHours: 5,
  prereqs: ['collections'],
  tagline: 'Compile-time safety that the runtime knows nothing about — and every quirk follows from that.',
  mentalModel:
    'Generics are a message to the compiler, not to the JVM. The compiler checks your types, then **erases** them and inserts casts. Once you accept that the runtime sees plain `Object`, every strange rule about generics stops being strange.',
  whyItMatters:
    'Generics show up in every API you touch, and the moment you write a library, a utility method, or a Spring bean holding a collection, you need wildcards. "Why can I not add to a `List<? extends Number>`?" is asked in interviews precisely because the answer proves you understand variance.',

  reference: {
    title: 'The vocabulary',
    head: ['Syntax', 'Name', 'What it means'],
    rows: [
      ['`List<String>`', 'Parameterised type', 'A list that holds exactly Strings'],
      ['`<T>`', 'Type parameter', 'A placeholder you name; fixed per call'],
      ['`List<?>`', 'Unbounded wildcard', 'A list of *something*, but nobody knows what'],
      ['`List<? extends Number>`', 'Upper-bounded wildcard', '`Number` or any subtype — a **producer**, safe to read'],
      ['`List<? super Integer>`', 'Lower-bounded wildcard', '`Integer` or any supertype — a **consumer**, safe to write'],
      ['`<T extends Comparable<T>>`', 'Bounded type parameter', 'T must be comparable to itself'],
      ['`List` (no parameter)', 'Raw type', 'Legacy, unchecked, avoid'],
    ],
  },

  sections: [
    {
      id: 'why',
      title: 'What generics buy you',
      blocks: [
        { t: 'p', text: 'Before Java 5, every collection held `Object` and you cast on the way out. The cast could fail at runtime, in production, far from the mistake.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The problem generics solved',
          code: `
// Before generics — compiles fine, explodes at runtime
List names = new ArrayList();
names.add("Somesh");
names.add(42);                              // nobody complains
String s = (String) names.get(1);           // ClassCastException, at runtime

// With generics — the mistake is caught where it is made
List<String> safe = new ArrayList<>();
safe.add("Somesh");
safe.add(42);                               // compile error, immediately
String ok = safe.get(0);                    // no cast needed`,
        },
        {
          t: 'key',
          title: 'Generics move errors from runtime to compile time',
          text: 'That is the entire value proposition. Everything else — wildcards, bounds, erasure quirks — is machinery that exists to make that guarantee work without changing the JVM.',
        },
      ],
    },
    {
      id: 'erasure',
      title: 'Type erasure: what the runtime actually sees',
      blocks: [
        { t: 'p', text: 'After compilation, the type arguments are gone. `List<String>` and `List<Integer>` become the same class. The compiler inserts the casts for you and checks in advance that they will always succeed.' },
        {
          t: 'ascii',
          caption: 'What you write versus what the JVM runs.',
          code: `
  YOU WRITE                            THE JVM SEES
  ─────────────────────────────────    ─────────────────────────────────
  List<String> l = new ArrayList<>();  List l = new ArrayList();
  l.add("hi");                         l.add("hi");
  String s = l.get(0);                 String s = (String) l.get(0);

  <T> void f(T t)                      void f(Object t)
  <T extends Number> void g(T t)       void g(Number t)     ← erased to the bound`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Every generics oddity traced back to erasure',
          code: `
// 1. Both are the same class at runtime
new ArrayList<String>().getClass() == new ArrayList<Integer>().getClass();  // true

// 2. You cannot test the type argument
if (list instanceof List<String>) { }        // compile error
if (list instanceof List<?>)       { }       // allowed — no type info needed

// 3. You cannot create an array of a generic type
T[] arr = new T[10];                          // compile error
T[] arr2 = (T[]) new Object[10];              // the usual workaround, unchecked

// 4. You cannot overload on the type argument
void process(List<String> a) { }
void process(List<Integer> a) { }             // error: same erasure

// 5. Static fields are shared across all parameterisations
class Box<T> { static int count; }             // ONE count for every Box<...>`,
        },
        {
          t: 'trap',
          title: 'Heap pollution and the unchecked warning',
          text: 'Because the runtime cannot check type arguments, a raw-typed or unchecked cast can put the wrong thing into a collection — "heap pollution". The failure appears later, at an unrelated cast. That is why you should treat `unchecked` warnings as errors rather than sprinkling `@SuppressWarnings`.',
        },
        {
          t: 'note',
          title: 'Getting the type back when you need it',
          text: 'Erasure removes the type from *instances*, not from *class declarations*. Spring exploits this: a field declared `List<User>` keeps its signature in the class file, which is how Jackson and Spring can deserialize into the right type using `ParameterizedTypeReference` or Spring’s `ResolvableType`.',
        },
      ],
    },
    {
      id: 'generic-code',
      title: 'Writing generic methods and classes',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The type parameter goes before the return type',
          code: `
// A generic METHOD — <T> is declared on the method itself
public static <T> T firstOrDefault(List<T> list, T fallback) {
    return list.isEmpty() ? fallback : list.get(0);
}

// A bounded parameter — T must be comparable to itself
public static <T extends Comparable<T>> T max(List<T> list) {
    T best = list.get(0);
    for (T t : list) if (t.compareTo(best) > 0) best = t;
    return best;
}

// Multiple bounds — class first, then interfaces
public static <T extends Number & Comparable<T>> T clamp(T v, T lo, T hi) {
    return v.compareTo(lo) < 0 ? lo : v.compareTo(hi) > 0 ? hi : v;
}

// A generic CLASS
public final class Result<T> {
    private final T value;
    private final String error;

    private Result(T value, String error) { this.value = value; this.error = error; }

    public static <T> Result<T> ok(T value)    { return new Result<>(value, null); }
    public static <T> Result<T> fail(String e) { return new Result<>(null, e); }

    public <R> Result<R> map(Function<T, R> fn) {          // method-level <R>
        return error != null ? Result.fail(error) : Result.ok(fn.apply(value));
    }
}`,
        },
        {
          t: 'tip',
          title: 'Naming convention',
          text: '`T` for type, `E` for element, `K`/`V` for key and value, `R` for result, `N` for number. Single capital letters are the convention precisely so type parameters are visually distinct from class names.',
        },
      ],
    },
    {
      id: 'wildcards',
      title: 'Wildcards and the PECS rule',
      blocks: [
        { t: 'lead', text: 'This is the part people find hard, and it all comes from one fact: **`List<Dog>` is not a `List<Animal>`.**' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Why generics are invariant',
          code: `
List<Dog> dogs = new ArrayList<>();
List<Animal> animals = dogs;      // COMPILE ERROR — and thank goodness

// If that were allowed:
animals.add(new Cat());           // legal: a Cat IS an Animal
Dog d = dogs.get(0);              // ...but this is now a Cat. ClassCastException.

// Arrays ARE covariant, which is exactly this bug, shipped:
Animal[] arr = new Dog[3];        // compiles
arr[0] = new Cat();               // compiles, throws ArrayStoreException at runtime`,
        },
        {
          t: 'key',
          title: 'PECS: Producer Extends, Consumer Super',
          text: 'If the parameter **produces** values that you read out, use `? extends T`. If it **consumes** values that you write in, use `? super T`. If you do both, use plain `T` and accept the loss of flexibility.',
        },
        {
          t: 'ascii',
          caption: 'What each wildcard permits.',
          code: `
  List<? extends Number>  ← PRODUCER
      read:  Number n = list.get(0);     ✔ whatever it holds IS a Number
      write: list.add(1);                ✘ it might be a List<Double>

  List<? super Integer>   ← CONSUMER
      write: list.add(42);               ✔ Integer fits in any supertype list
      read:  Object o = list.get(0);     ✔ but only as Object

  List<Integer>           ← BOTH, no flexibility
      read and write freely, but accepts only List<Integer>`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'PECS in the JDK, and in your own code',
          code: `
// The JDK's own signature — copy is a textbook PECS method
public static <T> void copy(List<? super T> dest, List<? extends T> src)
//                                    ^ consumer            ^ producer

// Your version: accepts List<Integer>, List<Double>, List<Long>…
public static double sum(List<? extends Number> numbers) {
    double total = 0;
    for (Number n : numbers) total += n.doubleValue();   // reading only
    return total;
}

// Accepts List<Integer>, List<Number> or List<Object>
public static void fillWithZeros(List<? super Integer> sink, int count) {
    for (int i = 0; i < count; i++) sink.add(0);          // writing only
}

sum(List.of(1, 2, 3));            // List<Integer>  ✔
sum(List.of(1.5, 2.5));           // List<Double>   ✔`,
        },
        {
          t: 'warn',
          title: 'The one thing you can always add to a `? extends` list',
          text: '`null`. Nothing else, because the compiler cannot prove the element type. If you find yourself fighting this, your parameter is a consumer and you wanted `? super`.',
        },
      ],
    },
    {
      id: 'practice',
      title: 'Generics in day-to-day Spring code',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Where you will actually meet them',
          code: `
// Repositories are generic over entity and id type
public interface UserRepository extends JpaRepository<User, Long> { }

// Wrapping every response in a generic envelope
public record ApiResponse<T>(T data, String error, Instant at) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(data, null, Instant.now());
    }
}

@GetMapping("/users/{id}")
public ApiResponse<UserDto> get(@PathVariable Long id) {
    return ApiResponse.ok(service.find(id));
}

// Deserialising a generic type needs the type token, because of erasure
ResponseEntity<List<UserDto>> res = restTemplate.exchange(
        url, HttpMethod.GET, null,
        new ParameterizedTypeReference<List<UserDto>>() {});   // note the {}`,
        },
        {
          t: 'note',
          title: 'Why `new ParameterizedTypeReference<List<UserDto>>() {}` has braces',
          text: 'The trailing `{}` creates an anonymous subclass. A *subclass* records its generic superclass in the class file, so the type survives erasure and Spring can read it back. The same trick powers Jackson’s `TypeReference` and Guava’s `TypeToken`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Varargs plus generics: the warning you will see',
          code: `
@SafeVarargs                      // promises you do not store into the array
public static <T> List<T> listOf(T... items) {
    return new ArrayList<>(Arrays.asList(items));
}
// Without @SafeVarargs the compiler warns about "possible heap pollution",
// because a T[] is really an Object[] at runtime. Only add the annotation
// when the method truly just reads the varargs.`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'pecs',
      name: 'PECS — Producer Extends, Consumer Super',
      oneLiner: 'Widen a parameter with the wildcard that matches how you use it.',
      useWhen: ['Writing a method that takes a collection and only reads it, or only writes it.', 'A caller complains that `List<Dog>` will not fit a `List<Animal>` parameter.'],
      recognize: ['A utility method that works for one element type but should work for a family.'],
      steps: [
        'Ask: does this parameter give me values, or take them?',
        'Gives (produces) ⇒ `? extends T`. Takes (consumes) ⇒ `? super T`.',
        'Both ⇒ plain `T`.',
      ],
      template: {
        lang: 'java',
        caption: 'The rule applied to one signature',
        code: `
public static <T> void transfer(
        List<? extends T> source,     // produces T — we read from it
        List<? super T> target) {     // consumes T — we write into it
    for (T item : source) target.add(item);
}

// Now this works:
List<Integer> ints = List.of(1, 2, 3);
List<Number> nums  = new ArrayList<>();
transfer(ints, nums);`,
      },
      complexity: 'No runtime cost — erasure removes it all.',
      gotchas: [
        'You cannot add anything but `null` to a `? extends` collection.',
        'You can only read `Object` out of a `? super` collection.',
        'Do not use wildcards in return types — it pushes the awkwardness onto every caller.',
      ],
      problems: ['Make a sum() method accept any Number list', 'Write a PECS transfer method'],
    },
    {
      id: 'generic-wrapper',
      name: 'Generic Result / Envelope Type',
      oneLiner: 'One wrapper type, parameterised, instead of a wrapper per payload.',
      useWhen: ['API response envelopes, paged results, operation outcomes.'],
      recognize: ['`UserResponse`, `OrderResponse`, `ProductResponse` — identical except for one field.'],
      steps: ['Parameterise the payload.', 'Provide static factory methods so callers never write the type argument.', 'Add `map`/`flatMap` if you want to chain.'],
      template: {
        lang: 'java',
        caption: 'A paged envelope used across every endpoint',
        code: `
public record Page<T>(List<T> items, int page, int size, long total) {
    public <R> Page<R> map(Function<T, R> fn) {
        return new Page<>(items.stream().map(fn).toList(), page, size, total);
    }
}

Page<User>    entities = repository.findPage(page, size);
Page<UserDto> response = entities.map(UserDto::from);   // type-safe throughout`,
      },
      complexity: 'Zero runtime cost; removes one class per payload type.',
      gotchas: [
        'Jackson needs the concrete type to deserialise — use `ParameterizedTypeReference` on the client side.',
        'Do not over-parameterise. Two type parameters is usually the limit before readability suffers.',
      ],
      problems: ['Build a generic ApiResponse', 'Deserialize a generic type with ParameterizedTypeReference'],
    },
    {
      id: 'bounded-type',
      name: 'Bounded Type Parameter',
      oneLiner: 'Constrain T so you can actually call methods on it.',
      useWhen: ['The generic method needs to compare, add or otherwise use its values.'],
      recognize: ['Casting inside a generic method — a sign the bound is missing.'],
      steps: ['Write `<T extends Bound>`.', 'Add `& Interface` for extra requirements.', 'Use `<T extends Comparable<T>>` for self-comparison.'],
      complexity: 'Erased to the bound at runtime, so no cost.',
      gotchas: [
        'The class bound must come first if you have several.',
        'For inheritance-heavy hierarchies the correct bound is often `<T extends Comparable<? super T>>`, which also accepts a comparator defined on a supertype.',
      ],
      problems: ['Write a generic max()', 'Write a clamp() with two bounds'],
    },
  ],

  pitfalls: [
    { title: 'Using raw types', text: '`List list = new ArrayList()` disables all generic checking for that reference — including for unrelated calls. Never do it in new code.' },
    { title: 'Suppressing unchecked warnings reflexively', text: 'Each one is a place the compiler cannot protect you. Fix it or document precisely why it is safe.' },
    { title: 'Expecting instanceof to see type arguments', text: 'Erasure removed them. `instanceof List<String>` does not compile, and `instanceof List<?>` tells you nothing about the elements.' },
    { title: 'Creating generic arrays', text: '`new T[n]` is illegal. Use a `List<T>`, or cast an `Object[]` and confine it to one class.' },
    { title: 'Mixing arrays and generics', text: 'Arrays are covariant and reified; generics are invariant and erased. They do not compose well — prefer collections.' },
    { title: 'Wildcards in return types', text: 'Returning `List<? extends Foo>` forces every caller to deal with the wildcard. Return a concrete parameterised type.' },
    { title: 'Assuming static members are per-parameterisation', text: '`Box<String>` and `Box<Integer>` share one static field.' },
  ],

  cheatsheet: [
    { label: 'Runtime sees', value: 'erased types (Object or the bound)' },
    { label: 'Producer', value: '? extends T — read only' },
    { label: 'Consumer', value: '? super T — write only' },
    { label: 'Mnemonic', value: 'PECS' },
    { label: 'Generic method', value: '<T> before the return type' },
    { label: 'Bound', value: '<T extends Number & Comparable<T>>' },
    { label: 'Self-comparison', value: '<T extends Comparable<T>>' },
    { label: 'Add to ? extends', value: 'only null' },
    { label: 'Read from ? super', value: 'only Object' },
    { label: 'Generic array', value: 'illegal — use a List' },
    { label: 'Keep the type at runtime', value: 'ParameterizedTypeReference<…>() {}' },
    { label: 'Safe varargs', value: '@SafeVarargs (read-only methods)' },
    { label: 'Naming', value: 'T, E, K, V, R' },
  ],

  problems: [
    { name: 'Break a raw type on purpose', difficulty: 'Easy', pattern: 'Raw types', insight: 'Put an Integer into a raw List that is assigned to a List<String>. It compiles with a warning and throws ClassCastException on read — heap pollution in three lines.' },
    { name: 'Write a generic firstOrDefault', difficulty: 'Easy', pattern: 'Generic method', insight: 'Declare <T> before the return type. Confirm the caller never needs a cast.' },
    { name: 'Prove erasure with getClass()', difficulty: 'Easy', pattern: 'Erasure', insight: 'Compare ArrayList<String>.class with ArrayList<Integer>.class. They are identical — one class, two compile-time views.' },
    { name: 'Make sum() accept any Number list', difficulty: 'Medium', pattern: 'PECS producer', insight: 'Start with List<Number>, watch List<Integer> be rejected, then widen to ? extends Number.' },
    { name: 'Try to add to a ? extends list', difficulty: 'Medium', pattern: 'Variance', insight: 'The compiler refuses everything except null. Explain why in terms of what the list might actually be.' },
    { name: 'Write a PECS transfer method', difficulty: 'Medium', pattern: 'PECS', insight: 'Signature: transfer(List<? extends T> src, List<? super T> dst). Verify it accepts List<Integer> into List<Number>.' },
    { name: 'Build a generic Result type', difficulty: 'Medium', pattern: 'Generic wrapper', insight: 'ok/fail static factories plus a map that changes the payload type without unwrapping.' },
    { name: 'Hit the same-erasure overload error', difficulty: 'Medium', pattern: 'Erasure', insight: 'Declare process(List<String>) and process(List<Integer>) in one class. The compiler rejects both for having the same erasure.' },
    { name: 'Deserialize List<UserDto> from an API', difficulty: 'Hard', pattern: 'Type tokens', insight: 'Try it without ParameterizedTypeReference and you get LinkedHashMaps instead of DTOs. Add the anonymous subclass and the type survives.' },
    { name: 'Show array covariance failing', difficulty: 'Medium', pattern: 'Arrays vs generics', insight: 'Assign a Dog[] to an Animal[] and store a Cat. It compiles and throws ArrayStoreException — the bug generics were designed to prevent.' },
  ],
}
