import { Suspense } from "react";
import OptoutPageClient from "./optout-client";

export default function OptoutPage() {
  return (
    <Suspense>
      <OptoutPageClient />
    </Suspense>
  );
}
