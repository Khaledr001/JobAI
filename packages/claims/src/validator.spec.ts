import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadAdversarialFixtures, type AdversarialFixture } from "./fixtures.js";
import { PASS_NAMES, type PassName, type ValidateOptions } from "./types.js";
import { validate } from "./validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "adversarial");
const fixtures = loadAdversarialFixtures(FIXTURES_DIR);

/**
 * `ValidateOptions.jobDescription` is `string | undefined` under
 * `exactOptionalPropertyTypes` -- "absent" and "present but undefined" are
 * different things, and a fixture's nullable JSON field is naturally the
 * latter unless built up conditionally like this.
 */
function optionsFor(
  fixture: AdversarialFixture,
  disabledPasses?: readonly PassName[],
): ValidateOptions {
  const options: ValidateOptions = {};
  if (fixture.jobDescription !== null) options.jobDescription = fixture.jobDescription;
  if (disabledPasses) options.disabledPasses = disabledPasses;
  return options;
}

describe("validate() against the adversarial fixture corpus", () => {
  it("has at least one fixture per pass, plus the honest one", () => {
    const coveredPasses = new Set(fixtures.map((f) => f.pass).filter((p) => p !== null));
    for (const pass of PASS_NAMES) {
      expect(coveredPasses.has(pass), `no fixture targets pass "${pass}"`).toBe(true);
    }
    expect(fixtures.some((f) => f.expectedCode === null)).toBe(true);
  });

  for (const fixture of fixtures) {
    it(`${fixture.name}: ${fixture.description}`, () => {
      const result = validate(fixture.spans, fixture.claims, optionsFor(fixture));

      if (fixture.expectedCode === null) {
        expect(result.ok, JSON.stringify(!result.ok ? result.violations : null)).toBe(
          true,
        );
        return;
      }

      expect(result.ok).toBe(false);
      if (result.ok) return; // narrows the type for the assertion below; unreachable given the check above
      const codes = result.violations.map((v) => v.code);
      expect(codes, `violations: ${JSON.stringify(result.violations)}`).toContain(
        fixture.expectedCode,
      );
    });
  }
});

describe("mutation harness: verify-validator-mutations.mjs's underlying property", () => {
  for (const pass of PASS_NAMES) {
    it(`disabling "${pass}" flips at least one fixture from rejected to accepted`, () => {
      const targeting = fixtures.filter((f) => f.pass === pass);
      expect(
        targeting.length,
        `no fixture targets pass "${pass}" -- it can never be proven load-bearing`,
      ).toBeGreaterThan(0);

      const flipped = targeting.some((fixture) => {
        const withPass = validate(fixture.spans, fixture.claims, optionsFor(fixture));
        const withoutPass = validate(
          fixture.spans,
          fixture.claims,
          optionsFor(fixture, [pass]),
        );
        return withPass.ok === false && withoutPass.ok === true;
      });

      expect(
        flipped,
        `disabling "${pass}" left every targeting fixture rejected -- another pass shadows it, or the fixture also trips something else`,
      ).toBe(true);
    });
  }
});
