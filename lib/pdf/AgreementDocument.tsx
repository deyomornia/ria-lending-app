import path from "path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatPeso } from "@/lib/interest/money";
import { formatLongDate } from "@/lib/tz";
import { amountInWords } from "./amount-words";

const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(fontsDir, "NotoSans-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(fontsDir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 9, padding: 42, lineHeight: 1.5 },
  header: { textAlign: "center", marginBottom: 14 },
  companyName: { fontSize: 14, fontWeight: "bold" },
  headerSub: { fontSize: 8, color: "#444" },
  title: { fontSize: 12, fontWeight: "bold", textAlign: "center", marginVertical: 10 },
  paragraph: { marginBottom: 8, textAlign: "justify" },
  bold: { fontWeight: "bold" },
  termsBox: { borderWidth: 1, borderColor: "#999", padding: 8, marginBottom: 10 },
  termRow: { flexDirection: "row", marginBottom: 2 },
  termLabel: { width: "45%", color: "#444" },
  termValue: { width: "55%", fontWeight: "bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#333",
    backgroundColor: "#eee",
    fontWeight: "bold",
    paddingVertical: 3,
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ccc", paddingVertical: 2 },
  cSeq: { width: "8%", paddingHorizontal: 3 },
  cDate: { width: "32%", paddingHorizontal: 3 },
  cAmt: { width: "20%", paddingHorizontal: 3, textAlign: "right" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  sigBlock: { width: "45%" },
  sigLine: { borderTopWidth: 1, borderColor: "#000", marginTop: 28, paddingTop: 3, textAlign: "center", fontSize: 8 },
  sectionTitle: { fontWeight: "bold", marginTop: 8, marginBottom: 4 },
});

export type AgreementProps = {
  company: {
    company_name: string;
    address?: string | null;
    contact_number?: string | null;
    tin?: string | null;
    representative_name?: string | null;
  };
  borrower: {
    full_name: string;
    phone: string;
    address?: string | null;
    id_type?: string | null;
    id_number?: string | null;
  };
  loan: {
    loan_number: string;
    interest_method: string;
    principal_centavos: number;
    interest_rate_bps: number | null;
    fixed_interest_centavos: number | null;
    payment_frequency: string;
    term_periods: number;
    processing_fee_centavos: number;
    release_date: string;
    first_due_date: string;
    total_interest_centavos: number;
    total_payable_centavos: number;
    penalty_rate_bps: number;
    penalty_grace_days: number;
  };
  rows: { seq: number; due_date: string; total_due_centavos: number }[];
};

const METHOD_TEXT: Record<string, string> = {
  flat_addon: "flat add-on interest per month on the principal",
  diminishing: "interest per payment period on the diminishing balance",
  one_time_fixed: "a one-time fixed interest amount",
  per_period_flat: "flat interest per payment on the principal",
};

const FREQUENCY_TEXT: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  semi_monthly: "semi-monthly (every 15th and end of the month)",
  monthly: "monthly",
};

export function AgreementDocument({ company, borrower, loan, rows }: AgreementProps) {
  const rateText =
    loan.interest_method === "one_time_fixed"
      ? formatPeso(loan.fixed_interest_centavos ?? 0)
      : `${((loan.interest_rate_bps ?? 0) / 100).toFixed(2)}%`;

  return (
    <Document title={`Loan Agreement ${loan.loan_number}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{company.company_name}</Text>
          {company.address ? <Text style={styles.headerSub}>{company.address}</Text> : null}
          <Text style={styles.headerSub}>
            {[company.contact_number, company.tin ? `TIN: ${company.tin}` : null]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
        </View>

        <Text style={styles.title}>LOAN AGREEMENT WITH PROMISSORY NOTE</Text>
        <Text style={{ textAlign: "center", fontSize: 8, marginBottom: 10 }}>
          Loan No. {loan.loan_number}
        </Text>

        <Text style={styles.paragraph}>
          This Loan Agreement is entered into on{" "}
          <Text style={styles.bold}>{formatLongDate(loan.release_date)}</Text> by and between{" "}
          <Text style={styles.bold}>{company.company_name}</Text>
          {company.representative_name
            ? `, represented by ${company.representative_name}`
            : ""}{" "}
          (the “LENDER”), and <Text style={styles.bold}>{borrower.full_name}</Text>, with contact
          number {borrower.phone}
          {borrower.address ? `, residing at ${borrower.address}` : ""}
          {borrower.id_type ? ` (${borrower.id_type} No. ${borrower.id_number ?? ""})` : ""} (the
          “BORROWER”).
        </Text>

        <View style={styles.termsBox}>
          <TermRow label="Principal loan amount" value={formatPeso(loan.principal_centavos)} />
          <TermRow label="Amount in words" value={amountInWords(loan.principal_centavos)} />
          <TermRow
            label="Interest"
            value={`${rateText} — ${METHOD_TEXT[loan.interest_method] ?? loan.interest_method}`}
          />
          {loan.processing_fee_centavos > 0 ? (
            <TermRow
              label="Processing fee (deducted upon release)"
              value={formatPeso(loan.processing_fee_centavos)}
            />
          ) : null}
          <TermRow label="Total interest" value={formatPeso(loan.total_interest_centavos)} />
          <TermRow
            label="Total amount payable"
            value={`${formatPeso(loan.total_payable_centavos)} (${amountInWords(loan.total_payable_centavos)})`}
          />
          <TermRow
            label="Payment terms"
            value={`${loan.term_periods} ${FREQUENCY_TEXT[loan.payment_frequency] ?? ""} payment(s), first due on ${formatLongDate(loan.first_due_date)}`}
          />
          <TermRow
            label="Late payment penalty"
            value={`${(loan.penalty_rate_bps / 100).toFixed(2)}% of the missed payment after a ${loan.penalty_grace_days}-day grace period`}
          />
        </View>

        <Text style={styles.paragraph}>
          FOR VALUE RECEIVED, the BORROWER promises to pay the LENDER the total amount payable
          stated above according to the schedule of payments below. Payments shall first be applied
          to accrued penalties, then to the oldest amount due. Failure to pay any installment when
          due, after the grace period, shall subject the BORROWER to the late payment penalty
          stated above, without prejudice to the LENDER&apos;s right to demand full payment of the
          remaining balance and to pursue all remedies allowed by law, including those under the
          Lending Company Regulation Act of 2007 (R.A. 9474).
        </Text>

        <Text style={styles.sectionTitle}>SCHEDULE OF PAYMENTS</Text>
        <View style={styles.tableHeader} fixed>
          <Text style={styles.cSeq}>No.</Text>
          <Text style={styles.cDate}>Due date</Text>
          <Text style={styles.cAmt}>Amount due</Text>
          <Text style={styles.cDate}>Date paid</Text>
          <Text style={{ width: "20%", paddingHorizontal: 3 }}>Signature</Text>
        </View>
        {rows.map((r) => (
          <View key={r.seq} style={styles.tableRow} wrap={false}>
            <Text style={styles.cSeq}>{r.seq}</Text>
            <Text style={styles.cDate}>{formatLongDate(r.due_date)}</Text>
            <Text style={styles.cAmt}>{formatPeso(r.total_due_centavos)}</Text>
            <Text style={styles.cDate}> </Text>
            <Text style={{ width: "20%", paddingHorizontal: 3 }}> </Text>
          </View>
        ))}

        <Text style={[styles.paragraph, { marginTop: 12 }]}>
          IN WITNESS WHEREOF, the parties have signed this Agreement on the date first written
          above.
        </Text>

        <View style={styles.sigRow} wrap={false}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine}>
              {borrower.full_name}
              {"\n"}BORROWER — Signature over printed name
            </Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine}>
              {company.representative_name || company.company_name}
              {"\n"}LENDER — Signature over printed name
            </Text>
          </View>
        </View>
        <View style={styles.sigRow} wrap={false}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine}>CO-MAKER — Signature over printed name</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine}>WITNESS — Signature over printed name</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.termRow}>
      <Text style={styles.termLabel}>{label}</Text>
      <Text style={styles.termValue}>{value}</Text>
    </View>
  );
}
