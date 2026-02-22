export type TutorialPlacement = "top" | "bottom" | "left" | "right";

export type TutorialStep = {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  placement: TutorialPlacement;
  route?: string;
};

export type UserOnboardingRow = {
  id: string;
  user_id: string;
  company_id: string;
  tutorial_key: string;
  current_step: number;
  is_completed: boolean;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
};

export type OnboardingController = {
  tutorialKey: string | null;
  steps: TutorialStep[];
  currentStepIndex: number;
  isCompleted: boolean;
  isLoading: boolean;
  isOpen: boolean;
  activeStep: TutorialStep | null;
  row: UserOnboardingRow | null;
  actions: {
    next: () => void;
    back: () => void;
    skip: () => void;
    finish: () => void;
    replay: () => void;
  };
};

