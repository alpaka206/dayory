export type EntryType = "quote" | "journal";

export type EntryMeta = {
  id: string;
  type: EntryType;
  author: string;
  date: string;
  pageTitle: string;
};
