import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod/v3";
import { CollectionPicker } from "@/components/CollectionPicker";
import { PageHelp } from "@/components/layout/page-help";
import { PageShell } from "@/components/layout/page-shell";
import {
  InlineLoadingSkeleton,
  QueryEmptyState,
  QueryErrorAlert,
  SearchResultsSkeleton,
} from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { Search, SlidersHorizontal, PlayCircle } from "lucide-react";

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
    <div className="relative group overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        className="aspect-video w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
        controls
        preload="metadata"
        src={`${src}#t=${startSec},${endSec}`}
      />
    </div>
  );
};

const VideoSearch = () => {
  const [submittedSearch, setSubmittedSearch] = useState<SearchVideosInput | null>(
    null,
  );
  const [showFilters, setShowFilters] = useState(true);

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
    collectionId ? { collectionId, limit: 50 } : { limit: 50 },
  );

  const searchableUploads = useMemo(
    () =>
      (uploadsQuery.data?.uploads ?? []).filter(
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
  const uploadsFetchError = uploadsQuery.isError
    ? uploadsQuery.error.message
    : null;
  const searchFetchError =
    hasSearched && searchQuery.isError ? searchQuery.error.message : null;

  return (
    <PageShell
      title="Search"
      help={
        <PageHelp title="About multimodal search">
          <p>
            Semantic search across multimodal video chunks. Jump to the matching
            moment in the source video.
          </p>
        </PageHelp>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              name="query"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    {...field}
                    id="search-query"
                    type="text"
                    autoComplete="off"
                    className="pl-12 pr-36 h-14 text-lg rounded-md bg-background border-primary/20 focus-visible:ring-primary/30 shadow-inner"
                    placeholder="e.g. person explaining the dashboard..."
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
                      className="h-10 rounded-md px-6 font-medium"
                      disabled={searching || !queryValue.trim()}
                    >
                      {searching ? "Searching…" : "Search"}
                    </Button>
                  </div>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} className="mt-2 pl-4" />
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
                      <FieldLabel htmlFor="collection-filter" className="text-xs uppercase tracking-wider text-muted-foreground">Collection</FieldLabel>
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
                      <FieldLabel htmlFor="upload-filter" className="text-xs uppercase tracking-wider text-muted-foreground">Video</FieldLabel>
                      <Select
                        name={field.name}
                        value={field.value || ALL_VIDEOS_VALUE}
                        onValueChange={(value) =>
                          field.onChange(value === ALL_VIDEOS_VALUE ? "" : value)
                        }
                      >
                        <SelectTrigger
                          id="upload-filter"
                          className="w-full bg-background rounded-xl"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="All indexed videos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_VIDEOS_VALUE}>All indexed videos</SelectItem>
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
                      <FieldLabel htmlFor="result-limit" className="text-xs uppercase tracking-wider text-muted-foreground">Max Results</FieldLabel>
                      <Select
                        name={field.name}
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger
                          id="result-limit"
                          className="w-full bg-background rounded-xl"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20, 50].map((value) => (
                            <SelectItem key={value} value={String(value)}>{value} results</SelectItem>
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

      <div className="min-h-[200px]">
        {uploadsQuery.isPending && searchableUploads.length === 0 ? (
          <InlineLoadingSkeleton className="flex justify-center py-16" />
        ) : null}

        {!uploadsQuery.isPending &&
        !uploadsQuery.isError &&
        searchableUploads.length === 0 ? (
          <QueryEmptyState
            icon={<PlayCircle />}
            title="No indexed videos yet"
            description="Upload and process a video first, then return here to search."
            className="rounded-2xl border bg-muted/30"
          />
        ) : null}

        {uploadsFetchError ? (
          <QueryErrorAlert
            message={uploadsFetchError}
            title="Could not load indexed videos"
            onRetry={() => void uploadsQuery.refetch()}
            className="rounded-2xl"
          />
        ) : null}

        {searchFetchError ? (
          <QueryErrorAlert
            message={searchFetchError}
            title="Search failed"
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
            title="No matching segments"
            description={`No results found for "${submittedSearch?.query}". Try a different query or broaden your filters.`}
            className="rounded-2xl border bg-muted/30"
          />
        ) : null}

        {searchQuery.isFetching && hasSearched && results.length === 0 ? (
          <SearchResultsSkeleton columns={2} />
        ) : null}

        {results.length > 0 ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-lg font-heading font-medium">
                Found {results.length} result{results.length === 1 ? "" : "s"}
              </h2>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2">
              {results.map((result) => (
                <li key={result.segmentId}>
                  <Card className="h-full overflow-hidden transition-all hover:shadow-md border-border/50 hover:border-primary/30 group">
                    <CardContent className="flex flex-col gap-4 p-5">
                      <SegmentVideo
                        src={result.playbackUrl}
                        startSec={result.startSec}
                        endSec={result.endSec}
                      />
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <h3 className="min-w-0 truncate text-lg font-heading font-medium leading-tight group-hover:text-primary transition-colors">
                          {result.filename}
                        </h3>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            {formatScore(result.score)} match
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <PlayCircle className="h-3.5 w-3.5" />
                            {formatTime(result.startSec)}
                          </span>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatTime(result.startSec)}–{formatTime(result.endSec)}
                        </span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>{result.durationSec.toFixed(1)}s duration</span>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
};

export default VideoSearch;
