# Choosing a form

Decide the form before anything else, from the job the information does for the reader. Color comes last. Sources: the dataviz method (form heuristic) and the diagram-design guide ("would the reader learn more from this than from a paragraph?", density 4/10, at most about 9 nodes, at most 2 accents).

## Is it a picture at all?

| The information is | Send | Not |
|---|---|---|
| One number, maybe with its change | a `stats` tile, or just the sentence | a one-bar chart |
| Two to four headline numbers | a `stats` row | a grouped bar chart |
| A short list without state or order | text | a diagram of boxes |
| More than about 7 classes that all matter | a table (text block or the bars table view) | more colors |

## The job picks the block

| Job (what the reader must do) | Block | Notes |
|---|---|---|
| Decide something | `decisions` cards, first on the page | Each card: the question, what answering it unlocks, optional recommendation. At most 3. |
| See the state of many items | `board` | One column per state, each with glyph and word. Columns stack on a phone. |
| Follow an ordered chain where each step depends on the one before | `pipeline` | Vertical on a phone, numbered, a state per step, optional person stripe. |
| See a hierarchy with state (goal > area > item) | `map` | Groups contain chips; `weight` widens a chip when size is part of the story (treemap-like). |
| Compare amounts across categories | `bars` | Horizontal bars on one baseline, largest first. One series is one color. |
| See which one stands out | `bars` with `highlight` | Emphasis: one bar in the accent, the rest gray. Often the honest answer to "make it clearer". |
| Compare effort with need, plan with actual, this week with last | `bars` with `series` (2 or 3) | Paired bars on one axis. Never a second y-axis. |
| See what happened when | `timeline` | Dates on the start side, a dot per event, `now` marks today. |
| Rank options by two criteria (value and effort, gain and collision) | `quadrant` | Numbered dots plus a ranked list; fill only the recommended ones. |
| Understand why | `text`, folded | Reasoning supports the picture; it is never the main body. |

The dashboard rules this skill generalises: hierarchy plus state is a nested map; effort compared with need is paired bars per person on one baseline; an ordered chain is a pipeline colored by state; change over days is a timeline; decisions are cards on top; anything that needs reasoning is a short caption or folded text. When a new kind of information appears, choose its form by these jobs, not by habit.

## When no block fits: a hand-drawn diagram

Use the diagram-design guide (`diagram-design/GUIDE.md`, section 3) to pick the type, then its `references/type-*.md` for layout. The types that read well on a phone, by job:

| Showing | Type |
|---|---|
| Components and how they connect | architecture (keep to one column of 3 to 6 boxes on a phone) |
| Decision logic with branches | flowchart |
| Messages between actors in order | sequence (at most 4 lifelines on a phone) |
| States and transitions | state machine |
| Who hands off to whom across a process | swimlane (lanes become rows on a phone) |
| Priorities on two axes | the `quadrant` block (draw by hand only past 9 items) |
| A reinforcing cycle | loop |
| Containment or scope | nested |
| Parent and children, reporting lines | tree, org chart |
| Conversion drop-off | pyramid / funnel |
| A total bridged by signed changes | waterfall |
| Trends over time, several series | line chart (2px lines, end labels) |
| A quantity splitting across stages | Sankey |
| Causes of one effect | fishbone |

Signed values (above or below a baseline) need a diverging chart; the `bars` block takes only values of zero or more, so draw it by hand or split into two blocks.

## Phone budget

- Width 360 to 480 CSS px; the builder caps the column at 480.
- At most about 9 nodes or steps per picture, 12 bars, 12 timeline events, 6 map groups with 24 chips, 4 stat tiles, 3 decision cards. The builder enforces these.
- One picture per idea. A long report is several blocks; the renderer splits it into several images, which Telegram shows as one album (at most 10 images).
- Labels short enough to fit: a bar label is about 3 words, a chip about 4.
