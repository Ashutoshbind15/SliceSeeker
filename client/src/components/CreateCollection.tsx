import { FormEvent, useState } from "react";
import { PlusIcon } from "lucide-react";
import { endpoints } from "@/lib/endpoints";
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
import type { CollectionSummary } from "@/components/CollectionPicker";

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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setError(null);
  };

  const createCollection = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`${endpoints.api}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      const body = (await response.json().catch(() => null)) as {
        message?: string;
        collection?: CollectionSummary;
      } | null;

      if (!response.ok || !body?.collection) {
        throw new Error(body?.message ?? "Failed to create collection");
      }

      onCreated?.(body.collection);
      setOpen(false);
      resetForm();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create collection",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
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
      <DialogContent showCloseButton={!creating}>
        <DialogHeader>
          <DialogTitle>Create collection</DialogTitle>
          <DialogDescription>
            Collections group uploaded files for search and processing.
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-collection-form"
          onSubmit={(event) => void createCollection(event)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              placeholder="e.g. Product demos"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={creating}
              autoFocus
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={creating}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-collection-form"
            disabled={creating || !name.trim()}
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
