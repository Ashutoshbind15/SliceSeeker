import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod/v3";
import { CollectionPicker } from "@/components/CollectionPicker";
import {
  InlineLoadingSkeleton,
  QueryEmptyState,
  QueryErrorAlert,
  SearchResultsSkeleton,
} from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SearchFramesInput,
  useFrameSearchResultsQuery,
  useFrameUploadsQuery,
} from "@/query";
import { Images, Search, SlidersHorizontal, PlayCircle } from "lucide-react";

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

type SeekVideoProps = {
  src: string;
  timestampSec: number;
};

const SeekVideo = ({ src, timestampSec }: SeekVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const seekToTimestamp = () => {
      video.currentTime = timestampSec;
    };

    video.addEventListener("loadedmetadata", seekToTimestamp);
    video.addEventListener("play", seekToTimestamp);

    return () => {
      video.removeEventListener("loadedmetadata", seekToTimestamp);
      video.removeEventListener("play", seekToTimestamp);
    };
  }, [src, timestampSec]);

  return (
    <div className="relative group overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        className="aspect-video w-full sm:w-64 object-cover opacity-90 transition-opacity group-hover:opacity-100"
        controls
        preload="metadata"
        src={`${src}#t=${timestampSec}`}
      />
    </div>
  );
};

const FrameSearch = () => {
  const [submittedSearch, setSubmittedSearch] =
    useState<SearchFramesInput | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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

  const uploadsQuery = useFrameUploadsQuery(
    collectionId ? { collectionId, limit: 50 } : { limit: 50 },
  );

  const searchableUploads = useMemo(
    () =>
      (uploadsQuery.data?.uploads ?? []).filter(
        (upload) => upload.embedding.embedded > 0,
      ),
    [uploadsQuery.data],
  );

  const searchQuery = useFrameSearchResultsQuery(
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
  const uploadsFetchError = uploadsQuery.isError
    ? uploadsQuery.error.message
    : null;
  const searchFetchError =
    hasSearched && searchQuery.isError ? searchQuery.error.message : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="space-y-3 text-center pt-8 pb-4">
        <h1 className="text-4xl font-heading font-semibold tracking-tight flex items-center justify-center gap-3">
          <Images className="h-9 w-9 text-primary" />
          Frame search
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Search still-frame image embeddings with a text query, then jump the
          source video to the matching timestamp.
        </p>
      </div>

      <Card className="border-primary/20 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              name="query"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    {...field}
                    id="frame-search-query"
                    type="text"
                    autoComplete="off"
                    className="pl-12 pr-36 h-14 text-lg rounded-2xl bg-background border-primary/20 focus-visible:ring-primary/30 shadow-inner"
                    placeholder="e.g. red car parked outside a store..."
                    aria-invalid={fieldState.invalid}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full text-muted-foreground hover:text-primary"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <SlidersHorizontal className="h-5 w-5" />
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-10 rounded-xl px-6 font-medium"
                      disabled={searching || !queryValue.trim()}
                    >
                      {searching ? "Searching…" : "Search"}
                    </Button>
                  </div>
                  {fieldState.invalid ? (
                    <FieldError
                      errors={[fieldState.error]}
                      className="mt-2 pl-4"
                    />
                  ) : null}
                </div>
              )}
            />

            {showFilters && (
              <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                <Controller
                  name="collectionId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel
                        htmlFor="frame-collection-filter"
                        className="text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        Collection
                      </FieldLabel>
                      <CollectionPicker
                        selectedCollectionId={field.value}
                        onSelectedCollectionIdChange={field.onChange}
                        label=""
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
                      <FieldLabel
                        htmlFor="frame-upload-filter"
                        className="text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        Video
                      </FieldLabel>
                      <Select
                        name={field.name}
                        value={field.value || ALL_VIDEOS_VALUE}
                        onValueChange={(value) =>
                          field.onChange(
                            value === ALL_VIDEOS_VALUE ? "" : value,
                          )
                        }
                      >
                        <SelectTrigger
                          id="frame-upload-filter"
                          className="w-full bg-background rounded-xl"
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
                      <FieldLabel
                        htmlFor="frame-result-limit"
                        className="text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        Max Results
                      </FieldLabel>
                      <Select
                        name={field.name}
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger
                          id="frame-result-limit"
                          className="w-full bg-background rounded-xl"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20, 50].map((value) => (
                            <SelectItem key={value} value={String(value)}>
                              {value} results
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
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="min-h-[200px]">
        {uploadsQuery.isPending && searchableUploads.length === 0 ? (
          <InlineLoadingSkeleton className="flex justify-center py-16" />
        ) : null}

        {!uploadsQuery.isPending &&
        !uploadsQuery.isError &&
        searchableUploads.length === 0 ? (
          <QueryEmptyState
            icon={<Images />}
            title="No frame-indexed videos yet"
            description="Index frames for a video first, then return here to search by what’s on screen."
            className="rounded-2xl border bg-muted/30"
          />
        ) : null}

        {uploadsFetchError ? (
          <QueryErrorAlert
            message={uploadsFetchError}
            title="Could not load frame-indexed videos"
            onRetry={() => void uploadsQuery.refetch()}
            className="rounded-2xl"
          />
        ) : null}

        {searchFetchError ? (
          <QueryErrorAlert
            message={searchFetchError}
            title="Frame search failed"
            onRetry={() => void searchQuery.refetch()}
            className="rounded-2xl"
          />
        ) : null}

        {hasSearched &&
        !searching &&
        !searchQuery.isError &&
        results.length === 0 ? (
          <QueryEmptyState
            icon={<Search />}
            title="No matching frames"
            description={`No results found for "${submittedSearch?.query}". Try a more visual description.`}
            className="rounded-2xl border bg-muted/30"
          />
        ) : null}

        {searchQuery.isFetching && hasSearched && results.length === 0 ? (
          <SearchResultsSkeleton />
        ) : null}

        {results.length > 0 ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-heading font-medium">
                Found {results.length} result
                {results.length === 1 ? "" : "s"}
              </h2>
            </div>
            <ul className="grid gap-6">
              {results.map((result) => (
                <li key={result.frameId}>
                  <Card className="overflow-hidden transition-all hover:shadow-md border-border/50 hover:border-primary/30 group">
                    <CardContent className="flex flex-col gap-6 p-5 sm:flex-row items-start">
                      <div className="shrink-0 w-full sm:w-auto space-y-3">
                        <div className="overflow-hidden rounded-xl bg-muted">
                          <img
                            src={result.thumbnailUrl}
                            alt={`Frame at ${formatTime(result.timestampSec)}`}
                            className="aspect-video w-full sm:w-64 object-cover"
                          />
                        </div>
                        <SeekVideo
                          src={result.playbackUrl}
                          timestampSec={result.timestampSec}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            {formatScore(result.score)} match
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <PlayCircle className="h-3.5 w-3.5" />{" "}
                            {formatTime(result.timestampSec)}
                          </span>
                        </div>
                        <h3 className="text-lg font-heading font-medium leading-tight group-hover:text-primary transition-colors">
                          {result.filename}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 w-fit px-3 py-1.5 rounded-lg">
                          <span className="font-medium text-foreground">
                            {formatTime(result.timestampSec)}
                          </span>
                          <span className="mx-1 text-muted-foreground/30">
                            |
                          </span>
                          <span>
                            sampled every {result.frameIntervalSec}s
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FrameSearch;
