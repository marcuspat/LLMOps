import { VerificationRule, VerificationType } from '../../types/index.js';
import { BaseComponent } from '../../shared/base-classes.js';

// Import all rule classes
import {
  CodeStructureRule,
  TypeSafetyRule,
  PerformanceRule,
  MaintainabilityRule
} from './rules/CodeQualityRules.js';

import {
  CoverageRule,
  TestQualityRule,
  AssertionRule
} from './rules/TestCoverageRules.js';

import {
  VulnerabilityRule,
  InputValidationRule,
  AuthenticationRule
} from './rules/SecurityRules.js';

import {
  EfficiencyRule,
  ResourceUsageRule,
  ScalabilityRule
} from './rules/PerformanceRules.js';

import {
  CompletenessRule,
  ClarityRule,
  ConsistencyRule
} from './rules/DocumentationRules.js';

export class VerificationRuleRegistry extends BaseComponent {
  private rules: Map<VerificationType, VerificationRule[]> = new Map();

  constructor() {
    super();
    this.initializeRules();
  }

  private initializeRules(): void {
    // Code Quality Rules
    this.rules.set(VerificationType.CODE_QUALITY, [
      new CodeStructureRule(),
      new TypeSafetyRule(),
      new PerformanceRule(),
      new MaintainabilityRule()
    ]);

    // Test Coverage Rules
    this.rules.set(VerificationType.TEST_COVERAGE, [
      new CoverageRule(),
      new TestQualityRule(),
      new AssertionRule()
    ]);

    // Security Rules
    this.rules.set(VerificationType.SECURITY, [
      new VulnerabilityRule(),
      new InputValidationRule(),
      new AuthenticationRule()
    ]);

    // Performance Rules
    this.rules.set(VerificationType.PERFORMANCE, [
      new EfficiencyRule(),
      new ResourceUsageRule(),
      new ScalabilityRule()
    ]);

    // Documentation Rules
    this.rules.set(VerificationType.DOCUMENTATION, [
      new CompletenessRule(),
      new ClarityRule(),
      new ConsistencyRule()
    ]);
  }

  public getRules(type: VerificationType): VerificationRule[] {
    return this.rules.get(type) || [];
  }

  public addRule(type: VerificationType, rule: VerificationRule): void {
    if (!this.rules.has(type)) {
      this.rules.set(type, []);
    }
    this.rules.get(type)!.push(rule);
  }

  public removeRule(type: VerificationType, ruleName: string): boolean {
    const rules = this.rules.get(type);
    if (!rules) return false;

    const index = rules.findIndex(rule => (rule as any).name === ruleName);
    if (index === -1) return false;

    rules.splice(index, 1);
    return true;
  }

  public getAllRuleTypes(): VerificationType[] {
    return Array.from(this.rules.keys());
  }

  public getRuleCount(type: VerificationType): number {
    return this.rules.get(type)?.length || 0;
  }

  public getTotalRuleCount(): number {
    let total = 0;
    for (const rules of this.rules.values()) {
      total += rules.length;
    }
    return total;
  }
}