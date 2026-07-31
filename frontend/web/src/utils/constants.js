export const DIFFICULTY_OPTIONS = [
  { value: 'fresher', label: 'Fresher' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid_level', label: 'Mid-Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'manager', label: 'Manager' },
  { value: 'hod', label: 'Head of Department' },
  { value: 'cxo', label: 'CEO/CXO' }
];

export const QUESTION_TYPE_OPTIONS = [
  { value: 'image_comparison', label: 'Image Comparison' },
  { value: 'find_mistakes', label: 'Find the Mistakes' },
  { value: 'hotspot', label: 'Hotspot Selection' },
  { value: 'content_review', label: 'Content Review' },
  { value: 'video_review', label: 'Video Review' },
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'drag_drop', label: 'Drag and Drop' },
  { value: 'multiple_error_detection', label: 'Multiple Error Detection' }
];

// Question types the AI can generate (text-only; media types need real assets).
export const AI_QUESTION_TYPE_OPTIONS = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'drag_drop', label: 'Drag and Drop' },
  { value: 'content_review', label: 'Content Review' }
];

export const STUDY_CONTENT_TYPE_OPTIONS = [
  { value: 'study_guide', label: 'Study Guide' },
  { value: 'summary', label: 'Quick Summary' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'practice_quiz', label: 'Practice Quiz' }
];

export const STUDY_CONTENT_TYPE_LABELS = Object.fromEntries(
  STUDY_CONTENT_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

export const ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'hr', label: 'HR Team' }
];

export const ROLE_LABELS = {
  company_admin: 'Company Admin',
  hr: 'HR Team',
  team_leader: 'Team Leader',
  employee: 'Employee',
  master_admin: 'Master Admin'
};

export const TYPE_LABELS = Object.fromEntries(
  QUESTION_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

export const DIFFICULTY_LABELS = Object.fromEntries(
  DIFFICULTY_OPTIONS.map((option) => [option.value, option.label])
);

export const PAGE_SIZES = [10, 20, 50, 100];

// Mirrors backend/src/constants/planFeatures.js — keep in sync.
export const PLAN_FEATURE_OPTIONS = [
  { value: 'ai_generation', label: 'AI Test Generation' },
  { value: 'pdf_learning_materials', label: 'PDF Learning Materials' },
  { value: 'custom_branding', label: 'Custom Branding' },
  { value: 'anti_cheat_proctoring', label: 'Anti-Cheat / Proctoring' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'advanced_reports_export', label: 'Advanced Reports & Export' },
  { value: 'multiple_departments_teams', label: 'Multiple Departments & Teams' },
  { value: 'study_library', label: 'Study Library' },
  { value: 'self_practice_mode', label: 'Self-Practice Mode' },
  { value: 'priority_support', label: 'Priority Support' }
];

export const PLAN_FEATURE_LABELS = Object.fromEntries(
  PLAN_FEATURE_OPTIONS.map((option) => [option.value, option.label])
);

// Mirrors backend/src/constants/reportKinds.js — keep in sync.
export const REPORT_KIND_OPTIONS = [
  {
    value: 'individual',
    label: 'Individual Employee',
    description: "One employee's performance, strengths & weaknesses."
  },
  { value: 'team', label: 'Team', description: "A team's participation and average quality." },
  {
    value: 'department',
    label: 'Department',
    description: "A department's participation and average quality."
  },
  {
    value: 'recruitment_drive',
    label: 'Recruitment Drive',
    description: 'Candidate rankings and success rate for one drive.'
  },
  {
    value: 'company_performance',
    label: 'Company Performance',
    description: 'Company-wide quality score, trend and department breakdown.'
  },
  {
    value: 'leaderboard',
    label: 'Leaderboard',
    description: 'Ranked by score, accuracy, speed and consistency.'
  }
];

export const REPORT_KIND_LABELS = Object.fromEntries(
  REPORT_KIND_OPTIONS.map((option) => [option.value, option.label])
);

// Mirrors backend/src/constants/reportKinds.js's BROADCAST_REPORT_KINDS.
export const BROADCAST_REPORT_KIND_OPTIONS = REPORT_KIND_OPTIONS.filter((option) =>
  ['company_performance', 'leaderboard', 'recruitment_drive'].includes(option.value)
);

// Mirrors backend/src/models/Assignment.js's status enum (Assignment History).
export const ASSIGNMENT_STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  expired: 'Expired',
  revoked: 'Revoked'
};

// Mirrors Assignment.targetType — the "Assigned To" column on Assignment History.
export const ASSIGNMENT_TARGET_TYPE_LABELS = {
  company: 'Company',
  department: 'Department',
  team: 'Team',
  employee: 'Employee',
  role: 'Role',
  difficulty: 'Difficulty'
};
