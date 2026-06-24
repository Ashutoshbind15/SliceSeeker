export const toast = (message: string) => {
  const element = document.createElement("div");
  element.textContent = message;
  element.className =
    "fixed bottom-4 right-4 z-50 rounded-md border bg-background px-4 py-2 text-sm shadow-lg";
  document.body.appendChild(element);
  window.setTimeout(() => element.remove(), 3_000);
};
