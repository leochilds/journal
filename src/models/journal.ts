export interface Entry {
  id: string;
  timestamp: string;
  content: string;
}

export interface Day {
  summary: string;
  entries: Entry[];
}

export interface Journal {
  title: string;
  days: Record<string, Day>;
}
