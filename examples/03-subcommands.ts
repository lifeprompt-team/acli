/**
 * Theme 3: Subcommands
 *
 * Learn hierarchical command structure.
 *
 * Usage:
 *   npx ts-node examples/03-subcommands.ts user list
 *   npx ts-node examples/03-subcommands.ts user create alice --email alice@example.com
 *   npx ts-node examples/03-subcommands.ts user delete 1
 *   npx ts-node examples/03-subcommands.ts project list
 *   npx ts-node examples/03-subcommands.ts project create "My Project"
 *   npx ts-node examples/03-subcommands.ts help
 *   npx ts-node examples/03-subcommands.ts help user
 *   npx ts-node examples/03-subcommands.ts help user create
 */

import { z } from "zod";
import { arg, cmd, defineCommand, runCli } from "../dist/index.js";

// =============================================================================
// Mock Data
// =============================================================================

const users = [
  { id: 1, name: "alice", email: "alice@example.com" },
  { id: 2, name: "bob", email: "bob@example.com" },
];

const projects = [
  { id: 1, name: "Project Alpha", owner: 1 },
  { id: 2, name: "Project Beta", owner: 2 },
];

let nextUserId = 3;
let nextProjectId = 3;

// =============================================================================
// User Commands (with subcommands)
// =============================================================================

const user = defineCommand({
  description: "User management",

  // Use subcommands to create hierarchy
  subcommands: {
    // cmd() is an alias for defineCommand() - use it for cleaner nested definitions
    list: cmd({
      description: "List all users",
      args: {
        limit: arg(z.coerce.number().int().default(10), {
          description: "Max users to show",
        }),
      },
      handler: async ({ limit = 10 }) => {
        return {
          count: Math.min(users.length, limit),
          users: users.slice(0, limit),
        };
      },
    }),

    create: cmd({
      description: "Create a new user",
      args: {
        name: arg(z.string().min(1), {
          positional: 0,
          description: "Username",
        }),
        email: arg(z.string().email(), {
          description: "Email address",
        }),
      },
      handler: async ({ name, email }) => {
        const newUser = { id: nextUserId++, name, email };
        users.push(newUser);
        return { message: "User created", user: newUser };
      },
    }),

    get: cmd({
      description: "Get user by ID",
      args: {
        id: arg(z.coerce.number().int(), {
          positional: 0,
          description: "User ID",
        }),
      },
      handler: async ({ id }) => {
        const user = users.find((u) => u.id === id);
        if (!user) throw new Error(`User not found: ${id}`);
        return { user };
      },
    }),

    delete: cmd({
      description: "Delete a user",
      args: {
        id: arg(z.coerce.number().int(), {
          positional: 0,
          description: "User ID to delete",
        }),
      },
      handler: async ({ id }) => {
        const index = users.findIndex((u) => u.id === id);
        if (index === -1) throw new Error(`User not found: ${id}`);
        const deleted = users.splice(index, 1)[0];
        return { message: "User deleted", deleted };
      },
    }),
  },
});

// =============================================================================
// Project Commands
// =============================================================================

const project = defineCommand({
  description: "Project management",
  subcommands: {
    list: cmd({
      description: "List all projects",
      args: {},
      handler: async () => {
        return { count: projects.length, projects };
      },
    }),

    create: cmd({
      description: "Create a new project",
      args: {
        name: arg(z.string().min(1), {
          positional: 0,
          description: "Project name",
        }),
        owner: arg(z.coerce.number().int().default(1), {
          description: "Owner user ID",
        }),
      },
      handler: async ({ name, owner = 1 }) => {
        const newProject = { id: nextProjectId++, name, owner };
        projects.push(newProject);
        return { message: "Project created", project: newProject };
      },
    }),
  },
});

// =============================================================================
// Run CLI
// =============================================================================

runCli({
  commands: { user, project },
});
