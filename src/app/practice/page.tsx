import { Suspense } from "react";
import { PracticeGameLoader } from "@/components/DailyGameLoader";

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeGameLoader />
    </Suspense>
  );
}
