# Glass Outlet Calculator Rollout

Working plan for building calculators across the rest of the Glass Outlet range.

## Current Starting Point

The live seed set already contains:

| Source | Current use |
|---|---|
| `qshs.json` | QuickScreen horizontal slat fence calculator |
| `vs.json` | VS vertical slat fence calculator |
| `xpl.json` | XPress Plus fence calculator |
| `bayg.json` | Buy As You Go fence calculator |
| `colorbond.json` | ColorBond steel fence calculator draft |
| `qs_gate.json` | Shared pedestrian gate calculator |
| `xpsg_gate.json` | XP sliding gate component catalogue used by QSG sliding gate selections |
| `price_catalogue.json` | Broad Glass Outlet catalogue/pricing import |
| `other.json` | Inactive placeholders for future calculators |

The imported price catalogue is broad, but only some ranges are calculator-ready. A catalogue row with a SKU and price is not the same thing as a calculator. Each calculator still needs rules, compatible options, warnings, diagrams where helpful, and test cases.

The QSG sliding gate branch extends the shared `QS_GATE` calculator with backend sliding-gate BOM rules. Treat it as the first branch-sized example for the rest of this rollout: one system family, one seed/rule change set, validation, then push.

## Imported Price-Catalogue Coverage

The current broad price catalogue includes rows from:

| Source file | Rows |
|---|---:|
| `Glass outlet Glass Pool Fence Pricing.csv` | 967 |
| `Glass outlet aluminium slats prices.csv` | 437 |
| `Glass Outlet Aluminium Pool Fence Prices.csv` | 274 |
| `Glass outlet screening, Nexia and accessories.csv` | 244 |
| `Glass outlet Zues, hamptons and pic pricing.csv` | 214 |
| `Glass Outlet colorbond and Supersleeper Pricelist.csv` | 149 |
| Unknown/legacy import source | 86 |

## Recommended Build Order

### 1. QSG / CTS Sliding Gates

Status:

- Branch started: `codex/qsg-sliding-gates-calculator`.
- `QS_GATE` now supports swing versus sliding rule branching.
- Sliding gate rules emit QSG sliding rails, side frames, infill/channel infill, screw covers, joiners, spacers, top caps, wheel/clamp hardware, XPSG track, guides, stops, catches, centre support rails for gates over 3000mm, and optional Filo automation.

Still needed:

- Run `npm run seed:products` against the target Supabase project after merge/review.
- Add spreadsheet comparison test cases for standard 2400mm, wide 3600mm, and automation-enabled sliding gates.
- Decide whether Hamptons/CTS sliding gate variants belong in `QS_GATE` as build options or in a separate gate product file.

### 2. Finish ColorBond and SuperSleeper

Why next:

- It is already partially built.
- It is a panel-based system, which proves the app can support more than slat calculators.
- The catalogue is smaller than glass pool fencing, so it is a good bridge into the wider range.

Needed:

- Finish ColorBond formula verification against catalogue tips/install instructions.
- Add SuperSleeper as either a compatible accessory/subsystem or a separate calculator, depending on how the source catalogue describes ordering.
- Add user-verified test scenarios for common bay lengths, heights, gates, sleepers, shark fins, and post choices.

### 3. Glass Pool Fencing

Why after panel-system verification:

- It has the largest imported row count and likely a high-value quoting workflow.
- It will need a different calculator style: panels, gates, spigots/posts, clamps, hinge/latch hardware, compliance warnings, and possible layout constraints.

Expected calculator families:

- Frameless glass pool fence.
- Semi-frameless glass pool fence if present in the source data.
- Glass pool gates.
- Hardware/accessory picker for spigots, hinges, latches, caps, and core-drill/base-plate choices.

### 4. Aluminium Pool Fencing

Why after glass pool fencing:

- It is likely closer to panel/gate counting than custom slat cutting.
- It can reuse some pool-fence UI concepts from glass pool fencing.

Expected calculator families:

- Aluminium pool fence panels.
- Aluminium pool gates.
- Posts, brackets, caps, hinges, latches, and compliance warnings.

### 5. Hamptons, Zeus, and PIC

Why after the pool-fence patterns:

- The imported source file groups them together.
- These probably need separate display systems but may share panel/gate/post logic.

Expected calculator families:

- Hamptons fencing.
- Zeus fencing/gates if catalogue data supports it.
- PIC panels/gates if catalogue data supports it.

### 6. Screening, Nexia, and Accessories

Why after the main fence/gate calculators:

- Some parts may be add-ons rather than standalone calculators.
- Good candidate for catalogue search, accessory suggestion, and compatibility mapping rather than a full geometry-first calculator.

### 7. Balustrade, Shower, General Glass, DrainLab, Exterior, Move Shutters

Why later:

- These are likely different quoting surfaces, not just variants of fence BOM logic.
- They may require new geometry models, compliance prompts, or non-fence workflows.

## Per-Calculator Definition Of Done

For each calculator family:

- Source catalogue/PDF read and summarized.
- Price source mapped to seed rows without invented SKUs or prices.
- Product options created: heights, widths, profiles, colours, mounting, hardware.
- BOM rules created in backend seed data where possible.
- Local fallback behavior added only where needed for development/offline guardrails.
- Validation/warnings added for catalogue limits and supplier verification notes.
- Component diagram mapping added when it helps installers understand BOM rows.
- Tests cover at least one standard job, one edge/limit job, and one invalid job.
- Browser smoke test confirms the calculator can generate a BOM.
- Readiness status recorded as draft/imported/calculator-ready/price-checked/spreadsheet-tested/approved.

## Intake Checklist For New Files

When new files arrive, record:

- Supplier and product family.
- Source file path.
- Date/version on the document, if visible.
- Whether it is catalogue, install guide, price list, or formulated workbook.
- Known SKUs/prices source.
- Known formulas or installation tips.
- Which calculator family it belongs to.
- Open questions for the user or supplier.

## Next Best Slice

After the QSG sliding gate branch, start the ColorBond/SuperSleeper verification branch, then the CTS equipment enclosure branch.

ColorBond is already in the UI and seed set, so finishing it will harden the panel-system pattern before starting the larger glass-pool workflow. Equipment enclosure is a good next non-fence calculator because the workbook has clear with-lid and without-lid calculation tabs.
