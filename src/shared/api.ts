export type ErrorRsp = {error: string; status: number}

export type Tile = {
  color: string | null
  placedAt: number | null
  placedBy: string | null
}

export type MosaicState = {
  date: string
  prompt: string
  promptImage: string
  challengeNumber: number
  tiles: Tile[]
  participantCount: number
  completedPercent: number
}

export type MosaicRsp = MosaicState & {
  tiles: (Tile & {decay: number})[]
}

export type Badge = {
  id: 'first-paint' | 'streak-10' | 'streak-25' | 'streak-100'
  label: string
  emoji: string
  earnedAt: number
}

export const BADGE_DEFS: {
  id: Badge['id']
  label: string
  emoji: string
  streakRequired: number
}[] = [
  {id: 'first-paint', label: 'First Stroke',   emoji: '🎨', streakRequired: 1},
  {id: 'streak-10',   label: '10-Day Streak',  emoji: '🔥', streakRequired: 10},
  {id: 'streak-25',   label: '25-Day Streak',  emoji: '⚡', streakRequired: 25},
  {id: 'streak-100',  label: '100-Day Streak', emoji: '👑', streakRequired: 100},
]

export type UserStatusRsp = {
  tilesRemainingToday: number
  hasPlayedToday: boolean
  streakDays: number
  badges: Badge[]
  newBadge: Badge | null
  xp: number
  level: number
  xpForNext: number
}

export type ActivityItem = {
  username: string
  color: string
  tileIndex: number
  ts: number
}

export type LeaderboardEntry = {
  username: string
  tilesTotal: number
  xp: number
  level: number
  streakDays: number
}

export type LeaderboardRsp = {entries: LeaderboardEntry[]}
export type ActivityRsp = {items: ActivityItem[]}

export type PlaceTileReq = {index: number; color: string}
export type PromptSuggestionReq = {text: string}

export const GRID_WIDTH = 16
export const GRID_HEIGHT = 10
export const TILE_COUNT = GRID_WIDTH * GRID_HEIGHT
export const TILES_PER_USER_PER_DAY = 6
export const DECAY_START_HOURS = 8
export const DECAY_FULL_HOURS = 20

export const XP_PER_TILE = 10
export const XP_STREAK_BONUS = 5

export function xpToLevel(xp: number): {level: number; xpForNext: number} {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1
  const xpForNext = Math.pow(level, 2) * 50
  return {level, xpForNext}
}

export type Endpoint = (typeof Endpoint)[keyof typeof Endpoint]
export const Endpoint = {
  GetMosaic:        'api/mosaic',
  PlaceTile:        'api/tile',
  UserStatus:       'api/user-status',
  PromptSuggestion: 'api/prompt-suggestion',
  GetLeaderboard:   'api/leaderboard',
  GetActivity:      'api/activity',
  OnAppInstall:     'internal/on/app/install',
  OnMenuNewPost:    'internal/on/menu/new-post',
} as const

export const EndpointMethod = {
  [Endpoint.GetMosaic]:        'GET',
  [Endpoint.PlaceTile]:        'POST',
  [Endpoint.UserStatus]:       'GET',
  [Endpoint.PromptSuggestion]: 'POST',
  [Endpoint.GetLeaderboard]:   'GET',
  [Endpoint.GetActivity]:      'GET',
  [Endpoint.OnAppInstall]:     'POST',
  [Endpoint.OnMenuNewPost]:    'POST',
} as const satisfies {[endpoint: string]: 'GET' | 'POST'}