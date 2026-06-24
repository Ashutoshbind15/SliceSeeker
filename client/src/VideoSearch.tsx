import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod/v3";
import { CollectionPicker } from "@/components/CollectionPicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SearchVideosInput,
  useSearchResultsQuery,
  useUploadsQuery,
} from "@/query";

const DEFAULT_LIMIT = 10;
const ALL_VIDEOS_VALUE = "__all__";

const searchFormSchema = z.object({
  query: z.string().trim().min(1, "Enter a search query."),
  collectionId: z.string(),
  uploadId: z.string(),
  limit: z.number().int(),
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatScore = (score: number) => `${(score * 100).toFixed(1)}%`;

type SegmentVideoProps = {
  src: string;
  startSec: number;
  endSec: number;
};

const SegmentVideo = ({ src, startSec, endSec }: SegmentVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const seekToStart = () => {
      if (video.currentTime < startSec || video.currentTime >= endSec) {
        video.currentTime = startSec;
      }
    };

    const clampPlayback = () => {
      if (video.currentTime >= endSec) {
        video.pause();
        video.currentTime = startSec;
      }
    };

    video.addEventListener("loadedmetadata", seekToStart);
    video.addEventListener("play", seekToStart);
    video.addEventListener("timeupdate", clampPlayback);

    return () => {
      video.removeEventListener("loadedmetadata", seekToStart);
      video.removeEventListener("play", seekToStart);
      video.removeEventListener("timeupdate", clampPlayback);
    };
  }, [src, startSec, endSec]);

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full rounded-md bg-black sm:w-56"
      controls
      preload="metadata"
      src={`${src}#t=${startSec},${endSec}`}
    />
  );
};

const VideoSearch = () => {
  const [submittedSearch, setSubmittedSearch] = useState<SearchVideosInput | null>(
    null,
  );

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      query: "",
      collectionId: "",
      uploadId: "",
      limit: DEFAULT_LIMIT,
    },
  });

  const collectionId = form.watch("collectionId");
  const queryValue = form.watch("query");

  const uploadsQuery = useUploadsQuery(
    collectionId ? { collectionId } : {},
  );

  const searchableUploads = useMemo(
    () =>
      (uploadsQuery.data ?? []).filter(
        (upload) => upload.embedding.embedded > 0,
      ),
    [uploadsQuery.data],
  );

  const searchQuery = useSearchResultsQuery(
    submittedSearch,
    submittedSearch !== null,
  );

  const setUploadId = form.setValue.bind(form, "uploadId");

  useEffect(() => {
    setUploadId("");
  }, [collectionId, setUploadId]);

  const onSubmit = (data: SearchFormValues) => {
    setSubmittedSearch({
      query: data.query,
      ...(data.uploadId ? { uploadId: data.uploadId } : {}),
      ...(data.collectionId ? { collectionId: data.collectionId } : {}),
      limit: data.limit,
    });
  };

  const results = searchQuery.data ?? [];
  const hasSearched = submittedSearch !== null;
  const searching = searchQuery.isFetching && hasSearched;
  const error =
    uploadsQuery.error?.message ?? searchQuery.error?.message ?? null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search video</h1>
        <p className="text-sm text-muted-foreground">
          Search across indexed video segments using semantic embeddings. Results
          are ranked by similarity score with inline playback previews.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Controller
          name="query"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="search-query">Search query</FieldLabel>
              <Input
                {...field}
                id="search-query"
                type="search"
                placeholder="e.g. person explaining the dashboard"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />

        <Controller
          name="collectionId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <CollectionPicker
                selectedCollectionId={field.value}
                onSelectedCollectionIdChange={field.onChange}
                label="Limit to collection"
                includeAllOption
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />

        <Controller
          name="uploadId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="upload-filter">Limit to video</FieldLabel>
              <Select
                name={field.name}
                value={field.value || ALL_VIDEOS_VALUE}
                onValueChange={(value) =>
                  field.onChange(value === ALL_VIDEOS_VALUE ? "" : value)
                }
              >
                <SelectTrigger
                  id="upload-filter"
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue placeholder="All indexed videos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VIDEOS_VALUE}>
                    All indexed videos
                  </SelectItem>
                  {searchableUploads.map((upload) => (
                    <SelectItem key={upload.id} value={upload.id}>
                      {upload.filename}
                      {upload.embedding.total > 0
                        ? ` (${upload.embedding.embedded}/${upload.embedding.total} embedded)`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />

        <Controller
          name="limit"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="result-limit">Max results</FieldLabel>
              <Select
                name={field.name}
                value={String(field.value)}
                onValueChange={(value) => field.onChange(Number(value))}
              >
                <SelectTrigger
                  id="result-limit"
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />

        <Button type="submit" disabled={searching || !queryValue.trim()}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>

      {uploadsQuery.isPending && searchableUploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading indexed videos…</p>
      ) : null}

      {!uploadsQuery.isPending && searchableUploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No indexed videos yet. Upload and process a video first, then return
          here to search.
        </p>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {hasSearched && !searching && !searchQuery.isError && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching segments found for &ldquo;{submittedSearch?.query}&rdquo;.
        </p>
      ) : null}

      {searchQuery.isFetching && hasSearched && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            {results.length} result{results.length === 1 ? "" : "s"}
          </h2>
          <ul className="space-y-4">
            {results.map((result) => (
              <li key={result.segmentId}>
                <Card className="overflow-hidden py-0">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
                    <div className="shrink-0">
                      <SegmentVideo
                        src={result.playbackUrl}
                        startSec={result.startSec}
                        endSec={result.endSec}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {formatScore(result.score)} match
                        </Badge>
                        <span className="text-muted-foreground">
                          Segment {result.chunkIndex + 1}
                        </span>
                      </div>
                      <p className="truncate font-medium">{result.filename}</p>
                      <p className="text-muted-foreground">
                        {formatTime(result.startSec)} – {formatTime(result.endSec)}
                        <span className="mx-1">·</span>
                        {result.durationSec.toFixed(1)}s segment
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default VideoSearch;
