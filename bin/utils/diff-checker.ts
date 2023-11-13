export const checkDiffAndRunCommands = (
  commandsOnDiff: string[],
  commandsOnNoDiff: string[],
  folder: "tarpon" | "phytoplankton-console"
): string => {
  return `if git diff --quiet origin/main HEAD -- ${folder}; then ${commandsOnNoDiff.join(
    " && "
  )}; else ${commandsOnDiff.join(" && ")}; fi`;
};
