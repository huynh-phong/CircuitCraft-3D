import { ProjectDocument } from '../project/types';
import { SimulationResult } from '../simulation/types';

export interface LessonStep {
  id: string;
  title: string;
  instruction: string;
  hint: string;
}

export interface LessonEvaluation {
  isCompleted: boolean;
  activeStepIndex: number;
  feedback: string;
  progressPercent: number;
}

export interface Lesson {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  difficulty: 'Cơ bản' | 'Trung bình' | 'Nâng cao';
  estimatedMinutes: number;
  goal: string;
  steps: LessonStep[];
  createInitialProject: () => ProjectDocument;
  evaluate: (doc: ProjectDocument, simResult: SimulationResult, switchStates: Record<string, boolean>) => LessonEvaluation;
}
