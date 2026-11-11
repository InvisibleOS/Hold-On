import { Suspense } from "react";
import Setup from "./Setup.tsx";

export const metadata = { title: "Hold On — Setup" };

export default function Page() {
  return (
    <Suspense>
      <Setup />
    </Suspense>
  );
}
