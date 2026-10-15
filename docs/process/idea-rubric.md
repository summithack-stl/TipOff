# Idea scoring rubric

Use this in the first hour after kickoff. Score each candidate 1–5 on every row, write one line of evidence next to each score (a quote from a city leader, a dataset URL, a build step), and add the scores up. Unknown evidence scores 1.

## Criteria

| # | Criterion | 1 | 3 | 5 |
|---|---|---|---|---|
| 1 | **Real city pain** | We guessed at the problem. | It's a known St. Louis issue, but no leader named it. | A city leader named it at kickoff or in the challenge brief. |
| 2 | **Uses real STL data** | No dataset, or only made-up sample data. | Public data exists but needs heavy cleanup or a narrow slice. | A verified dataset from `research/stl-data.md` that we can load in under an hour. |
| 3 | **AI is essential** | A form or dashboard would do the same job. AI is decoration. | AI saves real effort but isn't the core. | The product doesn't work without the model (reading messy text, summarising, matching, explaining). |
| 4 | **Demo-able core in ~12 build hours** | Needs new infrastructure, logins, or many integrations. | One workflow, plus one risky extra piece. | One clear workflow on our starter (page + API route + `llm.ts`), working by Wednesday morning. |
| 5 | **Clear user** | "Everyone" or "the city". | A broad group, such as residents. | A specific person, e.g. "a CSB intake worker" or "a renter facing eviction". |
| 6 | **Measurable impact claim** | No number we could defend. | A plausible number with no source. | A number tied to the data, e.g. "cuts triage of 1,200 weekly 311 requests from X to Y minutes". |

**Total:** out of 30. Pick the highest total that survives the kill list. If two ideas are within 2 points, take the one with the higher score on row 4.

## Kill if

Drop the idea, whatever its total, if any of these is true:

- It scores 1 on row 3: the AI is decorative.
- It scores 1 on row 4: it can't be demoed in about 12 hours.
- It needs data we can't get by Wednesday morning, or data we can't legally use.
- It needs personal data about real residents (names, addresses tied to cases) to make the demo work.
- The live demo depends on something we don't control: a partner's API, a login, or a manual step behind the scenes.
- Nobody on the team can say who the user is in one sentence.
- It's a generic chatbot with a St. Louis logo on it.

## Scorecard

| Criterion | Idea A | Idea B | Idea C |
|---|---|---|---|
| 1 Real city pain | | | |
| 2 Uses real STL data | | | |
| 3 AI is essential | | | |
| 4 Demo-able in ~12h | | | |
| 5 Clear user | | | |
| 6 Measurable impact | | | |
| **Total /30** | | | |
| Killed? (which rule) | | | |
