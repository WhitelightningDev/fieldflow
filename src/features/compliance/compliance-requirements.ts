import type { TradeId } from "@/features/company-signup/content/trades";

export type ComplianceDocRequirement = {
  kind: string;
  title: string;
  description: string;
  required: boolean;
};

const BASE_REQUIREMENTS: ComplianceDocRequirement[] = [
  {
    kind: "company-registration",
    title: "Company registration / proof of business",
    description: "Registration certificate, company documents, or equivalent proof of trading entity.",
    required: true,
  },
  {
    kind: "tax-clearance",
    title: "Tax clearance / VAT registration (if applicable)",
    description: "Tax clearance certificate or VAT registration confirmation where relevant.",
    required: true,
  },
  {
    kind: "public-liability",
    title: "Public liability insurance",
    description: "Policy schedule or certificate of insurance covering your operations.",
    required: true,
  },
  {
    kind: "id-authorised-rep",
    title: "Authorised representative ID",
    description: "ID/passport of the responsible representative for compliance purposes.",
    required: true,
  },
];

const TRADE_REQUIREMENTS: Record<TradeId, ComplianceDocRequirement[]> = {
  "electrical-contracting": [
    {
      kind: "electrical-registration",
      title: "Electrical contractor registration / accreditation",
      description: "Proof of registration/accreditation required for electrical work in your region.",
      required: true,
    },
    {
      kind: "coc-process",
      title: "COC process / quality checklist",
      description: "Your internal checklist/process showing how you ensure compliant Certificates of Compliance.",
      required: false,
    },
  ],
  plumbing: [
    {
      kind: "plumbing-registration",
      title: "Plumbing registration / association proof",
      description: "Proof of membership/registration required for plumbing work in your region (e.g. PIRB where applicable).",
      required: true,
    },
    {
      kind: "water-safety",
      title: "Water safety / hygiene policy",
      description: "Any policy/procedure used to ensure safe, compliant installations and repairs.",
      required: false,
    },
  ],
  "mobile-mechanics": [
    {
      kind: "trade-certification",
      title: "Trade certification / workshop accreditation",
      description: "Trade certificate(s) or accreditation relevant to your services.",
      required: true,
    },
    {
      kind: "roadworthiness-policy",
      title: "Roadworthiness / safety checks policy",
      description: "Your internal process for safety checks and customer handover.",
      required: false,
    },
  ],
  refrigeration: [
    {
      kind: "gas-handling",
      title: "Refrigerant handling / F-Gas (or equivalent) certification",
      description: "Proof of certification/authorisation for handling refrigerants where required.",
      required: true,
    },
    {
      kind: "disposal-policy",
      title: "Refrigerant disposal / environmental policy",
      description: "Process/policy for compliant recovery and disposal.",
      required: false,
    },
  ],
  "appliance-repair": [
    {
      kind: "repair-certification",
      title: "Repair technician certification / competency proof",
      description: "Proof of competency/certification relevant to appliance repair work.",
      required: true,
    },
    {
      kind: "warranty-policy",
      title: "Warranty / returns policy",
      description: "Policy/procedure for warranty jobs and customer communications.",
      required: false,
    },
  ],
};

export function getComplianceRequirements(industry: TradeId): ComplianceDocRequirement[] {
  return [...BASE_REQUIREMENTS, ...TRADE_REQUIREMENTS[industry]];
}

