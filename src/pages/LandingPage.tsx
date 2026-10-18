import React, { useState, useRef } from 'react';
import { useI18n } from '../i18n/context';
import { HeroSection } from '../components/landing/HeroSection';
import { WhySection } from '../components/landing/WhySection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { WorkspaceShowcaseSection } from '../components/landing/WorkspaceShowcaseSection';
import { InteractiveSimulationSection } from '../components/landing/InteractiveSimulationSection';
import { AiCompanionSection } from '../components/landing/AiCompanionSection';
import { CoursesShowcaseSection } from '../components/landing/CoursesShowcaseSection';
import { PersonasSection } from '../components/landing/PersonasSection';
import { MarketplaceShowcaseSection } from '../components/landing/MarketplaceShowcaseSection';
import { FaqSection } from '../components/landing/FaqSection';
import { FinalCtaSection } from '../components/landing/FinalCtaSection';
import { FooterSection } from '../components/landing/FooterSection';
import { SupportChatbot } from '../components/support/SupportChatbot';

export interface LandingPageProps {
  onStartDesigning: () => void;
  onExploreLessons: () => void;
  onExploreMarketplace?: () => void;
  onNavigate?: (route: string) => void;
  onOpenProject?: (doc: any) => void;
  currentUser?: { id?: string; email?: string } | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartDesigning,
  onExploreLessons,
  onExploreMarketplace,
  onNavigate,
  onOpenProject,
  currentUser,
}) => {
  const { language } = useI18n();
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const storyContainerRef = useRef<HTMLDivElement>(null);

  const handleNavigateFallback = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else if (route === 'courses') {
      onExploreLessons();
    } else if (route === 'projects') {
      onStartDesigning();
    } else if (route === 'marketplace' && onExploreMarketplace) {
      onExploreMarketplace();
    }
  };

  const handleScrollToExplore = () => {
    storyContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="w-full min-h-screen bg-transparent text-slate-800 dark:text-slate-100 selection:bg-cyan-500 selection:text-white dark:selection:text-slate-950 transition-colors duration-300 flex flex-col overflow-x-hidden">
      {/* 1. Hero Section (Enhanced with scroll invitation) */}
      <HeroSection
        onStartDesigning={onStartDesigning}
        onExploreLessons={onExploreLessons}
        onScrollDown={handleScrollToExplore}
      />

      {/* Anchor for smooth scroll down from Hero */}
      <div ref={storyContainerRef} className="h-2" />

      {/* 2. Section 1 — Why CircuitCraft? */}
      <WhySection />

      {/* 3. Section 2 — How It Works (4-Step Workflow) */}
      <HowItWorksSection />

      {/* 4. Section 3 — Explore The 3D Workspace */}
      <WorkspaceShowcaseSection onStartDesigning={onStartDesigning} />

      {/* 5. Section 4 — Real-Time Simulation Interactive Demo */}
      <InteractiveSimulationSection />

      {/* 6. Section 5 — Learn With AI (Minibot Companion) */}
      <AiCompanionSection onStartDesigning={onStartDesigning} />

      {/* 7. Section 6 — Interactive Courses Showcase */}
      <CoursesShowcaseSection onExploreLessons={onExploreLessons} />

      {/* 8. Section 7 — Built For Every Creator */}
      <PersonasSection
        onStartDesigning={onStartDesigning}
        onExploreLessons={onExploreLessons}
        onExploreMarketplace={onExploreMarketplace}
      />

      {/* 9. Section 8 — Community & Marketplace Showcase */}
      <MarketplaceShowcaseSection
        onExploreMarketplace={onExploreMarketplace}
        onOpenProject={onOpenProject}
      />

      {/* 10. Section 9 — FAQ For Beginners */}
      <FaqSection onOpenSupportChat={() => setIsSupportChatOpen(true)} />

      {/* 11. Section 10 — Final Call To Action */}
      <FinalCtaSection
        onStartDesigning={onStartDesigning}
        onExploreLessons={onExploreLessons}
      />

      {/* 12. Complete Modern Footer */}
      <FooterSection
        onNavigate={handleNavigateFallback}
        onOpenSupportChat={() => setIsSupportChatOpen(true)}
      />

      {/* 13. Independent AI Support Chatbot (Fixed Bottom-Right) */}
      <SupportChatbot
        currentUser={currentUser}
        onNavigate={handleNavigateFallback}
        isOpenControlled={isSupportChatOpen}
        onToggleControlled={setIsSupportChatOpen}
      />
    </div>
  );
};
