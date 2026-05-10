// lib/constants.ts — shared lookup tables used across multiple screens
import { MuscleGroup } from './types';

export const MUSCLE_GROUPS: { key: 'all' | MuscleGroup; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'chest',     label: 'Chest' },
  { key: 'back',      label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'biceps',    label: 'Biceps' },
  { key: 'triceps',   label: 'Triceps' },
  { key: 'legs',      label: 'Legs' },
  { key: 'glutes',    label: 'Glutes' },
  { key: 'core',      label: 'Core' },
  { key: 'cardio',    label: 'Cardio' },
];

export const EQUIPMENT_FILTERS = ['all', 'Barbell', 'Bodyweight', 'Cable', 'Dumbbell', 'Machine'];
