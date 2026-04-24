import type { PlayerHistoryItem } from "./types";

// 统一清洗 profileId 历史列表：去重、裁剪空值，并按最近使用时间排序
export const normalizeProfileHistory = (history?: PlayerHistoryItem[]) => {
  const source = Array.isArray(history) ? history : [];
  const dedupMap = new Map<string, PlayerHistoryItem>();

  source.forEach((item) => {
    const profileId = String(item?.profileId ?? "").trim();
    if (!profileId) {
      return;
    }

    const prev = dedupMap.get(profileId);
    const currentTime = typeof item?.lastUsedAt === "number" ? item.lastUsedAt : 0;
    const prevTime = typeof prev?.lastUsedAt === "number" ? prev.lastUsedAt : 0;

    if (!prev || currentTime >= prevTime) {
      dedupMap.set(profileId, {
        profileId,
        name: String(item?.name ?? "").trim() || undefined,
        lastUsedAt: currentTime || undefined,
      });
    }
  });

  return [...dedupMap.values()]
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, 20);
};

// 向历史列表中插入或刷新指定 profileId，保持与设置页、主页面一致的更新规则
export const upsertProfileHistory = (
  history: PlayerHistoryItem[] | undefined,
  profileId: string,
  name?: string
) => {
  const normalizedId = String(profileId ?? "").trim();
  const normalizedHistory = normalizeProfileHistory(history);

  if (!normalizedId) {
    return normalizedHistory;
  }

  const normalizedName = String(name ?? "").trim();
  const currentItem = normalizedHistory.find((item) => item.profileId === normalizedId);
  const nextHistory = normalizedHistory.filter((item) => item.profileId !== normalizedId);

  nextHistory.unshift({
    profileId: normalizedId,
    name: normalizedName || currentItem?.name,
    lastUsedAt: Date.now(),
  });

  return normalizeProfileHistory(nextHistory);
};
