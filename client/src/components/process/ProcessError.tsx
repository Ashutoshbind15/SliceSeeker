import { AlertCircle } from "lucide-react";

type ProcessErrorProps = {
  message: string;
};

export const ProcessError = ({ message }: ProcessErrorProps) => (
  <div className="flex w-full min-w-0 items-start gap-2 rounded-lg bg-destructive/8 px-2.5 py-2 text-xs text-destructive">
    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
    <p className="min-w-0 leading-relaxed break-words whitespace-pre-wrap">
      {message}
    </p>
  </div>
);
