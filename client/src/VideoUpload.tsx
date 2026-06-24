import { useEffect, useMemo, useRef, useState } from "react";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import Dashboard from "@uppy/react/dashboard";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

import { endpoints } from "@/lib/endpoints";
import { CollectionPicker } from "@/components/CollectionPicker";
import { CreateCollection } from "@/components/CreateCollection";
import { invalidateUploads } from "@/query";

const VideoUpload = () => {
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const selectedCollectionIdRef = useRef(selectedCollectionId);

  useEffect(() => {
    selectedCollectionIdRef.current = selectedCollectionId;
  }, [selectedCollectionId]);

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
      removeFingerprintOnSuccess: true,
    });

    instance.on("file-added", (file) => {
      const collectionId = selectedCollectionIdRef.current;
      if (collectionId) {
        instance.setFileMeta(file.id, { collectionId });
      }
    });

    instance.on("complete", () => {
      void invalidateUploads();
    });

    return instance;
  }, []);

  useEffect(() => {
    if (!selectedCollectionId) {
      return;
    }

    for (const file of uppy.getFiles()) {
      uppy.setFileMeta(file.id, { collectionId: selectedCollectionId });
    }
  }, [selectedCollectionId, uppy]);

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
          connection drops. Completed uploads are stored on RustFS via tusd and
          assigned to the selected collection.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <CollectionPicker
            selectedCollectionId={selectedCollectionId}
            onSelectedCollectionIdChange={setSelectedCollectionId}
            label="Upload to collection"
          />
        </div>
        <CreateCollection
          onCreated={(collection) => {
            setSelectedCollectionId(collection.id);
          }}
        />
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
