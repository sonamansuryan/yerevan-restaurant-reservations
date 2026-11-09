import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";
import { PageContainer } from "@/components/PageContainer";
import { ActionSection } from "@/features/design/components/ActionSection";
import { BrandSection } from "@/features/design/components/BrandSection";
import { ColorSection } from "@/features/design/components/ColorSection";
import { Contents } from "@/features/design/components/Contents";
import { FeedbackSection } from "@/features/design/components/FeedbackSection";
import { FormSection } from "@/features/design/components/FormSection";
import { MotionSection } from "@/features/design/components/MotionSection";
import { ProtectedSection } from "@/features/design/components/ProtectedSection";
import { ResponsiveSection } from "@/features/design/components/ResponsiveSection";
import { ShapeSection } from "@/features/design/components/ShapeSection";
import { SpaceSection } from "@/features/design/components/SpaceSection";
import { TypeSection } from "@/features/design/components/TypeSection";
import { useForcedStates } from "@/features/design/hooks/useForcedStates";

/** The house style: every token and shared component. Its route only exists in development. */
export function DesignPage(): ReactElement {
  useForcedStates();

  return (
    <PageContainer className="pt-12 md:pt-16">
      <title>House style · Seghan</title>
      <div>
        <Badge tone="warning">Development only</Badge>
        <h1 className="mt-4 font-display text-feature md:text-hero">The house style</h1>
        <p className="mt-4 max-w-140 text-lead text-ink-secondary">
          Every token and shared component, exactly as the app renders them. This page never reaches
          the production build.
        </p>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <Contents />
        <div className="min-w-0">
          <ColorSection />
          <TypeSection />
          <SpaceSection />
          <ShapeSection />
          <MotionSection />
          <ActionSection />
          <FormSection />
          <FeedbackSection />
          <BrandSection />
          <ProtectedSection />
          <ResponsiveSection />
        </div>
      </div>
    </PageContainer>
  );
}
