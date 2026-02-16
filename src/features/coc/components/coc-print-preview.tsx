import * as React from "react";
import type { CocCertificateData, CocCertificateType, CocTestReportData } from "@/features/coc/lib/sa-electrical-coc";
import { cn } from "@/lib/utils";

function Tick({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-4 w-4 border border-black/70 flex items-center justify-center text-[10px] leading-none", checked ? "bg-black text-white" : "bg-white")}>
        {checked ? "X" : ""}
      </div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-black/80">{label}</div>
      <div className="min-h-[20px] border-b border-dotted border-black/60 text-[13px]">{value || " "}</div>
    </div>
  );
}

function SignatureBlock({ label, dataUrl }: { label: string; dataUrl: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-black/80">{label}</div>
      <div className="h-[70px] border border-black/40 bg-white flex items-center justify-center">
        {dataUrl ? <img src={dataUrl} alt={label} className="max-h-[66px] max-w-full object-contain" /> : <span className="text-xs text-black/50">—</span>}
      </div>
    </div>
  );
}

type Props = {
  certificateNo: string;
  certificateType: CocCertificateType;
  issuedAt: string;
  data: CocCertificateData;
  testReport: CocTestReportData;
  includeTestReport?: boolean;
  className?: string;
};

export default function CocPrintPreview({
  certificateNo,
  certificateType,
  issuedAt,
  data,
  testReport,
  includeTestReport = true,
  className,
}: Props) {
  const basisA = data.basis === "9(2)(a)";
  const basisB = data.basis === "9(2)(b)";
  const basisC = data.basis === "9(2)(c)";

  return (
    <div className={cn("space-y-8", className)}>
      <section className="coc-print-page">
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <div className="text-sm font-semibold tracking-wide">DEPARTMENT OF LABOUR</div>
            <div className="text-sm font-semibold tracking-wide">OCCUPATIONAL HEALTH AND SAFETY ACT, 1993</div>
            <div className="text-xl font-bold tracking-tight">CERTIFICATE OF COMPLIANCE</div>
            <div className="text-xs text-black/70">
              Certificate of compliance in accordance with regulation 7(1) of the Electrical Installation Regulations, 2009.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Certificate No." value={certificateNo} />
            <Field label="Date of Issue" value={issuedAt} />
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-black/80">Certificate Type</div>
              <div className="space-y-2">
                <Tick checked={certificateType === "initial"} label="Initial Certificate" />
                <Tick checked={certificateType === "supplementary"} label="Supplementary Certificate" />
              </div>
            </div>
          </div>

          {certificateType === "supplementary" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Supplement No." value={data.supplementary.supplement_no} />
              <Field label="Initial Certificate No." value={data.supplementary.initial_certificate_no} />
              <Field label="Initial Issued On" value={data.supplementary.initial_issued_on} />
            </div>
          ) : null}

          <div className="rounded-md border border-black/40 p-4 space-y-3">
            <div className="font-semibold text-sm">Identification of the relevant electrical installation</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Physical address" value={data.installation.physical_address} />
              <Field label="Name of building" value={data.installation.building_name} />
              <Field label="GPS Coordinates" value={data.installation.gps_coordinates} />
              <Field label="Suburb / Township" value={data.installation.suburb_township} />
              <Field label="Pole number" value={data.installation.pole_number} />
              <Field label="District / Town / City" value={data.installation.district_town_city} />
              <Field label="Erf / Lot No." value={data.installation.erf_lot_no} />
              <Field label="Other reference" value={data.other_reference} />
            </div>
          </div>

          <div className="rounded-md border border-black/40 p-4 space-y-3">
            <div className="font-semibold text-sm">Declaration by registered person</div>
            <div className="text-xs text-black/70">
              I, a registered person, declare that I have personally carried out the inspection and testing of the electrical installation described in the attached test report.
            </div>

            <div className="space-y-2">
              <Tick checked={basisA} label="Reg 9(2)(a) (new electrical installation)" />
              <Tick checked={basisB} label="Reg 9(2)(b) (existing electrical installation)" />
              <Tick checked={basisC} label="Reg 9(2)(c) (new part to existing electrical installation)" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full name" value={data.registered_person.full_name} />
              <Field label="ID No." value={data.registered_person.id_number} />
              <Field label="Registered person registration number" value={data.registered_person.registration_number} />
              <Field label="Date of registration" value={data.registered_person.registration_date} />
            </div>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-black/80">Type of registration</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Tick checked={data.registered_person.registration_type === "ETSP"} label="ETSP" />
                <Tick checked={data.registered_person.registration_type === "IE"} label="IE" />
                <Tick checked={data.registered_person.registration_type === "MIE"} label="MIE" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SignatureBlock label="Signature" dataUrl={data.registered_person.signature_data_url} />
              <Field label="Signed at / Date" value={data.registered_person.signed_at} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tel No." value={data.registered_person.contact.tel} />
              <Field label="Fax No." value={data.registered_person.contact.fax} />
              <Field label="Cell No." value={data.registered_person.contact.cell} />
              <Field label="Email" value={data.registered_person.contact.email} />
              <div className="md:col-span-2">
                <Field label="Address" value={data.registered_person.contact.address} />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-black/40 p-4 space-y-3">
            <div className="font-semibold text-sm">Declaration by electrical contractor</div>
            <div className="text-xs text-black/70">
              I declare that the electrical installation has been carried out in accordance with the requirements of the Occupational Health and Safety Act, 1993, and regulations made thereunder.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full name" value={data.electrical_contractor.full_name} />
              <Field label="ID No." value={data.electrical_contractor.id_number} />
              <Field label="Electrical contractor registration number" value={data.electrical_contractor.registration_number} />
              <Field label="Date of registration" value={data.electrical_contractor.registration_date} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SignatureBlock label="Signature" dataUrl={data.electrical_contractor.signature_data_url} />
              <Field label="Signed at / Date" value={data.electrical_contractor.signed_at} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name" value={data.electrical_contractor.contact.name} />
              <Field label="Tel" value={data.electrical_contractor.contact.tel} />
              <Field label="Fax" value={data.electrical_contractor.contact.fax} />
              <Field label="Cell" value={data.electrical_contractor.contact.cell} />
              <Field label="Email" value={data.electrical_contractor.contact.email} />
              <div className="md:col-span-2">
                <Field label="Address" value={data.electrical_contractor.contact.address} />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-black/40 p-4 space-y-3">
            <div className="font-semibold text-sm">Recipient</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Recipient name" value={data.recipient.name} />
              <Field label="Date" value={data.recipient.signed_at} />
              <div className="md:col-span-2">
                <SignatureBlock label="Recipient signature" dataUrl={data.recipient.signature_data_url} />
              </div>
            </div>
          </div>

          <div className="text-[11px] text-black/70">
            Note: This certificate is not valid unless all sections have been completed correctly and the test report (format approved by the chief inspector) is attached. This certificate will be invalid if any corrections have been made.
          </div>
        </div>
      </section>

      {includeTestReport ? (
        <section className="coc-print-page">
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-xl font-bold tracking-tight">TEST REPORT</div>
              <div className="text-xs text-black/70">For general electrical installations to SANS 10142-1 (Edition 3 template)</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Certificate of Compliance (CoC) No." value={certificateNo} />
              <Field label="DB / Supply No." value={testReport.db_supply_no} />
              <Field label="Date of Issue" value={testReport.date_of_issue || issuedAt} />
            </div>

            <div className="rounded-md border border-black/40 p-4 space-y-3">
              <div className="font-semibold text-sm">Section 1 – Location</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Physical address" value={testReport.location.physical_address || data.installation.physical_address} />
                <Field label="Building / location" value={testReport.location.building_name || data.installation.building_name} />
              </div>
            </div>

            <div className="rounded-md border border-black/40 p-4 space-y-3">
              <div className="font-semibold text-sm">Section 2 – About the installation</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="System type" value={testReport.installation.system_type === "Other" ? (testReport.installation.system_type_other || "Other") : testReport.installation.system_type} />
                <Field label="Voltage (V)" value={testReport.installation.voltage} />
                <Field label="Frequency (Hz)" value={testReport.installation.frequency} />
                <Field label="Number of phases" value={testReport.installation.number_of_phases} />
                <Field label="Phase rotation" value={testReport.installation.phase_rotation} />
                <Field label="Main switch type" value={testReport.installation.main_switch_type} />
                <Field label="Number of poles" value={testReport.installation.number_of_poles} />
                <Field label="Current rating (A)" value={testReport.installation.current_rating_amps} />
                <Field label="RCD IΔn (mA)" value={testReport.installation.rcd_tripping_current_ma} />
              </div>
            </div>

            <div className="rounded-md border border-black/40 p-4 space-y-3">
              <div className="font-semibold text-sm">Section 3 – Description of installation covered by this report</div>
              <div className="min-h-[80px] border border-black/30 p-3 text-[13px] whitespace-pre-wrap bg-white">
                {testReport.description_of_installation || " "}
              </div>
            </div>

            <div className="rounded-md border border-black/40 p-4 space-y-3">
              <div className="font-semibold text-sm">Section 4 – Inspection and tests (summary)</div>
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide">
                      <th className="border border-black/30 px-2 py-1 w-[45%]">Test</th>
                      <th className="border border-black/30 px-2 py-1 w-[10%]">Result</th>
                      <th className="border border-black/30 px-2 py-1 w-[20%]">Value</th>
                      <th className="border border-black/30 px-2 py-1 w-[25%]">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testReport.tests.map((t) => (
                      <tr key={t.key} className="text-[12px] align-top">
                        <td className="border border-black/30 px-2 py-1">{t.label}</td>
                        <td className="border border-black/30 px-2 py-1 uppercase">{t.result}</td>
                        <td className="border border-black/30 px-2 py-1">{t.value || " "}</td>
                        <td className="border border-black/30 px-2 py-1">{t.comments || " "}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border border-black/40 p-4 space-y-3">
              <div className="font-semibold text-sm">Section 5 – Responsibility, inspection and tests</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="# of annex pages" value={testReport.responsibility.annex_pages_count} />
                <Field label="Full name of registered person" value={testReport.responsibility.full_name || data.registered_person.full_name} />
                <Field label="ID number" value={testReport.responsibility.id_number || data.registered_person.id_number} />
                <Field label="Tel No." value={testReport.responsibility.tel || data.registered_person.contact.tel} />
                <Field label="Email" value={testReport.responsibility.email || data.registered_person.contact.email} />
                <Field label="Registration Certificate No." value={testReport.responsibility.registration_certificate_no || data.registered_person.registration_number} />
                <Field label="Date of registration" value={testReport.responsibility.date_of_registration || data.registered_person.registration_date} />
              </div>

              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-black/80">Registration type</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Tick checked={(testReport.responsibility.registration_type || data.registered_person.registration_type) === "ETSP"} label="ETSP" />
                  <Tick checked={(testReport.responsibility.registration_type || data.registered_person.registration_type) === "IE"} label="IE" />
                  <Tick checked={(testReport.responsibility.registration_type || data.registered_person.registration_type) === "MIE"} label="MIE" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SignatureBlock label="Signature" dataUrl={testReport.responsibility.signature_data_url || data.registered_person.signature_data_url} />
                <Field label="Signed at / Date" value={testReport.responsibility.signed_at || data.registered_person.signed_at} />
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

