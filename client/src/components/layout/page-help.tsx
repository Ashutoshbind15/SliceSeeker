import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type PageHelpProps = {
  title: string;
  children: ReactNode;
};

export function PageHelp({ title, children }: PageHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
          aria-label={title}
        >
          <Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <div className="text-muted-foreground">{children}</div>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}
