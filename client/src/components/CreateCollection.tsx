import { FormEvent, useState } from "react";
import { PlusIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type CollectionSummary,
  useCreateCollectionMutation,
} from "@/query";

type CreateCollectionProps = {
  onCreated?: (collection: CollectionSummary) => void;
  disabled?: boolean;
};

export const CreateCollection = ({
  onCreated,
  disabled = false,
}: CreateCollectionProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createCollectionMutation = useCreateCollectionMutation();

  const resetForm = () => {
    setName("");
  };

  const createCollection = (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    createCollectionMutation.mutate(trimmedName, {
      onSuccess: (collection) => {
        onCreated?.(collection);
        setOpen(false);
        resetForm();
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
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
          onSubmit={createCollection}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              placeholder="e.g. Product demos"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={createCollectionMutation.isPending}
              autoFocus
            />
          </div>
          {createCollectionMutation.isError ? (
            <p className="text-sm text-destructive">
              {createCollectionMutation.error.message}
            </p>
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
            disabled={createCollectionMutation.isPending || !name.trim()}
          >
            {createCollectionMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
