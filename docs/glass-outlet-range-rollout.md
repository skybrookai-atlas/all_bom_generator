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
| `xpsg_gate.json` | XP sliding gate seed present |
| `price_catalogue.json` | Broad Glass Outlet catalogue/pricing import |
| `other.json` | Inactive placeholders for future calculators |

The imported price catalogue is broad, but only some ranges are calculator-ready. A catalogue row with a SKU and price is not the same thing as a calculator. Each calculator still needs rules, compatible options, warnings, diagrams where helpful, and test cases.

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

### 1. Finish ColorBond and SuperSleeper

Why first:

- It is already partially built.
- It is a panel-based system, which proves the app can support more than slat calculators.
- The catalogue is smaller than glass pool fencing, so it is a good bridge into the wider range.

Needed:

- Finish ColorBond formula verification against catalogue tips/install instructions.
- Add SuperSleeper as either a compatible accessory/subsystem or a separate calculator, depending on how the source catalogue describes ordering.
- Add user-verified test scenarios for common bay lengths, heights, gates, sleepers, shark fins, and post choices.

### 2. Glass Pool Fencing

Why second:

- It has the largest imported row count and likely a high-value quoting workflow.
- It will need a different calculator style: panels, gates, spigots/posts, clamps, hinge/latch hardware, compliance warnings, and possible layout constraints.

Expected calculator families:

- Frameless glass pool fence.
- Semi-frameless glass pool fence if present in the source data.
- Glass pool gates.
- Hardware/accessory picker for spigots, hinges, latches, caps, and core-drill/base-plate choices.

### 3. Aluminium Pool Fencing

Why third:

- It is likely closer to panel/gate counting than custom slat cutting.
- It can reuse some pool-fence UI concepts from glass pool fencing.

Expected calculator families:

- Aluminium pool fence panels.
- Aluminium pool gates.
- Posts, brackets, caps, hinges, latches, and compliance warnings.

### 4. Hamptons, Zeus, and PIC

Why fourth:

- The imported source file groups them together.
- These probably need separate display systems but may share panel/gate/post logic.

Expected calculator families:

- Hamptons fencing.
- Zeus fencing/gates if catalogue data supports it.
- PIC panels/gates if catalogue data supports it.

### 5. Screening, Nexia, and Accessories

Why fifth:

- Some parts may be add-ons rather than standalone calculators.
- Good candidate for catalogue search, accessory suggestion, and compatibility mapping rather than a full geometry-first calculator.

### 6. Balustrade, Shower, General Glass, DrainLab, Exterior, Move Shutters

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

Start with ColorBond/SuperSleeper completion, then Glass Pool Fencing.

ColorBond is already in the UI and seed set, so finishing it will harden the panel-system pattern before starting the larger glass-pool workflow.

