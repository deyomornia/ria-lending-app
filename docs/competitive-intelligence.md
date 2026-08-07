# Competitive Intelligence — RIA Lending

Assessment date: 2026-08-08. Branch: `opus-intel`.

## TL;DR

RIA competes in the **small-to-mid Philippine lending operator** segment, not against
consumer loan apps (Finbro, MoneyCat, BillEase) and not against enterprise cores (Mambu,
LoanPro, TurnKey Lender). Its real substitute is **Loandisk** and, below that, Excel.

RIA already wins on three axes no direct competitor covers: PH-native interest schemes
including _5-6_ and _hulugan_, a borrower portal that needs no email address, and an
integer-centavo money core. It loses on SMS, collateral, savings/investor accounts, and
multi-branch.

The single highest-leverage gap found — now closed on this branch — was that **no product
in this segment discloses a true effective interest rate**, despite RA 3765 requiring it.

---

## Competitive set

| Tier                      | Players                                          | Why they are / aren't the real competitor                                                                                           |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Direct substitute**     | Loandisk                                         | Same buyer, same price band, microfinance-oriented. Has SMS, savings, investor accounts, branches, collateral. The product to beat. |
| **Adjacent**              | Excel / paper ledger                             | Still the majority incumbent for small PH lenders. Loses on audit trail and rounding integrity.                                     |
| **Enterprise core**       | Mambu, LoanPro, TurnKey Lender, Bryt, LendFusion | Wrong buyer. LendFusion alone starts at **$1,659/mo**; most require a sales call. Not price-reachable for this segment.             |
| **Consumer lending apps** | Finbro, MoneyCat, Cash-Express, BillEase, Kviku  | Not competitors — they _are_ lenders, not software. Relevant only as the rate benchmark borrowers compare against.                  |

## Where RIA already wins

- **PH-native interest schemes.** Flat add-on (_5-6_), diminishing, one-time fixed, and
  per-period flat, across daily / weekly / semi-monthly (_kinsenas/katapusan_) / monthly.
  Generic Western platforms model amortisation and little else.
- **Borrower portal without email.** Phone + bcrypt access code → signed JWT. Loandisk's
  own marketing does not reference a borrower portal at all. Correct call for a market
  where many borrowers have a mobile number and no email.
- **Integer-centavo money core.** Every amount is an integer; the last schedule row absorbs
  rounding so totals reconcile exactly. Float drift is a real and common defect here.
- **One interest engine.** Calculator, loan creation, and the PDF share `lib/interest/`, so
  they cannot disagree — a frequent source of disputes with borrowers.
- **Manila-calendar dates throughout**, so due dates never drift with server timezone.

## Gaps against Loandisk

Ranked by competitive cost. None are closed on this branch — recorded for planning.

| #   | Gap                                                | Impact                 | Note                                                                                                              |
| --- | -------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **SMS reminders** (pre-due, arrears, confirmation) | High                   | Loandisk's flagship feature. In PH collections, SMS is the primary channel. Needs a gateway + budget.             |
| 2   | **Collateral tracking**                            | Medium                 | Common in PH lending (ATM cards, land titles, OR/CR).                                                             |
| 3   | **Savings & investor accounts**                    | Medium                 | Loandisk has both. Expands the buyer from lender to cooperative.                                                  |
| 4   | **Multi-branch**                                   | Medium                 | Blocks the multi-location operator entirely.                                                                      |
| 5   | **Cash flow / P&L statements**                     | Medium                 | RIA has operational analytics but no financial statements.                                                        |
| 6   | **SEC registration + CoA display**                 | Low effort, compliance | SEC requires the registration number and Certificate of Authority on all platforms and adverts. Currently absent. |

## The wedge — RA 3765 disclosure

**Finding.** Neither the consumer lending apps nor Loandisk surfaces a true effective
interest rate. RA 3765 (Truth in Lending Act) requires the creditor to disclose, before
consummation, the amount financed, the finance charge, and _the rate that charge actually
represents_.

**RIA's pre-existing defect.** `effectiveMonthlyRatePct` was computed as
`interest ÷ principal ÷ months` — the quoted add-on rate. It ignores that the borrower
amortises principal and ignores the processing fee entirely, and it was labelled
"effective" in the calculator UI. That is precisely the understatement the Act targets.

**What changed on this branch.**

- `lib/interest/disclosure.ts` — solves the true internal rate of return by bisection over
  actual Manila-calendar cash flows (net release out, each scheduled payment in), then
  reports effective monthly, effective annual, and simple APR.
- The processing fee is correctly treated as part of the finance charge, since the borrower
  never receives it.
- Irregular first payment periods are priced from real day counts, not assumed whole periods.
- The misleading "effective" label in the calculator is now "quoted", with the real figures
  shown beside it.

**Validation.** A true declining-balance loan at a stated 2%/period returns an effective
**2.01%/month** — a loan whose EIR should equal its stated rate does. Representative output:

| Terms                             | Quoted | True eff./mo | EIR/yr |
| --------------------------------- | ------ | ------------ | ------ |
| ₱10,000 @ 5%/mo add-on, 6 monthly | 5.00%  | **8.14%**    | 155.9% |
| …plus ₱500 processing fee         | 5.00%  | **9.88%**    | 209.8% |
| _5-6_: ₱1,000, 20% over 30 daily  | 20.00% | **44.57%**   | 8,232% |
| Diminishing 2%/mo, 12 monthly     | 1.12%  | 2.01%        | 27.0%  |

**Why this is defensible.** It is a legal requirement competitors ignore, it costs nothing
to run (pure computation, no gateway or vendor), it is hard to copy credibly without the
integer-centavo engine underneath, and it converts a compliance obligation into the
product's most quotable claim.

**Caveat.** This implements the _arithmetic_ of RA 3765 disclosure. It is not a legal
compliance sign-off — the statutory disclosure statement has form and delivery requirements
that should be reviewed by PH counsel before relying on it in production.

## Recommended sequence

1. Put the disclosure figures on the loan record and the agreement PDF, not just the
   calculator — the Act applies at consummation, which is where the PDF is generated.
2. Add the SEC registration number and Certificate of Authority to the footer and PDF. Cheap,
   and required.
3. SMS reminders. Largest functional gap and the highest collections ROI.
4. Collateral tracking, then multi-branch, in that order.

## Sources

- [Truth in Lending Act, RA 3765 — ADB Law & Policy Reform](https://lpr.adb.org/resource/truth-lending-act-republic-act-no-3765-philippines)
- [RA 3765 full text — digest.ph](https://www.digest.ph/laws/an-act-to-require-the-disclosure-of-finance-charges-in-connection-with-extensions-of-credit)
- [Truth in Lending Act — lender duties (Respicio & Co.)](https://www.respicio.ph/commentaries/truth-in-lending-act-lender-duties-on-statements-of-account-and-unauthorized-deductions-philippines)
- [Borrower rights & SEC regulations on online loans — PesoMatch](https://www.pesomatch.com/guides/borrower-rights-and-sec-regulations)
- [Loandisk — loan management system](https://www.loandisk.com/)
- [Best loan management software 2026 — LendFusion](https://lendfusion.com/blog/loan-management-software/)
- [Loan management system in the Philippines — HES FinTech](https://hesfintech.com/lending-software-philippines/)
- [SEC list of registered online lending platforms (Jan 2026)](https://www.newspress.ph/2026/02/sec-releases-updated-list-of-registered.html)
