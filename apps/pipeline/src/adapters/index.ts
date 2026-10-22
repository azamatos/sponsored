import { ashby } from "./ashby.ts";
import { greenhouse } from "./greenhouse.ts";
import { lever } from "./lever.ts";
import { personio } from "./personio.ts";
import { recruitee } from "./recruitee.ts";
import { smartrecruiters } from "./smartrecruiters.ts";
import type { Adapter, Ats } from "./types.ts";
import { workable } from "./workable.ts";
import { workday } from "./workday.ts";

export const ADAPTERS: Record<Ats, Adapter> = {
  ashby,
  greenhouse,
  lever,
  smartrecruiters,
  personio,
  recruitee,
  workable,
  workday,
};
export * from "./types.ts";
