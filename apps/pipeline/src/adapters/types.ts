export type Ats =
  "ashby" | "greenhouse" | "lever" | "smartrecruiters" | "personio" | "recruitee" | "workable" | "workday";
export const ATS_LIST: Ats[] = [
  "ashby",
  "greenhouse",
  "lever",
  "smartrecruiters",
  "personio",
  "recruitee",
  "workable",
  "workday",
];

// A company's board. For Workday the slug is "host/tenant/site".
export type Board = { ats: Ats; slug: string; eu: boolean };

export type Detail = { description: string; location?: string; remote?: boolean; postedAt?: string | null };

export type RawPosting = {
  externalId: string;
  title: string;
  url: string;
  location: string;
  codes?: (string | null | undefined)[];
  remote?: boolean;
  hybrid?: boolean;
  postedAt?: string | null;
  // null when the board sends texts only per job: then detail() fetches it, and only for postings we keep
  description: string | null;
  salary?: string | null;
  detail?: () => Promise<Detail>;
};

export type BoardResult = { name: string | null; postings: RawPosting[] };
export type Adapter = (board: Board) => Promise<BoardResult>;
