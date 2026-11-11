import { Suspense } from "react";
import Maya from "./Maya.tsx";

export const metadata = { title: "Hold On — Maya" };

export default function Page() {
  return (
    <Suspense>
      <Maya />
    </Suspense>
  );
}
