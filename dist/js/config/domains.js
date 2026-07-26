export const DOMAINS = {
  core: {
    label: "Unified LUMOS architecture",
    status: "Shared engine + adapter audit",
    description: "A unified architecture view that audits the shared Bayesian, social, optimization, persistence, and export engine across four domain-specific scientific adapters while retaining a controlled synthetic benchmark.",
    kernel: "radial",
    kernelSigma: 0.105,
    gpLengthScale: 0.115,
    minSeparation: 0.055,
    weights: {
      information: 1.0,
      risk: 0.75,
      exposure: 0.95,
      equity: 0.85,
      community: 0.55,
      ecology: 0.35,
      reliability: 0.35,
      redundancy: 0.55,
      fairness: 0.75,
      cost: 0.20
    }
  },
  heat: {
    label: "Heat monitoring mode",
    status: "Nationwide workspace + NYC validation",
    description: "Builds a socially informed Heat monitoring scenario for any fitted U.S. map area using current weather, Census tract indicators, and public candidate-host proxies, while retaining New York City as the independently validated research case study.",
    kernel: "heat",
    kernelSigma: 0.09,
    gpLengthScale: 0.10,
    minSeparation: 0.05,
    weights: {
      information: 0.85,
      risk: 0.95,
      exposure: 1.0,
      equity: 1.0,
      community: 0.55,
      ecology: 0.45,
      reliability: 0.25,
      redundancy: 0.50,
      fairness: 0.95,
      cost: 0.18
    }
  },
  air: {
    label: "Air quality mode",
    status: "Directional field",
    description: "Uses an anisotropic wind-aligned influence kernel and emphasizes source gradients, mobility exposure, calibration quality, and socially disaggregated prediction uncertainty.",
    kernel: "air",
    kernelSigma: 0.08,
    gpLengthScale: 0.082,
    gpAlongScale: 2.35,
    gpAcrossScale: 0.56,
    transportAngle: Math.PI * 0.16,
    minSeparation: 0.045,
    weights: {
      information: 1.0,
      risk: 0.95,
      exposure: 1.0,
      equity: 0.9,
      community: 0.5,
      ecology: 0.25,
      reliability: 0.5,
      redundancy: 0.55,
      fairness: 0.85,
      cost: 0.22
    }
  },
  soil: {
    label: "Soil health mode",
    status: "Public survey + laboratory inference",
    description: "Uses short-range spatial similarity, survey priors, optional laboratory-sample conditioning, locked validation, contamination uncertainty, sensitive public sites, ecological value, and representative sampling.",
    kernel: "soil",
    kernelSigma: 0.055,
    gpLengthScale: 0.062,
    minSeparation: 0.035,
    weights: {
      information: 1.0,
      risk: 0.8,
      exposure: 0.65,
      equity: 0.8,
      community: 0.65,
      ecology: 0.9,
      reliability: 0.3,
      redundancy: 0.45,
      fairness: 0.7,
      cost: 0.2
    }
  },
  water: {
    label: "Water monitoring mode",
    status: "Public observation-informed flow inference",
    description: "Builds a nationwide Water screening and sampling workspace from recent USGS observations, mapped waterways and source proxies, social and ecological exposure, and an explicitly labeled flow-network approximation. Local watershed, utility, or pipe topology should replace the proxy when available.",
    kernel: "water",
    kernelSigma: 0.07,
    gpLengthScale: 0.078,
    gpAlongScale: 2.0,
    gpAcrossScale: 0.46,
    transportAngle: Math.PI * 0.3,
    minSeparation: 0.04,
    weights: {
      information: 1.0,
      risk: 0.95,
      exposure: 0.9,
      equity: 0.9,
      community: 0.45,
      ecology: 0.55,
      reliability: 0.55,
      redundancy: 0.5,
      fairness: 0.8,
      cost: 0.25
    }
  }
};

export const WEIGHT_LABELS = {
  information: "Epistemic information gain",
  risk: "Environmental risk detection",
  exposure: "Human exposure representation",
  equity: "Vulnerability-weighted information",
  community: "Community priority coverage",
  ecology: "Ecological representation",
  reliability: "Expected network reliability",
  redundancy: "Redundancy penalty",
  fairness: "Community information parity",
  cost: "Deployment cost penalty"
};
