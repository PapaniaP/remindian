// Emoji constants for Obsidian Tasks format
export const ICONS = {
  PRIORITY: {
    HIGHEST: "🔺",
    HIGH: "⏫",
    MEDIUM: "🔼",
    LOW: "🔽",
    LOWEST: "⏬",
  },
  DATE: {
    DUE: "📅",
    SCHEDULED: "⏳",
    START: "🛫",
    COMPLETION: "✅",
  },
  RECURRING: "🔁",
  RECURRING_ALT: "🔂",
};

// FE0F-aware regex patterns — ported from Remindian's SyncTask.swift
// The \uFE0F? handles the optional variation selector that some editors insert after emojis
export const DATE_PATTERNS = {
  DUE: /📅\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
  START: /🛫\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
  SCHEDULED: /⏳\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
  COMPLETED: /✅\uFE0F?\s*(\d{4}-\d{2}-\d{2})/,
};

export const PRIORITY_PATTERNS = {
  HIGHEST: /🔺\uFE0F?/,
  HIGH: /⏫\uFE0F?/,
  MEDIUM: /🔼\uFE0F?/,
  LOW: /🔽\uFE0F?/,
  LOWEST: /⏬\uFE0F?/,
};

// Hierarchical tag support — from Remindian
// Matches: #work, #work/clients, #work/clients/somfy
export const TAG_PATTERN = /#[\w-]+(?:\/[\w-]+)*/g;

// Task checkbox pattern — captures indentation, completion state, and content
export const TASK_REGEX = /^(\s*)[-*+] \[([ xX])\] (.*)/;

// Recurrence patterns — from Remindian
// Emoji-based: 🔁 every week, 🔂 every day when done
export const RECURRENCE_EMOJI_PATTERN =
  /[🔁🔂]\uFE0F?\s*[^📅🛫⏳✅⏫🔼🔽🔺⏬#]*/;

// Plain-text recurrence: "every month on the 1st when done"
export const RECURRENCE_PLAIN_PATTERN =
  /\bevery\s+(?:month|week|day|year|other|january|february|march|april|may|june|july|august|september|october|november|december|\d+\s+days?)\b[^📅🛫⏳✅⏫🔼🔽🔺⏬#]*/i;
