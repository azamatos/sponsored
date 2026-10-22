import { norm } from "./text.ts";

// Is the title a software engineering role, and which kind? Title only: cheap, and good enough to decide what to
// keep. The language model refines the family and seniority from the full text later.

export type Family =
  | "frontend"
  | "fullstack"
  | "backend"
  | "mobile"
  | "data"
  | "ml"
  | "devops"
  | "security"
  | "qa"
  | "embedded"
  | "management"
  | "software";

// Titles with "engineer" or "developer" in them that aren't software jobs.
const NOT_SOFTWARE =
  /\b(sales|solutions?|pre ?sales|customer|support|field|service|implementation|integration consultant|account|partner|success|recruit\w*|talent|marketing|growth marketer|content|technical writer|designer|design engineer|mechanical|electrical|electronics?|civil|structural|chemical|process|manufacturing|production|maintenance|facilities|hvac|construction|site engineer|project engineer|quality engineer|validation|test technician|technician|hardware|analog|asic|rtl|fpga|silicon|circuit|pcb|rf|antenna|optical|photonics|mechatronics|robotics hardware|aerospace|propulsion|avionics|nuclear|petroleum|geotechnical|environmental|biomedical|clinical|pharma|lab|sap|salesforce|servicenow|sharepoint|dynamics 365|oracle ebs|workday consultant)\b/;
const SOFTWARE = /\b(engineer|engineering|developer|programmer|swe|sde|architect|devops|sre)\b/;

const FAMILIES: [Family, RegExp][] = [
  [
    "management",
    /\b(engineering manager|manager engineering|head of (engineering|development|software|platform|data|mobile|frontend|backend)|director of engineering|engineering director|vp (of )?engineering|cto|chief technology)\b/,
  ],
  ["fullstack", /\b(full ?stack|fullstack)\b/],
  [
    "frontend",
    /\b(front ?end|frontend|ui engineer|ui developer|web developer|web engineer|react|angular|vue|javascript|typescript|design systems?)\b/,
  ],
  ["mobile", /\b(mobile|ios|android|react native|flutter|swift|kotlin multiplatform)\b/],
  [
    "ml",
    /\b(machine learning|ml|mlops|ai engineer|ai developer|applied ai|llm|deep learning|computer vision|nlp|research engineer)\b/,
  ],
  [
    "data",
    /\b(data engineer|data platform|analytics engineer|data infrastructure|etl|big data|data developer|bi developer|business intelligence)\b/,
  ],
  [
    "devops",
    /\b(devops|dev ops|sre|site reliability|platform engineer|infrastructure|cloud engineer|cloud architect|kubernetes|systems engineer|reliability|devsecops|network engineer|build engineer|release engineer)\b/,
  ],
  ["security", /\b(security|appsec|offensive|penetration|pentest|cryptograph\w*)\b/],
  [
    "qa",
    /\b(qa|quality assurance|test automation|automation tester|sdet|software tester|test engineer|testing engineer)\b/,
  ],
  ["embedded", /\b(embedded|firmware|kernel|low level|real time systems|automotive software)\b/],
  [
    "backend",
    /\b(back ?end|backend|java|golang|go developer|go engineer|python|ruby|rails|php|laravel|symfony|node ?js|nodejs|\.net|dotnet|c#|scala|elixir|erlang|rust|kotlin|clojure|haskell|api engineer|distributed systems|server side|c\+\+|cpp)\b/,
  ],
];

export function familyOf(title: string): Family | null {
  const raw = title.toLowerCase();
  const t = norm(title);
  if (!SOFTWARE.test(t)) return null;
  if (NOT_SOFTWARE.test(t)) return null;
  for (const [family, re] of FAMILIES)
    if (re.test(t) || (family === "backend" && /c\+\+|c#|\.net/.test(raw))) return family;
  if (/\b(software|developer|programmer|swe|sde|engineer)\b/.test(t)) return "software";
  return null;
}

export type Seniority = "intern" | "junior" | "mid" | "senior" | "staff" | "lead" | "manager" | "unspecified";

export function seniorityOf(title: string): Seniority {
  const t = norm(title);
  if (
    /\b(intern|internship|working student|werkstudent\w*|praktik\w*|trainee|apprentice\w*|thesis|student)\b/.test(
      t,
    )
  )
    return "intern";
  if (/\b(junior|jr|graduate|new grad|entry level|early career)\b/.test(t)) return "junior";
  if (/\b(manager|head of|director|vp|chief|cto)\b/.test(t)) return "manager";
  if (/\b(principal|staff|distinguished|fellow)\b/.test(t)) return "staff";
  if (/\b(lead|architect)\b/.test(t)) return "lead";
  if (/\b(senior|sr|snr|expert)\b/.test(t)) return "senior";
  if (/\b(mid|intermediate|medior|ii|2)\b/.test(t)) return "mid";
  return "unspecified";
}
