import { Suspense } from "react";
import Rose from "./Rose.tsx";

export const metadata = { title: "Hold On — Rose" };

export default function Page() {
  return (
    <Suspense>
      <Rose />
    </Suspense>
  );
}
