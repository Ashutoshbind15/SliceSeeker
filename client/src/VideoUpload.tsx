import { useEffect, useMemo, useState } from "react";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import Dashboard from "@uppy/react/dashboard";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

import { authClient, signInWithGitHub } from "@/lib/auth-client";
import { endpoints } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";

type UploadLimits = {
  maxFileBytes: number;
  storageUsedBytes: number;
  storageReservedBytes: number;
  storageMaxBytes: number;
};

type UploadGrantResponse = {
  uploadToken: string;
  expiresAt: string;
  limits: UploadLimits;
};

const requestUploadGrant = async (file: ReturnType<Uppy["getFile"]>) => {
  const response = await fetch(`${endpoints.api}/uploads/grant`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      filetype: file.type || "video/mp4",
      size: file.size,
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(error?.message ?? "Failed to request upload grant");
  }

  return (await response.json()) as UploadGrantResponse;
};

const formatBytes = (bytes: number) => {
  const gib = bytes / (1024 * 1024 * 1024);
  return `${gib.toFixed(1)} GiB`;
};

const VideoUpload = () => {
  const { data: session, isPending } = authClient.useSession();
  const [limits, setLimits] = useState<UploadLimits | null>(null);

  const uppy = useMemo(() => {
    const instance = new Uppy({
      id: "video-upload",
      restrictions: {
        maxNumberOfFiles: 5,
        allowedFileTypes: ["video/*"],
      },
      autoProceed: false,
    });

    instance.addPreProcessor(async (fileIDs) => {
      await Promise.all(
        fileIDs.map(async (fileID) => {
          const file = instance.getFile(fileID);
          const grant = await requestUploadGrant(file);
          setLimits(grant.limits);
          instance.setFileMeta(fileID, {
            uploadToken: grant.uploadToken,
          });
        }),
      );
    });

    instance.use(Tus, {
      endpoint: endpoints.tusd,
      retryDelays: [0, 1000, 3000, 5000],
      allowedMetaFields: ["filename", "filetype"],
      async onBeforeRequest(req, file) {
        const token = file.meta.uploadToken;
        if (typeof token !== "string") {
          throw new Error("Missing upload token");
        }

        req.setHeader("Authorization", `Bearer ${token}`);
      },
    });

    return instance;
  }, [session?.user.id]);

  useEffect(() => {
    return () => {
      uppy.destroy();
    };
  }, [uppy]);

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Upload video</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to upload videos. The server issues a short-lived upload
            grant and checks your storage quota before tusd accepts the file.
          </p>
        </div>
        <Button onClick={() => void signInWithGitHub()}>Sign in with GitHub</Button>
      </div>
    );
  }

  const meterTotal = limits
    ? limits.storageUsedBytes + limits.storageReservedBytes
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload video</h1>
        <p className="text-sm text-muted-foreground">
          Large files upload in chunks and resume automatically if the
          connection drops. Each upload is authorized with a server grant before
          tusd stores it on RustFS.
        </p>
        {limits ? (
          <p className="text-xs text-muted-foreground">
            Storage: {formatBytes(meterTotal)} / {formatBytes(limits.storageMaxBytes)}{" "}
            ({formatBytes(limits.storageUsedBytes)} settled,{" "}
            {formatBytes(limits.storageReservedBytes)} reserved) · Max file:{" "}
            {formatBytes(limits.maxFileBytes)}
          </p>
        ) : null}
      </div>

      <Dashboard
        uppy={uppy}
        height={420}
        proudlyDisplayPoweredByUppy={false}
        note="Video files only. Uploads are resumable — you can pause and continue later."
      />
    </div>
  );
};

export default VideoUpload;
