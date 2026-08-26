export {
  buildWorkspaceLayoutSkeleton,
  presentWorkspaceLayout,
  SPLIT_PERCENT_PROPERTY,
  type WorkspaceLayoutController,
  type WorkspaceLayoutElements,
  type WorkspaceLayoutLabels,
  type WorkspaceLayoutOptions,
} from "./ui/workspace-layout.ts";
export {
  clampSplitPercent,
  defaultSplitPercentForMode,
  DEFAULT_LAYOUT_MODE,
  DEFAULT_SPLIT_PERCENT,
  LAYOUT_MODE_STORAGE_KEY,
  MAX_SPLIT_PERCENT,
  MIN_PANE_WIDTH,
  MIN_SPLIT_PERCENT,
  mirroredSplitOnLayoutChange,
  readLayoutMode,
  readSplitPercent,
  saveLayoutMode,
  saveSplitPercent,
  SPLIT_PERCENT_STORAGE_KEY,
  SPLIT_STEP_PERCENT,
  splitRange,
  type LayoutMode,
} from "./model/layout-mode.ts";
export {
  presentStageColumn,
  type StageColumnController,
  type StageColumnOptions,
} from "./ui/stage-column.ts";
