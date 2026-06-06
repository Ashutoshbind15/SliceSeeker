import { createAuthClient } from "better-auth/react";
import { endpoints } from "./endpoints";

export const authClient = createAuthClient({
  baseURL: endpoints.api,
  fetchOptions: {
    credentials: "include",
  },
});

export const signInWithGitHub = async () => {
  await authClient.signIn.social({
    provider: "github",
    callbackURL: window.location.origin,
  });
};
