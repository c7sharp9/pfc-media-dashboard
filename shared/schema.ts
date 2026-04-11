import { z } from "zod";

// Sermon record from Airtable
export interface Sermon {
  id: string; // Airtable record ID
  fields: {
    "Service": string; // date YYYY-MM-DD
    "Platform": string; // Sunday | Wednesday
    "Title"?: string;
    "Sermon URL"?: string;
    "General Notes"?: string;
    "Video URL"?: string;
    "Clips"?: boolean;
    "Recap URL"?: string;
    "Already used as, or is a, or don't want it as a, Replay?"?: boolean;
    "Created"?: string;
    "Trimmed Video URL"?: string;
    "Audio URL"?: string;
    "Transcription URL"?: string;
    "YouTube Trimmed URL"?: string;
    "YouTube Title"?: string;
    "YouTube Hidden"?: boolean;
    "YouTube Full Service URL"?: string;
    "Facebook Done"?: boolean;
    "Website Done"?: boolean;
    "Replayed On"?: string;
    "Don't Replay"?: boolean;
    "Don't Replay Reason"?: string;
    "Wednesday YouTube Link"?: string;
    "Wednesday YouTube Trimmed"?: boolean;
  };
}

// Edit record from Airtable
export interface Edit {
  id: string;
  fields: {
    "Broadcast Date"?: string;
    "Status"?: string;
    "Type"?: string[];
    "Date Completed"?: string;
    "Video URL"?: string;
    "Vertical"?: string;
    "Transcript"?: string;
    "JA Notes"?: string;
    "Editors Notes"?: string;
    "Date Posted"?: string;
    "Editor Name"?: string;
    "Sermon Link"?: string[];
    "Title"?: string;
    "XML"?: string;
  };
}

// Workflow step from Airtable
export interface WorkflowStep {
  id: string;
  fields: {
    "Name"?: string;
    "Platform"?: string;
    "Notes"?: string;
    "Tutorial URL"?: string;
    "Example URL"?: string;
    [key: string]: any;
  };
}

// Zod schemas for validation
export const updateSermonSchema = z.object({
  "Title": z.string().optional(),
  "Video URL": z.string().url().optional().or(z.literal("")),
  "Trimmed Video URL": z.string().url().optional().or(z.literal("")),
  "Audio URL": z.string().url().optional().or(z.literal("")),
  "Transcription URL": z.string().url().optional().or(z.literal("")),
  "YouTube Trimmed URL": z.string().url().optional().or(z.literal("")),
  "YouTube Title": z.string().optional(),
  "YouTube Hidden": z.boolean().optional(),
  "YouTube Full Service URL": z.string().url().optional().or(z.literal("")),
  "Facebook Done": z.boolean().optional(),
  "Website Done": z.boolean().optional(),
  "Sermon URL": z.string().url().optional().or(z.literal("")),
  "General Notes": z.string().optional(),
  "Replayed On": z.string().optional().nullable(),
  "Don't Replay": z.boolean().optional(),
  "Don't Replay Reason": z.string().optional(),
  "Clips": z.boolean().optional(),
  "Recap URL": z.string().url().optional().or(z.literal("")),
}).partial();

export const createEditSchema = z.object({
  "Broadcast Date": z.string().optional(),
  "Title": z.string().optional(),
  "Status": z.string().optional(),
  "Type": z.array(z.string()).optional(),
  "Editor Name": z.string().optional(),
  "Video URL": z.string().url().optional().or(z.literal("")),
  "Transcript": z.string().optional(),
  "JA Notes": z.string().optional(),
  "Editors Notes": z.string().optional(),
  "Sermon Link": z.array(z.string()).optional(),
  "XML": z.string().url().optional().or(z.literal("")),
  "Vertical": z.string().url().optional().or(z.literal("")),
});

export const updateEditSchema = createEditSchema.partial().extend({
  "Date Completed": z.string().optional().nullable(),
  "Date Posted": z.string().optional().nullable(),
});

export type UpdateSermonFields = z.infer<typeof updateSermonSchema>;
export type CreateEditFields = z.infer<typeof createEditSchema>;
export type UpdateEditFields = z.infer<typeof updateEditSchema>;
