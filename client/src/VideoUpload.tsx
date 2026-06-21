import { useEffect, useMemo } from "react";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import Dashboard from "@uppy/react/dashboard";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

import { endpoints } from "@/lib/endpoints";

const VideoUpload = () => {
  const uppy = useMemo(() => {
    const instance = new Uppy({
      id: "video-upload",
      restrictions: {
        maxNumberOfFiles: 5,
        allowedFileTypes: ["video/*"],
      },
      autoProceed: false,
    });

    instance.use(Tus, {
      endpoint: endpoints.tusd,
      retryDelays: [0, 1000, 3000, 5000],
      allowedMetaFields: ["filename", "filetype"],
    });

    return instance;
  }, []);

  useEffect(() => {
    return () => {
      uppy.destroy();
    };
  }, [uppy]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload video</h1>
        <p className="text-sm text-muted-foreground">
          Large files upload in chunks and resume automatically if the
          connection drops. Completed uploads are stored on RustFS via tusd.
        </p>
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
