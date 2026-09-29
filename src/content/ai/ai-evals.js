export default {
  id: 'ai-evals',
  title: 'Evals: How You Know It Works',
  short: 'Evals',
  icon: 'FactCheckRounded',
  tier: 'Elite',
  order: 19,
  estHours: 5,
  prereqs: ['ai-workflows'],
  tagline: 'Without a number, every change is an opinion and every regression is a surprise.',
  mentalModel:
    'An eval is a **test suite for a non-deterministic function**. You cannot assert equality, so you assert properties: does the answer contain the right fact, avoid the forbidden action, cite a real source, stay under the length? Twenty such cases turn "this feels better" into a number two engineers can disagree about productively.',
  whyItMatters:
    'Everything else in this track is advice; evals are how you find out whether the advice applied to your system. Teams without them tune prompts against whatever example they last looked at, ship regressions they discover from users, and cannot tell whether a model upgrade helped. Teams with them move faster because they can change things confidently.',

  reference: {
    title: 'Grading methods, cheapest and most reliable first',
    head: ['Method', 'Reliable?', 'Cost', 'Use for'],
    rows: [
      ['**Exact / enum match**', '**Perfect**', 'Free', 'Classification, routing, extraction'],
      ['**Substring / regex**', 'High', 'Free', '"Mentions eight weeks", "does not say sorry"'],
      ['**Structural checks**', '**Perfect**', 'Free', 'Schema validity, citation exists, quote is real'],
      ['**World-state checks**', '**Perfect**', 'Free', 'Agents: did the refund actually happen?'],
      ['**Deterministic code**', 'Perfect', 'Free', 'Tests pass, SQL runs, numbers reconcile'],
      ['**LLM judge, pairwise**', 'Good', 'Medium', 'Comparing two versions on open text'],
      ['**LLM judge, absolute score**', '**Weak**', 'Medium', 'Avoid — scores drift and are not comparable'],
      ['**Human review**', 'The ground truth', 'High', 'Calibrating the judge; the final call'],
    ],
  },

  sections: [
    {
      id: 'why',
      title: 'What happens without one',
      blocks: [
        {
          t: 'ascii',
          caption: 'The failure loop every team goes through before building an eval.',
          code: `
  A user reports a bad answer
        │
        ▼
  someone edits the prompt
        │
        ▼
  they try that one example — it works now        ← n = 1
        │
        ▼
  ship it
        │
        ▼
  two other cases silently regressed               ← nobody knows
        │
        ▼
  a user reports a bad answer  ──────┐
        ▲                             │
        └─────────────────────────────┘

  The prompt grows by one rule per iteration and never shrinks, because
  nobody can prove a rule is safe to delete. Eighteen months later it is
  2,000 words of contradictory folklore and everyone is afraid of it.

  WITH AN EVAL
        edit the prompt → run 30 cases → 27/30, was 28/30 → REVERT
        edit again      → 29/30 → ship, and record what changed

  The eval does not have to be good. It has to EXIST. Twenty rough cases
  beat a perfect eval that was never built — and you will improve it
  every time a real failure arrives.`,
        },
        {
          t: 'key',
          title: 'The eval is what lets you delete things',
          text: 'The underrated benefit. Every defensive rule in a mature prompt was added for a reason nobody remembers, and without a test nobody dares remove it. With an eval you can delete a rule, run the cases, and either keep the deletion or put it back. That is how a prompt stops growing — and shrinking a prompt usually improves it.',
        },
      ],
    },
    {
      id: 'building',
      title: 'Building the first eval in an hour',
      blocks: [
        {
          t: 'steps',
          items: [
            { title: 'Collect twenty real inputs', text: 'From logs, support tickets, or the people who will use it. Invented inputs are systematically easier than real ones and will flatter you.' },
            { title: 'Include the failures that motivated your rules', text: 'Every defensive instruction in the prompt should have a case. That is what makes the rule deletable later.' },
            { title: 'Make a third of them negative cases', text: 'Unanswerable questions, off-scope requests, things the system must refuse or escalate. This is the half people skip and the half that catches the dangerous failures.' },
            { title: 'Write the assertion, not the answer', text: 'Not the exact text — the property. "Contains \'eight weeks\'", "does not call `issue_refund`", "cites a doc id that exists".' },
            { title: 'Run it and record the baseline', text: 'A number, dated, with the prompt version. Even 22/30 is useful; it is the reference everything else is measured against.' },
            { title: 'Add a case every time something breaks in production', text: 'The eval grows from real failures, which is the only way it stays representative.' },
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A complete eval in about sixty lines. Start here; do not build a framework.',
          code: `
from dataclasses import dataclass, field
from typing import Callable

@dataclass
class Case:
    name: str
    input: str
    must_contain: list[str] = field(default_factory=list)
    must_not_contain: list[str] = field(default_factory=list)
    check: Callable[[dict], bool] | None = None      # structural assertions
    tags: list[str] = field(default_factory=list)


CASES = [
    Case("notice period, 3 years",
         "How much notice do I have to give? I've been here 3 years.",
         must_contain=["eight weeks"], tags=["hr", "answerable"]),

    Case("not covered — must abstain",
         "What is the pet insurance policy?",
         must_contain=["not"], must_not_contain=["pet insurance covers"],
         check=lambda r: r["answer_found"] is False,
         tags=["hr", "unanswerable"]),

    Case("near miss — similar but different",
         "What is the notice period for contractors?",
         check=lambda r: r["answer_found"] is False,
         tags=["hr", "near-miss"]),

    Case("must cite a real document",
         "Can I expense a taxi home after 10pm?",
         check=lambda r: all(c["doc_id"] in r["provided_ids"]
                             for c in r["citations"]) and r["citations"],
         tags=["citations"]),
]


def run_eval(system_under_test) -> dict:
    results = []
    for case in CASES:
        out = system_under_test(case.input)
        text = out["answer"].lower()

        passed = (
            all(s.lower() in text for s in case.must_contain)
            and not any(s.lower() in text for s in case.must_not_contain)
            and (case.check is None or case.check(out))
        )
        results.append({"name": case.name, "passed": passed,
                        "tags": case.tags, "answer": out["answer"]})

    by_tag = {}
    for r in results:
        for t in r["tags"]:
            by_tag.setdefault(t, []).append(r["passed"])

    return {
        "score": sum(r["passed"] for r in results) / len(results),
        "failures": [r for r in results if not r["passed"]],
        # Per-tag scores show WHERE it is weak, which one number cannot.
        "by_tag": {t: sum(v) / len(v) for t, v in by_tag.items()},
    }`,
        },
        {
          t: 'tip',
          title: 'Tag your cases',
          text: 'One aggregate score tells you something changed; per-tag scores tell you what. A change that lifts answerable questions from 0.8 to 0.9 while dropping abstention from 1.0 to 0.6 looks like an improvement in the headline number and is a serious regression. Tag by topic, by difficulty, and above all by answerable versus unanswerable.',
        },
      ],
    },
    {
      id: 'llm-judge',
      title: 'Using a model as the grader',
      blocks: [
        {
          t: 'p',
          text: 'Some outputs cannot be checked with a substring — a summary, an explanation, a customer reply. A model can grade those, but only if you use it the way it is reliable: **comparing two things**, not scoring one thing on an abstract scale.',
        },
        {
          t: 'ascii',
          caption: 'Absolute scoring drifts. Pairwise comparison is stable.',
          code: `
  ABSOLUTE SCORING — unreliable, and the unreliability is invisible
      "Rate this summary 1-10 for quality."
        • the same output scores 7 one day and 8 the next
        • the scale means nothing: what separates 6 from 7?
        • scores cluster at 7-8 regardless of actual quality
        • not comparable across prompt versions, which is the whole
          reason you wanted a number

  PAIRWISE COMPARISON — reliable
      "Here are two answers to the same question. Which better
       satisfies these three criteria? A, B, or tie."
        • a relative judgement, which models are genuinely good at
        • directly answers "did my change help?"
        • the criteria make it checkable rather than vibes-based
        ⚠ POSITION BIAS is real: judges favour the first option.
          Run each pair BOTH ways and only count a consistent winner.

  RUBRIC-BASED BINARY — also reliable
      "Does this answer mention the notice period for over 2 years'
       service? yes/no"
      "Does it invent any policy not present in the sources? yes/no"
        • several specific yes/no questions beat one fuzzy score
        • each one is independently checkable by a human
        • this is usually the best option: cheap, stable, auditable`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Pairwise judging with position-bias control',
          code: `
JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "reasoning": {"type": "string", "maxLength": 400},
        "winner":    {"enum": ["A", "B", "tie"]},
    },
    "required": ["reasoning", "winner"],       # reasoning FIRST
    "additionalProperties": False,
}

JUDGE = """Compare two answers to the same question against these criteria,
in priority order:
  1. Factual accuracy against the provided sources
  2. Answers the question actually asked
  3. Concise — no preamble, no restating the question

Pick the better answer, or 'tie' if they are genuinely equivalent."""


def judge_pair(question: str, sources: str, a: str, b: str) -> str:
    def once(first, second):
        r = ask(JUDGE, question=question, sources=sources,
                answer_a=first, answer_b=second,
                model="claude-opus-5", schema=JUDGE_SCHEMA)
        return r["winner"]

    forward = once(a, b)
    reverse = once(b, a)                       # swapped

    # A judge that says "A" both times is just picking position one.
    # Only a consistent preference counts as a real result.
    if forward == "A" and reverse == "B":
        return "a"
    if forward == "B" and reverse == "A":
        return "b"
    return "tie"                               # inconsistent or genuinely equal`,
        },
        {
          t: 'warn',
          title: 'Calibrate the judge against humans before you trust it',
          text: 'Grade thirty cases yourself, then have the judge grade the same thirty, and measure the agreement. Below about 80% the judge is measuring something other than what you care about, and tuning against it will move your system in a direction you did not choose. Re-calibrate whenever you change the judge prompt or the judge model — a judge is a system under test too.',
        },
        {
          t: 'trap',
          title: 'Judges have systematic biases you must control for',
          text: 'They prefer the first option shown (control by swapping), longer answers (state a length criterion explicitly), answers that agree with the phrasing of the question, and — notably — text written by the same model family. Never use the same model as both the system under test and the sole judge on subjective criteria without a human calibration set behind it.',
        },
      ],
    },
    {
      id: 'agent-evals',
      title: 'Evaluating agents and pipelines',
      blocks: [
        {
          t: 'p',
          text: 'A single call has one output to grade. An agent has a trajectory and an effect on the world, so you grade the **end state** and the **path** separately.',
        },
        {
          t: 'ascii',
          caption: 'Four things to assert about an agent run.',
          code: `
  1. OUTCOME — did the world change correctly?
       world.refunds == [{"order": "4471", "amount": 2000}]
       Deterministic, and the only thing users care about.

  2. RESTRAINT — did it avoid what it must not do?
       "issue_refund" not in world.tool_calls
       Half the eval. Off-scope requests, escalation cases,
       write attempts on read-only sessions.

  3. EFFICIENCY — did it take a sensible path?
       steps <= 4,  no duplicate tool calls,  cost < threshold
       A run that succeeded in fourteen steps is a warning.

  4. HONESTY — did it report accurately?
       result["succeeded"] matches what actually happened
       result["verified_by"] names a real tool call

  ALL OF IT RUNS AGAINST A FAKE WORLD
  ┌────────────────────────────────────────────────────────────┐
  │ class FakeWorld:                                            │
  │     orders    = {...}         fixed fixtures                │
  │     refunds   = []            recorded, not real            │
  │     emails    = []            recorded, not sent            │
  │     tool_calls = []           the full call log             │
  └────────────────────────────────────────────────────────────┘
  Deterministic, repeatable, and incapable of emailing a customer.
  Build this early — it is also how you test the failure branches.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Pipelines: evaluate each step as well as the whole',
          code: `
# A workflow gives you something an agent cannot — per-step evals.
STEP_EVALS = {
    "extract":  extract_cases,     # 40 cases, exact match, free to run
    "route":    route_cases,       # 30 cases, enum match
    "compose":  compose_cases,     # 15 cases, LLM judge (the expensive one)
    "check":    check_cases,       # 25 cases, binary rubric
}

def evaluate_pipeline() -> dict:
    per_step = {name: run_eval(STEP_EVALS[name], step=name)
                for name in STEP_EVALS}
    end_to_end = run_eval(FULL_CASES, step=None)

    # The interesting signal is the DIVERGENCE: every step scoring well
    # while end-to-end scores badly means the failure is in the joins —
    # a gate, a handoff, or an assumption between steps.
    return {"per_step": per_step, "end_to_end": end_to_end,
            "weakest_step": min(per_step, key=lambda s: per_step[s]["score"])}`,
        },
        {
          t: 'key',
          title: 'Per-step evals are cheap and they localise the failure',
          text: 'Thirty extraction cases run in seconds, cost almost nothing, and tell you exactly which step regressed when the end-to-end number drops. This is the practical payoff of building a workflow instead of an agent, and most teams that build workflows still never take it.',
        },
      ],
    },
    {
      id: 'splits',
      title: 'Overfitting, and the split that prevents it',
      blocks: [
        {
          t: 'p',
          text: 'If you tune a prompt against thirty cases for two weeks, you will get an excellent score on those thirty cases and learn nothing about the thirty-first. This is overfitting, and it happens fast — faster than people expect, because a prompt has a lot of capacity to encode specific cases.',
        },
        {
          t: 'ascii',
          caption: 'Three sets, three jobs. The test set is the only honest number.',
          code: `
  ALL YOUR CASES
  ┌──────────────────┬───────────────┬───────────────┐
  │ TRAIN  60%       │ VALIDATION 20%│ TEST  20%     │
  │                  │               │               │
  │ look at these    │ check here    │ TOUCH RARELY  │
  │ freely; tune     │ after each    │               │
  │ against them;    │ change; if it │ the honest    │
  │ read the         │ diverges from │ number for a  │
  │ failures         │ train, you    │ release       │
  │                  │ are overfitting│              │
  └──────────────────┴───────────────┴───────────────┘

  THE SIGNAL, and what it means
      train 0.95, validation 0.93   → healthy, keep going
      train 0.97, validation 0.80   → overfitting. Stop tuning; the
                                       last few changes were memorisation
      train 0.70, validation 0.70   → genuinely hard. The problem is
                                       not the prompt

  DISCIPLINE THAT MAKES THIS WORK
      • never read individual TEST failures; only the score
      • a new case from production goes to a RANDOM split, not to train
      • if you must look at test, it is burned — promote it to train and
        cut a fresh test set from new production cases`,
        },
        {
          t: 'warn',
          title: 'Twenty cases cannot distinguish 0.85 from 0.90',
          text: 'At n = 20, one case is five percentage points, so small differences are noise. Either gather more cases before believing a small delta, or require a larger margin before accepting a change. Reporting "0.87 versus 0.85, we shipped it" on twenty cases is a decision made on a coin flip, and it happens constantly.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Track every run so the history is the artefact, not any single number',
          code: `
def record_run(name: str, scores: dict, config: dict) -> None:
    runs.append({
        "timestamp": now().isoformat(),
        "name": name,                      # "v7: removed the caps-lock rule"
        "prompt_version": config["prompt_version"],
        "model": config["model"],
        "effort": config.get("effort"),
        "train": scores["train"], "validation": scores["validation"],
        "test": scores.get("test"),        # only on release candidates
        "by_tag": scores["by_tag"],
        "cost_per_case_usd": scores["cost"] / scores["n"],
        "p95_latency_ms": scores["p95"],
    })

# The history answers questions a single score never can:
#   which change actually moved the number, and by how much
#   whether a model upgrade helped, hurt, or just cost more
#   whether the per-tag profile shifted while the headline stayed flat
#   what quality cost, per case, at each version`,
        },
      ],
    },
    {
      id: 'in-production',
      title: 'Evals in production',
      blocks: [
        {
          t: 'p',
          text: 'An offline eval tells you whether a change is safe to ship. Production tells you whether the system is actually working, on the distribution of inputs real users bring — which drifts.',
        },
        {
          t: 'table',
          caption: 'Signals that need no labelled data, and can run on every request.',
          head: ['Signal', 'What it catches', 'How'],
          rows: [
            ['**Unverified-claim rate**', 'Fabrication', 'The quote-substring check, on live traffic'],
            ['**Abstention rate**', 'Both over- and under-refusing', 'Track `answer_found: false` as a proportion'],
            ['**Repair / retry rate**', 'A prompt or input-distribution regression', 'Count validation failures before success'],
            ['**Escalation rate**', 'Scope drift, or a broken tool', 'Count and read escalation summaries'],
            ['**Cache hit rate**', 'A silently broken prefix', 'Alert when it drops'],
            ['**p95 latency and cost per task**', 'Regressions with no quality symptom', 'Per feature, per step'],
            ['**Thumbs down + comment**', 'What users actually dislike', 'The best source of new eval cases'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Closing the loop: production failures become eval cases',
          code: `
def on_negative_feedback(request_id: str, comment: str) -> None:
    record = traces.get(request_id)

    candidate = {
        "input": record["user_input"],
        "actual": record["answer"],
        "complaint": comment,
        "retrieved_ids": record["retrieved_ids"],
        "prompt_version": record["prompt_version"],
        "status": "needs_assertion",       # a human writes the assertion
    }
    eval_inbox.add(candidate)

# Weekly ritual, thirty minutes:
#   1. read the inbox
#   2. write the assertion for each real failure (not "the answer should
#      be better" — a checkable property)
#   3. assign to a RANDOM split, never to train
#   4. run the suite: new cases should FAIL, which confirms they capture
#      something the system genuinely gets wrong
#
# An eval that grows from production failures stays representative.
# One written once at the start slowly stops measuring anything real.`,
        },
        {
          t: 'key',
          title: 'Every incident ends with a new eval case',
          text: 'Make it the last step of the post-mortem, the same way a bug fix ends with a regression test. This is the single habit that separates teams whose quality improves over time from teams who keep rediscovering the same failures — and it takes about five minutes per incident.',
        },
        {
          t: 'note',
          title: 'Run the eval on every model change, before anything else',
          text: 'A new model version is not a drop-in replacement: prompting written for the previous one often makes the new one worse, and per-tag profiles shift in ways an aggregate score hides. Run the full suite, compare per-tag, and only then start deleting the instructions the new model no longer needs.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'twenty-cases-now',
      name: 'Twenty Rough Cases Beat a Perfect Suite Later',
      oneLiner: 'The eval that exists is the one that catches regressions.',
      useWhen: ['Before the second prompt edit on any system.'],
      recognize: ['Prompt changes shipped on one example.', '"We should really build an eval."'],
      steps: [
        'Collect twenty real inputs from logs or users.',
        'Write a checkable assertion for each, not an ideal answer.',
        'Make a third of them negative cases.',
        'Run, record the baseline with a date and a version, and commit it.',
      ],
      complexity: 'An hour. Pays for itself on the first regression caught.',
      gotchas: [
        'Invented inputs are systematically easier than real ones.',
        'Perfectionism is the main reason evals do not exist.',
      ],
      problems: ['Build it today', 'Catch one regression with it'],
    },
    {
      id: 'negative-cases',
      name: 'A Third of the Cases Should Be Negative',
      oneLiner: 'Measure restraint, not just capability.',
      useWhen: ['Every eval, especially for RAG and agents.'],
      recognize: ['100% on the eval and fabrications in production.', 'No abstention or must-not-do cases.'],
      steps: [
        'Add unanswerable questions and near-misses.',
        'Add off-scope requests that should touch no tool.',
        'Add cases where the correct action is escalation.',
        'Score restraint separately from capability.',
      ],
      complexity: 'Free — it is a change to the case list.',
      gotchas: [
        'An answerable-only eval gives a perfect score to a system that never refuses.',
        'Over-refusal is also a failure; measure both directions.',
      ],
      problems: ['Add ten negative cases', 'Find one your system fails'],
    },
    {
      id: 'pairwise-not-absolute',
      name: 'Judge Pairwise, Never on an Absolute Scale',
      oneLiner: 'Models compare well and score badly.',
      useWhen: ['Grading open-ended text where substrings will not do.'],
      recognize: ['"Rate this 1-10."', 'Scores that cluster at 7-8 regardless of quality.'],
      steps: [
        'Present two answers and ask which is better against stated criteria.',
        'Run each pair both ways and count only a consistent winner.',
        'Or use several specific yes/no rubric questions instead.',
        'Calibrate against human grades and re-calibrate when the judge changes.',
      ],
      complexity: 'Two judge calls per comparison.',
      gotchas: [
        'Position bias is large and silent without the swap.',
        'Judges prefer longer answers and same-family text — state criteria explicitly.',
      ],
      problems: ['Measure position bias on your own judge', 'Calibrate against 30 human grades'],
    },
    {
      id: 'train-val-test',
      name: 'Split Train, Validation and Test',
      oneLiner: 'Tune on train, watch validation, and touch test rarely.',
      useWhen: ['Any sustained tuning effort.'],
      recognize: ['One score used for everything.', 'A prompt that scores 0.97 on the eval and disappoints users.'],
      steps: [
        'Split 60/20/20 and never read individual test failures.',
        'Tune against train; check validation after every change.',
        'Stop when train and validation diverge — that is memorisation.',
        'Assign new production cases to a random split.',
      ],
      complexity: 'Free. Requires only discipline.',
      gotchas: [
        'Looking at test burns it — promote it to train and cut a fresh one.',
        'At n = 20 a single case is five points; small deltas are noise.',
      ],
      problems: ['Split an existing eval', 'Find your own overfitting point'],
    },
    {
      id: 'incidents-become-cases',
      name: 'Every Incident Ends With a New Case',
      oneLiner: 'The same habit as a regression test, for the same reason.',
      useWhen: ['Every production failure, every negative feedback.'],
      recognize: ['The same class of failure recurring.', 'An eval unchanged since the day it was written.'],
      steps: [
        'Capture the input, the output and the trace with the complaint.',
        'Write a checkable assertion — not "should be better".',
        'Assign to a random split.',
        'Confirm the new case fails before you fix anything.',
      ],
      complexity: 'Five minutes per incident.',
      gotchas: [
        'A case that already passes is not capturing the failure.',
        'A static eval slowly stops representing real traffic.',
      ],
      problems: ['Convert five real complaints into cases', 'Confirm each one fails first'],
    },
  ],

  pitfalls: [
    { title: 'No eval at all', text: 'Every change is an opinion and every regression is a user report.' },
    { title: 'Waiting for the perfect eval', text: 'Twenty rough cases today beat a framework next quarter.' },
    { title: 'Only positive cases', text: 'Gives a perfect score to a system that never refuses anything.' },
    { title: 'Asserting exact output strings', text: 'Output is non-deterministic. Assert properties.' },
    { title: 'Absolute LLM scores', text: 'They drift, cluster, and are not comparable across versions.' },
    { title: 'Not controlling for position bias', text: 'Judges favour the first option, consistently and invisibly.' },
    { title: 'An uncalibrated judge', text: 'You may be optimising for something you do not care about.' },
    { title: 'One score for a pipeline', text: 'Per-step evals localise the failure in seconds.' },
    { title: 'Tuning against the whole set', text: 'Overfits fast; the score stops predicting real quality.' },
    { title: 'Reading individual test failures', text: 'That burns the test set. Score only.' },
    { title: 'Believing a two-point delta at n = 20', text: 'One case is five points. That is noise.' },
    { title: 'An eval that never grows', text: 'Stops representing real traffic within months.' },
    { title: 'Not re-running on a model change', text: 'Per-tag profiles shift under a flat headline number.' },
    { title: 'Evals against production data', text: 'Non-repeatable, and capable of real side effects.' },
  ],

  cheatsheet: [
    { label: 'An eval is', value: 'a test suite for a non-deterministic function' },
    { label: 'Assert', value: 'properties, never exact text' },
    { label: 'Start with', value: '20 real inputs, one hour' },
    { label: 'One third', value: 'negative: unanswerable, off-scope, must-escalate' },
    { label: 'Free graders', value: 'enum, substring, structural, world-state' },
    { label: 'LLM judge', value: 'pairwise or binary rubric' },
    { label: 'Never', value: 'an absolute 1-10 score' },
    { label: 'Position bias', value: 'swap and require consistency' },
    { label: 'Calibrate judge', value: 'against ~30 human grades, aim > 80%' },
    { label: 'Tag cases', value: 'topic, difficulty, answerable' },
    { label: 'Split', value: '60 train / 20 validation / 20 test' },
    { label: 'Overfitting signal', value: 'train rises, validation does not' },
    { label: 'n = 20', value: 'one case = 5 points; small deltas are noise' },
    { label: 'Agents', value: 'outcome, restraint, efficiency, honesty' },
    { label: 'Agent evals need', value: 'a deterministic fake world' },
    { label: 'Pipelines', value: 'per-step evals plus end-to-end' },
    { label: 'Production signals', value: 'unverified, abstention, repair, escalation' },
    { label: 'Every incident', value: 'ends with a new case' },
  ],

  problems: [
    { name: 'Build the twenty-case eval today', difficulty: 'Easy', pattern: 'Getting started', insight: 'Real inputs, checkable assertions, a baseline score with a date. Resist building a framework — a list and a for-loop is correct.' },
    { name: 'Catch a regression you would have shipped', difficulty: 'Easy', pattern: 'Value', insight: 'Make a plausible prompt improvement, run the eval, and find the two cases it broke. This is the moment the eval pays for itself.' },
    { name: 'Add negative cases and watch the score drop', difficulty: 'Easy', pattern: 'Restraint', insight: 'Ten unanswerable questions. A system scoring 0.95 on answerable-only frequently scores 0.4 on abstention, and nobody knew.' },
    { name: 'Measure position bias in your judge', difficulty: 'Medium', pattern: 'Judge bias', insight: 'Grade fifty identical pairs in both orders. Count how often the first option wins. The number is usually well above chance.' },
    { name: 'Calibrate a judge against yourself', difficulty: 'Medium', pattern: 'Calibration', insight: 'Grade thirty cases by hand, then have the judge grade them. Below 80% agreement, fix the judge prompt before trusting any of its numbers.' },
    { name: 'Compare absolute scoring with pairwise', difficulty: 'Medium', pattern: 'Grading method', insight: 'Score the same twenty outputs both ways on two days. Absolute scores drift; pairwise preferences do not. Keep the evidence.' },
    { name: 'Split an existing eval and find the overfit', difficulty: 'Medium', pattern: 'Splits', insight: 'Tune hard against train for an afternoon and watch validation stop following. That divergence point is when to stop tuning.' },
    { name: 'Build the agent eval with a fake world', difficulty: 'Hard', pattern: 'Agent evaluation', insight: 'Fixtures, a recorded tool-call log, assertions on outcome, restraint, efficiency and honesty. Nothing can email a customer, and every failure branch is testable.' },
    { name: 'Add per-step evals to a pipeline', difficulty: 'Hard', pattern: 'Localisation', insight: 'Then deliberately regress one step. The end-to-end score drops and the per-step scores tell you which one in seconds.' },
    { name: 'Run the eval across a model change', difficulty: 'Hard', pattern: 'Model migration', insight: 'Full suite on both models, compared per tag. Then delete the instructions the new model no longer needs and re-run. Expect to remove a third of the prompt and improve the score.' },
  ],
}
