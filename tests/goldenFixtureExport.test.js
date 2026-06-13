import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { exportGoldenFixtures } from "../scripts/export-calculation-golden-fixtures.mjs";

test("exports calculation golden fixtures with input and expected payloads", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "sggu-golden-fixtures-"));

  try {
    const written = await exportGoldenFixtures({ outputDir });

    assert.deepEqual(
      written.map((file) => path.basename(file)).sort(),
      ["accessory-contribution.json", "accessory-efficiency.json", "accessory-recovery-estimate.json", "combat-power-analysis.json", "damage-model.json", "engraving-contribution.json", "main-stats.json", "spec-up-recommendation.json", "upgrade-efficiency.json"].sort()
    );

    const mainStats = JSON.parse(await readFile(path.join(outputDir, "main-stats.json"), "utf8"));
    assert.equal(mainStats.name, "main-stats");
    assert.ok(mainStats.input);
    assert.equal(mainStats.expected.MainStatTotal, 18345);
    assert.equal(mainStats.expected.Items.length, 2);

    const damageModel = JSON.parse(await readFile(path.join(outputDir, "damage-model.json"), "utf8"));
    assert.equal(damageModel.name, "damage-model");
    assert.ok(damageModel.input.criticalStats);
    assert.equal(damageModel.expected.criticalRateLimit.isActive, true);
    assert.equal(damageModel.expected.effectiveCriticalRatePercent, 80);
    assert.equal(damageModel.expected.convertedEvolutionDamagePercent, 5);

    const combatPower = JSON.parse(await readFile(path.join(outputDir, "combat-power-analysis.json"), "utf8"));
    assert.equal(combatPower.name, "combat-power-analysis");
    assert.equal(combatPower.scope, "partial-contract-seed");
    assert.equal(combatPower.expected.Status, "unavailable");
    assert.equal(combatPower.expected.OfficialCombatPower, 123456.78);
    assert.equal(combatPower.expected.OfficialCombatPowerFloor, 123456);
    assert.equal(combatPower.expected.ParadisePower.Value, 48275714);

    const upgrade = JSON.parse(await readFile(path.join(outputDir, "upgrade-efficiency.json"), "utf8"));
    assert.equal(upgrade.name, "upgrade-efficiency");
    assert.equal(upgrade.scope, "market-honing-and-avatar-seed");
    assert.equal(upgrade.expected.MarketDataStatus, "ready");
    assert.ok(upgrade.expected.Candidates.some((candidate) => candidate.Type === "weaponHoning"));
    assert.ok(upgrade.expected.Candidates.some((candidate) => candidate.Type === "armorHoning"));

    const specUp = JSON.parse(await readFile(path.join(outputDir, "spec-up-recommendation.json"), "utf8"));
    assert.equal(specUp.name, "spec-up-recommendation");
    assert.equal(specUp.expected.Status, "ready");
    assert.deepEqual(
      specUp.expected.TopCandidates.map((candidate) => candidate.Type),
      ["accessory", "armorHoning", "weaponHoning"]
    );

    const accessory = JSON.parse(await readFile(path.join(outputDir, "accessory-efficiency.json"), "utf8"));
    assert.equal(accessory.name, "accessory-efficiency");
    assert.equal(accessory.scope, "single-ring-replacement-seed");
    assert.equal(accessory.expected.Status, "ready");
    assert.equal(accessory.expected.TopRecommendation.Type, "accessory");
    assert.equal(accessory.expected.TopRecommendation.BuyPrice, 10000);

    const contribution = JSON.parse(await readFile(path.join(outputDir, "accessory-contribution.json"), "utf8"));
    assert.equal(contribution.name, "accessory-contribution");
    assert.equal(contribution.scope, "mixed-accessory-effects-seed");
    assert.ok(contribution.expected.TotalContributionPercent > 0);
    assert.equal(contribution.expected.CriticalContext.CritRatePercent, 41.6);

    const engraving = JSON.parse(await readFile(path.join(outputDir, "engraving-contribution.json"), "utf8"));
    assert.equal(engraving.name, "engraving-contribution");
    assert.equal(engraving.scope, "adrenaline-and-keen-blunt-seed");
    assert.ok(engraving.expected["아드레날린"].ContributionPercent > 0);
    assert.ok(engraving.expected["예리한 둔기"].ContributionPercent > 0);
    assert.equal(engraving.expected["원한"], undefined);

    const recovery = JSON.parse(await readFile(path.join(outputDir, "accessory-recovery-estimate.json"), "utf8"));
    assert.equal(recovery.name, "accessory-recovery-estimate");
    assert.equal(recovery.expected.Status, "ready");
    assert.equal(recovery.expected.EvidenceCount, 4);
    assert.equal(recovery.expected.EstimatedRecoveryGold, 95000);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
