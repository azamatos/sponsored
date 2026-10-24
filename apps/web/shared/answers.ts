// The answers the site shows, shared by the pages and the server. They come from the pipeline's role_answer view.

export const VISA_STATES = ["sponsors", "may", "can", "unknown", "wont"] as const;
export type VisaState = (typeof VISA_STATES)[number];

export const RELOCATION_STATES = ["helps", "may", "no", "silent"] as const;
export type RelocationState = (typeof RELOCATION_STATES)[number];

// The visa filter's levels, strongest first. The default hides only "Won't sponsor".
export const VISA_LEVELS = [
  { key: "sponsors", label: "Sponsors only", states: ["sponsors"] },
  { key: "may", label: "Sponsors or may", states: ["sponsors", "may"] },
  { key: "can", label: "Sponsors, may or can", states: ["sponsors", "may", "can"] },
  { key: "open", label: "Everything except won't", states: ["sponsors", "may", "can", "unknown"] },
  { key: "all", label: "All", states: [...VISA_STATES] },
] as const satisfies readonly { key: string; label: string; states: readonly VisaState[] }[];
export type VisaLevel = (typeof VISA_LEVELS)[number]["key"];

// One role in a list: what a job card shows.
export type RoleCard = {
  id: number;
  title: string;
  company: string;
  companySlug: string;
  place: string;
  workMode: string;
  visa: VisaState;
  relocation: RelocationState;
  languages: string[] | null;
  salary: string | null;
  firstSeen: string;
};

// The other filters, in the order the design lists them.
export const FAMILIES = [
  { key: "backend", label: "Backend" },
  { key: "frontend", label: "Frontend" },
  { key: "fullstack", label: "Full-stack" },
  { key: "mobile", label: "Mobile" },
  { key: "devops", label: "DevOps" },
  { key: "data", label: "Data" },
  { key: "ml", label: "ML" },
  { key: "security", label: "Security" },
  { key: "qa", label: "QA" },
  { key: "embedded", label: "Embedded" },
  { key: "management", label: "Management" },
  { key: "software", label: "Other software" },
] as const;
export const SENIORITY = [
  { key: "intern", label: "Intern" },
  { key: "junior", label: "Junior" },
  { key: "mid", label: "Mid" },
  { key: "senior", label: "Senior" },
  { key: "staff", label: "Staff" },
  { key: "lead", label: "Lead" },
  { key: "manager", label: "Manager" },
] as const;
export const MODES = [
  { key: "onsite", label: "On-site" },
  { key: "hybrid", label: "Hybrid" },
  { key: "remote", label: "Remote" },
] as const;
export const WITHIN = [
  { key: "", label: "Any time", days: 0 },
  { key: "1", label: "Last 24 hours", days: 1 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
] as const;
