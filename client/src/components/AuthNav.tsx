import { authClient, signInWithGitHub } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const AuthNav = () => {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  if (isPending) {
    return <span className="text-sm text-muted-foreground">…</span>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="size-7 rounded-full"
          />
        ) : null}
        <span className="max-w-40 truncate text-sm text-muted-foreground">
          {user.name ?? user.email}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void authClient.signOut()}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button variant="default" size="sm" onClick={() => void signInWithGitHub()}>
      Sign in with GitHub
    </Button>
  );
};

export default AuthNav;
