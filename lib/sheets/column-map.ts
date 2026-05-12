/**
 * Google Sheets → initiatives column mapping.
 *
 * Column headers are normalised to lowercase + trimmed before matching.
 * Keys here must match the normalised form of the actual sheet header.
 */

/** LOE label from sheet (L / M / H / LOW / MED / HIGH) → estimated_loe DB enum value */
export const LOE_TO_ESTIMATED: Record<string, string> = {
  l: "S",
  lo: "S",
  low: "S",
  m: "M",
  med: "M",
  medium: "M",
  h: "L",
  hi: "L",
  high: "L",
};

/** Normalised sheet header → initiatives column name.
 *  Only covers columns that map 1-to-1.  Jira and special columns are
 *  handled separately in sync.ts. */
export const DIRECT_COLUMN_MAP: Record<string, string> = {
  initiative: "title",
  description: "description",
  "high-level focus": "high_level_focus",
  loe: "loe_label",
  "time to business value": "time_to_business_value",
  "loe score": "loe_score",
  "value to business score": "value_score",
  "strategic alignment score": "alignment_score",
  "avg score": "avg_score",
  "data resources": "data_resources",
  sequence: "sequence",
  "da resource months": "da_resource_months",
  "de resource months": "de_resource_months",
  "ds resource months": "ds_resource_months",
};

/** Normalised header names for Jira-related columns (handled separately). */
export const JIRA_COLS = {
  initiativeName: "jira initiative name",
  epicKey: "epic",
  epicName: "jira epic name",
} as const;
