export type CocCertificateType = "initial" | "supplementary";
export type CocDeclarationBasis = "9(2)(a)" | "9(2)(b)" | "9(2)(c)";
export type RegisteredPersonType = "ETSP" | "IE" | "MIE";

export type CocCertificateData = {
  form_version: "eir-2009-annexure-1";
  other_reference: string;
  installation: {
    physical_address: string;
    building_name: string;
    gps_coordinates: string;
    suburb_township: string;
    pole_number: string;
    district_town_city: string;
    erf_lot_no: string;
  };
  basis: CocDeclarationBasis;
  supplementary: {
    supplement_no: string;
    initial_certificate_no: string;
    initial_issued_on: string;
  };
  registered_person: {
    full_name: string;
    id_number: string;
    registration_number: string;
    registration_type: RegisteredPersonType;
    registration_date: string;
    contact: {
      tel: string;
      fax: string;
      cell: string;
      email: string;
      address: string;
    };
    signature_data_url: string;
    signed_at: string;
  };
  electrical_contractor: {
    full_name: string;
    id_number: string;
    registration_number: string;
    registration_date: string;
    signature_data_url: string;
    signed_at: string;
    contact: {
      name: string;
      address: string;
      tel: string;
      fax: string;
      cell: string;
      email: string;
    };
  };
  recipient: {
    name: string;
    signature_data_url: string;
    signed_at: string;
  };
};

export type CocTestItemResult = "pass" | "fail" | "na";

export type CocTestReportData = {
  form_version: "ecb-test-report-sans10142-1-ed3";
  db_supply_no: string;
  date_of_issue: string;
  location: {
    physical_address: string;
    building_name: string;
  };
  installation: {
    system_type: "TN-S" | "TN-C-S" | "TN-C" | "TT" | "IT" | "Other";
    system_type_other: string;
    voltage: string;
    frequency: string;
    number_of_phases: "One" | "Two" | "Three";
    permanent_installation: boolean;
    temporary_installation: boolean;
    common_area_sectional_title: boolean;
    phase_rotation: "Clockwise" | "Anti clockwise" | "NA";
    main_switch_type:
      | "Switch Disconnector"
      | "Fused Switch"
      | "Circuit Breaker"
      | "Earth Leakage Circuit Breaker"
      | "Earth Leakage Switch Disconnector";
    number_of_poles: string;
    current_rating_amps: string;
    rcd_tripping_current_ma: string;
    short_circuit_rating_kamps: string;
    surge_protection_installed: boolean | null;
    lightning_protection_installed: boolean | null;
    alternative_power_supply_installed: boolean | null;
    generator_kva: string;
    ups_kva: string;
  };
  description_of_installation: string;
  tests: Array<{
    key: string;
    label: string;
    result: CocTestItemResult;
    value: string;
    comments: string;
  }>;
  responsibility: {
    annex_pages_count: string;
    full_name: string;
    id_number: string;
    tel: string;
    email: string;
    registration_certificate_no: string;
    date_of_registration: string;
    registration_type: RegisteredPersonType;
    signature_data_url: string;
    signed_at: string;
  };
};

export const DEFAULT_TEST_ITEMS: Array<Pick<CocTestReportData["tests"][number], "key" | "label">> = [
  { key: "continuity_protective_conductors", label: "Continuity of protective conductors" },
  { key: "continuity_bonding", label: "Continuity of bonding conductors" },
  { key: "insulation_resistance", label: "Insulation resistance" },
  { key: "earth_electrode_resistance", label: "Earth electrode resistance (where applicable)" },
  { key: "polarity", label: "Polarity at points of consumption" },
  { key: "earth_loop_impedance", label: "Earth loop impedance / fault loop impedance" },
  { key: "prospective_fault_current", label: "Prospective fault current / short circuit current" },
  { key: "phase_sequence", label: "Phase sequence (three-phase)" },
  { key: "rcd_trip_time", label: "RCD / earth leakage trip time" },
  { key: "rcd_trip_current", label: "RCD / earth leakage trip current" },
  { key: "functional_tests", label: "Functional tests of switching, isolators, protective devices" },
  { key: "points_circuits", label: "Number of points / circuits (attach annex if needed)" },
  { key: "ring_continuity", label: "Continuity of ring circuits (attach annex if applicable)" },
  { key: "labels_and_signage", label: "Labels, signage, and circuit identification" },
  { key: "general_visual_inspection", label: "General visual inspection" },
];

export function createDefaultCocCertificateData(): CocCertificateData {
  return {
    form_version: "eir-2009-annexure-1",
    other_reference: "",
    installation: {
      physical_address: "",
      building_name: "",
      gps_coordinates: "",
      suburb_township: "",
      pole_number: "",
      district_town_city: "",
      erf_lot_no: "",
    },
    basis: "9(2)(a)",
    supplementary: {
      supplement_no: "",
      initial_certificate_no: "",
      initial_issued_on: "",
    },
    registered_person: {
      full_name: "",
      id_number: "",
      registration_number: "",
      registration_type: "IE",
      registration_date: "",
      contact: { tel: "", fax: "", cell: "", email: "", address: "" },
      signature_data_url: "",
      signed_at: "",
    },
    electrical_contractor: {
      full_name: "",
      id_number: "",
      registration_number: "",
      registration_date: "",
      signature_data_url: "",
      signed_at: "",
      contact: { name: "", address: "", tel: "", fax: "", cell: "", email: "" },
    },
    recipient: {
      name: "",
      signature_data_url: "",
      signed_at: "",
    },
  };
}

export function createDefaultCocTestReportData(): CocTestReportData {
  return {
    form_version: "ecb-test-report-sans10142-1-ed3",
    db_supply_no: "",
    date_of_issue: "",
    location: { physical_address: "", building_name: "" },
    installation: {
      system_type: "TN-C-S",
      system_type_other: "",
      voltage: "230/400",
      frequency: "50",
      number_of_phases: "One",
      permanent_installation: true,
      temporary_installation: false,
      common_area_sectional_title: false,
      phase_rotation: "NA",
      main_switch_type: "Circuit Breaker",
      number_of_poles: "",
      current_rating_amps: "",
      rcd_tripping_current_ma: "30",
      short_circuit_rating_kamps: "",
      surge_protection_installed: null,
      lightning_protection_installed: null,
      alternative_power_supply_installed: null,
      generator_kva: "",
      ups_kva: "",
    },
    description_of_installation: "",
    tests: DEFAULT_TEST_ITEMS.map((t) => ({ ...t, result: "na" as const, value: "", comments: "" })),
    responsibility: {
      annex_pages_count: "",
      full_name: "",
      id_number: "",
      tel: "",
      email: "",
      registration_certificate_no: "",
      date_of_registration: "",
      registration_type: "IE",
      signature_data_url: "",
      signed_at: "",
    },
  };
}

