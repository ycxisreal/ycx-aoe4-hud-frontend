import type { MatchPlayerView, MatchView } from "../../shared/types";

// 生成展示用模式文案，保持与现有 HUD 输出一致
const formatModeLabel = (kind: string): string => {
  if (!kind) {
    return "UNKNOWN";
  }
  return kind.toUpperCase();
};

// 根据模式类型解析统计字段 key，兼容 rm_* 模式的 elo 统计轨道
const resolveModeStatsKey = (kind: string): string => {
  if (kind.startsWith("rm_")) {
    return `${kind}_elo`;
  }
  return kind;
};

// 将单个接口玩家对象映射为 HUD 展示对象
const mapPlayerView = (
  player: any,
  kind: string,
  selfProfileId: string
): MatchPlayerView => {
  const modeStatsKey = resolveModeStatsKey(kind);
  const modeStats = player?.modes?.[modeStatsKey] ?? {};
  const soloRankStats = player?.modes?.rm_solo ?? {};

  return {
    profileId: String(player?.profile_id ?? ""),
    name: player?.name ?? String(player?.profile_id ?? "--"),
    rating: typeof player?.rating === "number" ? player.rating : undefined,
    elo: typeof player?.mmr === "number" ? player.mmr : undefined,
    maxRating:
      typeof soloRankStats?.max_rating === "number"
        ? soloRankStats.max_rating
        : undefined,
    rankLevel:
      typeof modeStats?.rank_level === "string"
        ? modeStats.rank_level
        : undefined,
    stats: {
      rank: typeof modeStats?.rank === "number" ? modeStats.rank : undefined,
      wins:
        typeof modeStats?.wins_count === "number"
          ? modeStats.wins_count
          : undefined,
      losses:
        typeof modeStats?.losses_count === "number"
          ? modeStats.losses_count
          : undefined,
      winRate:
        typeof modeStats?.win_rate === "number"
          ? modeStats.win_rate
          : undefined,
    },
    isSelf: String(player?.profile_id ?? "") === selfProfileId,
  };
};

// 将 AoE4World 最近对局数据转换为 HUD 展示结构
export const buildMatchView = (
  data: any,
  selfProfileId: string
): MatchView | null => {
  const kind = String(data?.kind ?? "");
  if (!kind || kind.includes("ffa")) {
    return null;
  }

  const teams = Array.isArray(data?.teams) ? (data.teams as any[][]) : [];
  if (teams.length !== 2) {
    return null;
  }

  const selfTeamIndex = teams.findIndex(
    (team) =>
      Array.isArray(team) &&
      team.some((player) => String(player?.profile_id ?? "") === selfProfileId)
  );
  const leftTeam = selfTeamIndex >= 0 ? teams[selfTeamIndex] : teams[0];
  const rightTeam = selfTeamIndex >= 0 ? teams[1 - selfTeamIndex] : teams[1];

  if (!Array.isArray(leftTeam) || !Array.isArray(rightTeam) || rightTeam.length === 0) {
    return null;
  }

  return {
    kind,
    modeLabel: formatModeLabel(kind),
    ongoing: Boolean(data?.ongoing),
    isSolo: leftTeam.length === 1 && rightTeam.length === 1,
    selfTeam: leftTeam.map((player) => mapPlayerView(player, kind, selfProfileId)),
    enemyTeam: rightTeam.map((player) => mapPlayerView(player, kind, selfProfileId)),
  };
};

// 判断当前对局视图是否缺失关键分数字段，用于触发补拉逻辑
export const hasMissingRatingOrElo = (view: MatchView) => {
  const allPlayers = [...view.selfTeam, ...view.enemyTeam];
  return allPlayers.some(
    (player) => player.rating === undefined || player.elo === undefined
  );
};
