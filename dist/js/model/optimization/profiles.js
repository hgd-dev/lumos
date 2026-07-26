export const SOLUTION_PROFILES = {
  balanced: {
    label: "Balanced",
    shortLabel: "Balanced",
    description: "Balances scientific information, exposure, equity, reliability, redundancy, and cost.",
    multipliers: {}
  },
  information: {
    label: "Maximum information",
    shortLabel: "Information",
    description: "Prioritizes total posterior epistemic-uncertainty reduction and broad field reconstruction.",
    multipliers: {
      information: 1.65,
      risk: 1.10,
      exposure: 0.72,
      equity: 0.60,
      community: 0.55,
      ecology: 0.72,
      fairness: 0.45,
      cost: 0.72
    }
  },
  exposure: {
    label: "Exposure protection",
    shortLabel: "Exposure",
    description: "Prioritizes information where environmental risk and human presence overlap.",
    multipliers: {
      information: 0.82,
      risk: 1.28,
      exposure: 1.70,
      equity: 1.18,
      community: 1.08,
      ecology: 0.55,
      fairness: 0.92,
      cost: 0.78
    }
  },
  equity: {
    label: "Equity first",
    shortLabel: "Equity",
    description: "Prioritizes worst-served groups, vulnerability-weighted information, and parity in remaining uncertainty.",
    multipliers: {
      information: 0.72,
      risk: 0.92,
      exposure: 1.16,
      equity: 1.85,
      community: 1.35,
      ecology: 0.65,
      fairness: 2.35,
      reliability: 1.10,
      cost: 0.70
    }
  },
  efficient: {
    label: "Cost efficient",
    shortLabel: "Efficient",
    description: "Preserves useful information while strongly preferring lower-cost and less redundant networks.",
    multipliers: {
      information: 0.92,
      risk: 0.88,
      exposure: 0.82,
      equity: 0.72,
      community: 0.70,
      ecology: 0.72,
      reliability: 1.12,
      redundancy: 1.45,
      fairness: 0.82,
      cost: 2.40
    }
  }
};

export function profileWeights(baseWeights, profileKey) {
  const profile = SOLUTION_PROFILES[profileKey] ?? SOLUTION_PROFILES.balanced;
  const weights = {};
  for (const [key, value] of Object.entries(baseWeights)) {
    weights[key] = value * (profile.multipliers[key] ?? 1);
  }
  return weights;
}
