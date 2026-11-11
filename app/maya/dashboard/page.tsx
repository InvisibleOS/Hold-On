import { Suspense } from "react";
import { connection } from "next/server";
import SafetyDashboard from "./SafetyDashboard.tsx";

export const metadata = { title: "Hold On — Safety dashboard" };

async function WithLicense() {
  await connection(); // read the license at request time, not build time
  return <SafetyDashboard licenseKey={process.env.AG_STUDIO_LICENSE} />;
}

export default function Page() {
  return (
    <Suspense>
      <WithLicense />
    </Suspense>
  );
}
