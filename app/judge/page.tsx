import { Suspense } from "react";
import Judge from "./Judge.tsx";

export const metadata = { title: "Hold On — Judge Mode" };

export default function Page() {
  return (
    <Suspense>
      <Judge />
    </Suspense>
  );
}
