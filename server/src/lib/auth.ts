import { betterAuth } from "better-auth";
import { drizzleAdapter, type DB } from "better-auth/adapters/drizzle";
import db from "../data/db/index.js";
import {
  account,
  session,
  user,
  verification,
} from "../data/db/schema/auth.js";

export const trustedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  database: drizzleAdapter(db as DB, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  baseURL: process.env.BETTER_AUTH_URL!,
  trustedOrigins,
});
