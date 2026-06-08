import type { AuthSession } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      session?: AuthSession;
    }
  }
}

export {};
