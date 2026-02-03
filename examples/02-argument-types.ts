/**
 * Theme 2: Argument Types
 *
 * Learn different argument types and patterns.
 *
 * Usage:
 *   npx ts-node examples/02-argument-types.ts greet Alice
 *   npx ts-node examples/02-argument-types.ts greet Alice --shout
 *   npx ts-node examples/02-argument-types.ts greet Alice --times 3
 *   npx ts-node examples/02-argument-types.ts search "query" --limit 5 --format json
 *   npx ts-node examples/02-argument-types.ts schedule --date 2026-02-05
 *   npx ts-node examples/02-argument-types.ts help
 */

import { z } from "zod";
import { arg, defineCommand, runCli } from "../dist/index.js";

// =============================================================================
// String Arguments
// =============================================================================

const greet = defineCommand({
  description: "Greet someone with options",
  args: {
    // Positional string argument (required)
    name: arg(z.string(), {
      positional: 0,
      description: "Name to greet",
    }),

    // Named string argument with default
    greeting: arg(z.string().default("Hello"), {
      description: "Greeting word",
    }),

    // Number argument
    times: arg(z.coerce.number().int().default(1), {
      description: "Number of times to greet",
    }),

    // Boolean flag (--shout means true)
    shout: arg(z.boolean().default(false), {
      description: "SHOUT the greeting",
    }),
  },
  handler: async ({ name, greeting, times, shout }) => {
    let message = `${greeting}, ${name}!`;
    if (shout) message = message.toUpperCase();

    const messages = Array(times).fill(message);
    return { messages };
  },
});

// =============================================================================
// Enum Arguments
// =============================================================================

const search = defineCommand({
  description: "Search with format options",
  args: {
    // Positional query
    query: arg(z.string(), {
      positional: 0,
      description: "Search query",
    }),

    // Number with validation
    limit: arg(z.coerce.number().int().min(1).max(100).default(10), {
      description: "Max results (1-100)",
    }),

    // Enum argument
    format: arg(z.enum(["json", "table", "csv"]).default("json"), {
      description: "Output format",
      examples: ["json", "table", "csv"],
    }),

    // Optional string
    filter: arg(z.string().optional(), {
      description: "Filter expression",
    }),
  },
  handler: async ({ query, limit, format, filter }) => {
    // Simulated search results
    const results = [
      { id: 1, title: `Result for "${query}"` },
      { id: 2, title: `Another result` },
    ].slice(0, limit);

    return {
      query,
      format,
      filter: filter ?? null,
      count: results.length,
      results,
    };
  },
});

// =============================================================================
// Date Arguments
// =============================================================================

const schedule = defineCommand({
  description: "Schedule something on a date",
  args: {
    // Date argument (Zod coerces ISO8601 string to Date)
    date: arg(z.coerce.date(), {
      description: "Date (ISO8601 format)",
      examples: ["2026-02-05", "2026-02-05T10:00:00Z"],
    }),

    // Optional time
    time: arg(z.string().optional(), {
      description: "Time (HH:MM)",
      examples: ["10:00", "14:30"],
    }),

    // Description
    title: arg(z.string().default("Untitled"), {
      description: "Event title",
    }),
  },
  handler: async ({ date, time, title }) => {
    return {
      scheduled: {
        title,
        date: date.toISOString().split("T")[0],
        time: time ?? "all-day",
      },
    };
  },
});

// =============================================================================
// Run CLI
// =============================================================================

runCli({
  commands: { greet, search, schedule },
});
