import Link from "next/link";

/**
 * The three doors into the app. Ordered by how many people walk through each:
 * anyone can compute a loan, borrowers check a balance, staff sign in.
 */
const ENTRANCES = [
  {
    href: "/calculator",
    title: "Loan Calculator",
    description:
      "Compute interest, payments, and the true cost of a loan — free to use",
    icon: (
      <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 4v3h10V6H7zm0 5v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v4h2v-4h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2z" />
    ),
    primary: true,
  },
  {
    href: "/portal/login",
    title: "Borrower Portal",
    description: "View your balance, upcoming dues, and payment history",
    icon: (
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    ),
  },
  {
    href: "/login",
    title: "Staff sign-in",
    description: "Collectors, managers, and owners",
    icon: (
      <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
    ),
  },
];

export default function Home() {
  return (
    <main className="hero min-h-screen bg-base-200 px-4 py-10">
      <div className="hero-content w-full max-w-lg flex-col items-stretch">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-3xl font-bold text-secondary-content">
            ₱
          </div>
          <h1 className="text-4xl font-bold tracking-tight">RIA Lending</h1>
          <p className="mt-2 text-base text-base-content/70">
            Loan management for lenders, collectors, and borrowers.
          </p>
        </header>

        <nav className="mt-8 space-y-3">
          {ENTRANCES.map((entrance) => (
            <Link
              key={entrance.href}
              href={entrance.href}
              className={`card card-border transition-shadow hover:shadow-md ${
                entrance.primary
                  ? "border-primary bg-primary text-primary-content"
                  : "border-base-300 bg-base-100"
              }`}
            >
              <div className="card-body flex-row items-center gap-4">
                <svg
                  viewBox="0 0 24 24"
                  className={`h-7 w-7 shrink-0 fill-current ${
                    entrance.primary ? "opacity-80" : "text-primary"
                  }`}
                  aria-hidden
                >
                  {entrance.icon}
                </svg>
                <span className="min-w-0">
                  <span className="card-title block text-lg">
                    {entrance.title}
                  </span>
                  <span
                    className={`block text-sm ${
                      entrance.primary ? "opacity-80" : "text-base-content/70"
                    }`}
                  >
                    {entrance.description}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </nav>

        <p className="mt-8 text-center text-sm text-base-content/70">
          Every quote shows its effective interest rate, as required by the
          Truth in Lending Act (RA 3765).
        </p>
      </div>
    </main>
  );
}
