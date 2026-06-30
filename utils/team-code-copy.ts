import type { GraphData } from "~/utils/flow-preview";

export type TeamCodeCopyItem = {
  id: string;
  label: string;
  code: string;
  groupName: string;
};

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const getTeamCodeCopyCode = (
  teamCode: Record<string, unknown> | undefined,
): string => {
  if (!teamCode || teamCode.enabled !== true) {
    return "";
  }
  const shortCode = normalizeText(teamCode.shortCode);
  const longCode = normalizeText(teamCode.longCode);
  return teamCode.preferred === "short" && shortCode
    ? shortCode
    : longCode || shortCode;
};

export const getTeamCodeCopyItems = (
  graphData?: GraphData | null,
): TeamCodeCopyItem[] => {
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];

  return nodes
    .filter((node) => node?.type === "dynamic-group")
    .map((node) => {
      const groupMeta = node?.properties?.groupMeta;
      if (!groupMeta || groupMeta.groupKind !== "team") {
        return null;
      }

      const code = getTeamCodeCopyCode(groupMeta.teamCode);
      if (!code) {
        return null;
      }

      const label = normalizeText(groupMeta.teamCode?.label) || "复制阵容码";
      const groupName = normalizeText(groupMeta.groupName) || label;

      return {
        id: String(node.id),
        label,
        code,
        groupName,
      };
    })
    .filter((item): item is TeamCodeCopyItem => !!item);
};
