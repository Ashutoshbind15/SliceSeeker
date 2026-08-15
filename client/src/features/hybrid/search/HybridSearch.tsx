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
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  type HybridModality,
  type SearchHybridInput,
  useHybridSearchResultsQuery,
  useHybridUploadsQuery,
} from "@/query";
import {
  Film,
  Image as ImageIcon,
  Layers,
  Mic,
  PlayCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";

const DEFAULT_LIMIT = 10;
const DEFAULT_RRF_K = 60;
const ALL_VIDEOS_VALUE = "__all__";
const AUTO_PER_MODALITY_VALUE = "__auto__";

const searchFormSchema = z.object({
  query: z.string().trim().min(1, "Enter a search query."),
  collectionId: z.string(),
  uploadId: z.string(),
  limit: z.number().int(),
  perModalityLimit: z.number().int().min(1).max(150).nullable(),
  videoWeight: z.number().min(0),
  speechWeight: z.number().min(0),
  visionWeight: z.number().min(0),
  rrfK: z.number().int().min(1).max(200),
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatRrfScore = (score: number) => score.toFixed(4);

const modalityMeta: Record<
  HybridModality,
  { label: string; icon: typeof Film; className: string }
> = {
  video: {
    label: "video",
    icon: Film,
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  speech: {
    label: "speech",
    icon: Mic,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  vision: {
    label: "vision",
    icon: ImageIcon,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

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

type WeightSliderProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

const WeightSlider = ({ id, label, value, onChange }: WeightSliderProps) => (
  <Field>
    <div className="flex items-center justify-between gap-3">
      <FieldLabel
        htmlFor={id}
        className="text-xs uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </FieldLabel>
      <span className="tabular-nums text-sm font-medium">{value.toFixed(1)}</span>
    </div>
    <Slider
      id={id}
      min={0}
      max={3}
      step={0.1}
      value={[value]}
      onValueChange={(next) => onChange(next[0] ?? value)}
    />
  </Field>
);

const HybridSearch = () => {
  const [submittedSearch, setSubmittedSearch] =
    useState<SearchHybridInput | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      query: "",
      collectionId: "",
      uploadId: "",
      limit: DEFAULT_LIMIT,
      perModalityLimit: null,
      videoWeight: 1,
      speechWeight: 1,
      visionWeight: 1,
      rrfK: DEFAULT_RRF_K,
    },
  });

  const formValues = form.watch();
  const collectionId = formValues.collectionId;
  const queryValue = formValues.query;

  const uploadsQuery = useHybridUploadsQuery(
    collectionId ? { collectionId, limit: 50 } : { limit: 50 },
  );

  const searchableUploads = useMemo(
    () =>
      (uploadsQuery.data?.uploads ?? []).filter(
        (upload) => upload.embedding.embedded > 0,
      ),
    [uploadsQuery.data],
  );

  const searchQuery = useHybridSearchResultsQuery(
    submittedSearch,
    submittedSearch !== null,
  );

  const setUploadId = form.setValue.bind(form, "uploadId");

  useEffect(() => {
    setUploadId("");
  }, [collectionId, setUploadId]);

  const toSearchInput = (data: SearchFormValues): SearchHybridInput => ({
    query: data.query,
    ...(data.uploadId ? { uploadId: data.uploadId } : {}),
    ...(data.collectionId ? { collectionId: data.collectionId } : {}),
    limit: data.limit,
    ...(data.perModalityLimit != null
      ? { perModalityLimit: data.perModalityLimit }
      : {}),
    weights: {
      video: data.videoWeight,
      speech: data.speechWeight,
      vision: data.visionWeight,
    },
    rrfK: data.rrfK,
  });

  const isSearchDirty = useMemo(() => {
    if (!submittedSearch) {
      return false;
    }

    const next = toSearchInput(formValues);
    return (
      next.query !== submittedSearch.query ||
      next.uploadId !== submittedSearch.uploadId ||
      next.collectionId !== submittedSearch.collectionId ||
      next.limit !== submittedSearch.limit ||
      next.perModalityLimit !== submittedSearch.perModalityLimit ||
      next.rrfK !== submittedSearch.rrfK ||
      next.weights.video !== submittedSearch.weights.video ||
      next.weights.speech !== submittedSearch.weights.speech ||
      next.weights.vision !== submittedSearch.weights.vision
    );
  }, [formValues, submittedSearch]);

  const onSubmit = (data: SearchFormValues) => {
    setSubmittedSearch(toSearchInput(data));
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
      title="Hybrid search"
      help={
        <PageHelp title="About hybrid search">
          <p>
            Weighted reciprocal-rank fusion across video, speech, and vision
            embeddings on a shared segment grid.
          </p>
        </PageHelp>
      }
    >
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
                    id="hybrid-search-query"
                    type="text"
                    autoComplete="off"
                    className="pl-12 pr-36 h-14 text-lg rounded-2xl bg-background border-primary/20 focus-visible:ring-primary/30 shadow-inner"
                    placeholder="e.g. person explaining a chart next to a whiteboard..."
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
                      disabled={
                        searching ||
                        !queryValue.trim() ||
                        (hasSearched && !isSearchDirty)
                      }
                    >
                      {searching
                        ? "Searching…"
                        : hasSearched
                          ? "Search again"
                          : "Search"}
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

            {showFilters ? (
              <div className="space-y-4 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-2">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Controller
                    name="collectionId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          htmlFor="hybrid-collection-filter"
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
                          htmlFor="hybrid-upload-filter"
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
                            id="hybrid-upload-filter"
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
                          htmlFor="hybrid-result-limit"
                          className="text-xs uppercase tracking-wider text-muted-foreground"
                        >
                          Max Results
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={String(field.value)}
                          onValueChange={(value) =>
                            field.onChange(Number(value))
                          }
                        >
                          <SelectTrigger
                            id="hybrid-result-limit"
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

                <div className="grid gap-4 sm:grid-cols-3">
                  <Controller
                    name="videoWeight"
                    control={form.control}
                    render={({ field }) => (
                      <WeightSlider
                        id="hybrid-weight-video"
                        label="Video weight"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <Controller
                    name="speechWeight"
                    control={form.control}
                    render={({ field }) => (
                      <WeightSlider
                        id="hybrid-weight-speech"
                        label="Speech weight"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <Controller
                    name="visionWeight"
                    control={form.control}
                    render={({ field }) => (
                      <WeightSlider
                        id="hybrid-weight-vision"
                        label="Vision weight"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="rrfK"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          htmlFor="hybrid-rrf-k"
                          className="text-xs uppercase tracking-wider text-muted-foreground"
                        >
                          RRF k
                        </FieldLabel>
                        <Input
                          {...field}
                          id="hybrid-rrf-k"
                          type="number"
                          min={1}
                          max={200}
                          className="bg-background rounded-xl"
                          onChange={(event) =>
                            field.onChange(Number(event.target.value))
                          }
                        />
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />

                  <Controller
                    name="perModalityLimit"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          htmlFor="hybrid-per-modality-limit"
                          className="text-xs uppercase tracking-wider text-muted-foreground"
                        >
                          Per-modality limit
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={
                            field.value == null
                              ? AUTO_PER_MODALITY_VALUE
                              : String(field.value)
                          }
                          onValueChange={(value) =>
                            field.onChange(
                              value === AUTO_PER_MODALITY_VALUE
                                ? null
                                : Number(value),
                            )
                          }
                        >
                          <SelectTrigger
                            id="hybrid-per-modality-limit"
                            className="w-full bg-background rounded-xl"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={AUTO_PER_MODALITY_VALUE}>
                              Auto (max(limit × 3, 20))
                            </SelectItem>
                            {[20, 30, 50, 100, 150].map((value) => (
                              <SelectItem key={value} value={String(value)}>
                                {value} per modality
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
              </div>
            ) : null}
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
            icon={<Layers />}
            title="No hybrid-indexed videos yet"
            description="Run Hybrid Process on a video first, then return here to fuse modalities with RRF."
            className="rounded-2xl border bg-muted/30"
          />
        ) : null}

        {uploadsFetchError ? (
          <QueryErrorAlert
            message={uploadsFetchError}
            title="Could not load hybrid-indexed videos"
            onRetry={() => void uploadsQuery.refetch()}
            className="rounded-2xl"
          />
        ) : null}

        {searchFetchError ? (
          <QueryErrorAlert
            message={searchFetchError}
            title="Hybrid search failed"
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
            description={`No results found for "${submittedSearch?.query}". Try different weights or a broader query.`}
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
                Found {results.length} result
                {results.length === 1 ? "" : "s"}
              </h2>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2">
              {results.map((result) => (
                <li key={result.segmentId}>
                  <Card className="h-full overflow-hidden transition-all hover:shadow-md border-border/50 hover:border-primary/30 group">
                    <CardContent className="flex flex-col gap-3 p-5">
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
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            RRF {formatRrfScore(result.rrfScore)}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <PlayCircle className="h-3.5 w-3.5" />
                            {formatTime(result.startSec)}
                          </span>
                        </div>
                      </div>
                      {result.sources.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {result.sources.map((source) => {
                            const meta = modalityMeta[source];
                            const Icon = meta.icon;
                            const rank = result.ranks[source];
                            return (
                              <Badge
                                key={source}
                                variant="secondary"
                                className={meta.className}
                              >
                                <Icon className="h-3 w-3" />
                                {meta.label}
                                {rank != null ? ` #${rank}` : ""}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : null}
                      <Separator />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatTime(result.startSec)}–{formatTime(result.endSec)}
                        </span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>segment {result.segmentIndex}</span>
                      </div>
                      {result.text ? (
                        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                          {result.text}
                        </p>
                      ) : null}
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

export default HybridSearch;
