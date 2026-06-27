import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod/v3";
import { QueryErrorAlert } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type CollectionSummary,
  useCreateCollectionMutation,
} from "@/query";

const createCollectionSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
});

type CreateCollectionValues = z.infer<typeof createCollectionSchema>;

type CreateCollectionProps = {
  onCreated?: (collection: CollectionSummary) => void;
  disabled?: boolean;
};

export const CreateCollection = ({
  onCreated,
  disabled = false,
}: CreateCollectionProps) => {
  const [open, setOpen] = useState(false);
  const createCollectionMutation = useCreateCollectionMutation();
  const form = useForm<CreateCollectionValues>({
    resolver: zodResolver(createCollectionSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = (data: CreateCollectionValues) => {
    createCollectionMutation.mutate(data.name, {
      onSuccess: (collection) => {
        onCreated?.(collection);
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset();
          createCollectionMutation.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
        >
          <PlusIcon />
          New collection
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!createCollectionMutation.isPending}>
        <DialogHeader>
          <DialogTitle>Create collection</DialogTitle>
          <DialogDescription>
            Collections group uploaded files for search and processing.
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-collection-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="collection-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="collection-name"
                  placeholder="e.g. Product demos"
                  disabled={createCollectionMutation.isPending}
                  autoFocus
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : null}
              </Field>
            )}
          />
          {createCollectionMutation.isError ? (
            <QueryErrorAlert
              message={createCollectionMutation.error.message}
              title="Could not create collection"
            />
          ) : null}
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={createCollectionMutation.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-collection-form"
            disabled={createCollectionMutation.isPending}
          >
            {createCollectionMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
