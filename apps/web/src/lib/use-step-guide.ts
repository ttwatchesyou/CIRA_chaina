"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function useStepGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const guideFromUrl = searchParams.get("guide");
  const flowActive = searchParams.get("tour") === "1";
  const [activeGuide, setActiveGuide] = useState<string | null>(guideFromUrl);

  useEffect(() => {
    setActiveGuide(guideFromUrl);
  }, [guideFromUrl]);

  const replaceGuideParameters = useCallback((guide: string | null, keepFlow: boolean) => {
    const nextParameters = new URLSearchParams(searchParams.toString());
    if (guide) nextParameters.set("guide", guide);
    else nextParameters.delete("guide");
    if (keepFlow) nextParameters.set("tour", "1");
    else nextParameters.delete("tour");
    const query = nextParameters.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const dismissGuide = useCallback(() => {
    setActiveGuide(null);
    replaceGuideParameters(null, false);
  }, [replaceGuideParameters]);

  const completeGuide = useCallback(() => {
    setActiveGuide(null);
    replaceGuideParameters(null, flowActive);
  }, [flowActive, replaceGuideParameters]);

  const showGuide = useCallback((guide: string) => {
    setActiveGuide(guide);
    replaceGuideParameters(guide, true);
  }, [replaceGuideParameters]);

  return { activeGuide, flowActive, dismissGuide, completeGuide, showGuide };
}
