import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Keeps Supabase auth sessions fresh for staff routes (Next 16 proxy convention). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Revalidates the auth token if expired
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/borrowers/:path*",
    "/loans/:path*",
    "/collections/:path*",
    "/account/:path*",
    "/remittances/:path*",
    "/remittances",
    "/payments/:path*",
    "/audit",
    "/settings/:path*",
    "/login",
  ],
};
