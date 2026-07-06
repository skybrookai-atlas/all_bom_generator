# E2E Test Infra: Quotient & Canvas BOM Integration

## Test Philosophy
- Opaque-box, requirement-driven E2E tests validating the full integration flow.
- Structured into Tiers 1-4.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | DB Schema Verification | R1 | 5      | 5      | ✓      |
| 2 | Dashboard & Settings | R2 | 5      | 5      | ✓      |
| 3 | Quote Editor & Canvas Modal | R3 | 5      | 5      | ✓      |
| 4 | Client Portal & Xero integration | R4 | 5      | 5      | ✓      |

## Test Architecture
- Test Runner: Cypress E2E (`npm run test:e2e`)
- Test cases live in `cypress/e2e/quotient_integration.cy.js`
- Test structure includes mock logins, creating quotes, editing config, verifying BOM totals, interacting with client portal.

## Coverage Thresholds
- Tier 1: ≥5 per feature (happy path)
- Tier 2: ≥5 per feature (edge cases & validations)
- Tier 3: pairwise combinations of options, splits, and custom configurations
- Tier 4: ≥5 realistic E2E user application scenarios (e.g. quote creation -> split setup -> canvas edit -> client signing -> payment -> xero webhook)
