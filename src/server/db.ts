import {redis} from '@devvit/web/server'
import type {ActivityItem, Badge, LeaderboardEntry, MosaicState, Tile} from '../shared/api.ts'
import {
  BADGE_DEFS,
  TILE_COUNT,
  TILES_PER_USER_PER_DAY,
  DECAY_START_HOURS,
  DECAY_FULL_HOURS,
  XP_PER_TILE,
  XP_STREAK_BONUS,
  xpToLevel,
} from '../shared/api.ts'

const DEFAULT_PROMPTS = [
  'draw your Monday mood',
  'something that made you smile today',
  'your dream weekend, one tile at a time',
  'the weather where you are',
  'a tiny creature nobody has met yet',
]

const PIXEL_ICONS: Record<string, {colors: string[]; grid: number[]}> = {
  sun: {
    colors: ['','#ffca3a','#ff9f3a'],
    grid: [0,0,0,1,1,0,0,0, 0,1,0,1,1,0,1,0, 0,0,1,1,1,1,0,0, 0,1,0,1,1,0,1,0, 0,0,0,1,1,0,0,0],
  },
  tree: {
    colors: ['','#8ac926','#2ec4b6','#8a5a3a'],
    grid: [0,0,0,2,2,0,0,0, 0,0,1,1,1,1,0,0, 0,1,1,1,1,1,1,0, 0,0,0,3,3,0,0,0, 0,0,0,3,3,0,0,0],
  },
  moon: {
    colors: ['','#f4f1de','#ffca3a'],
    grid: [0,0,1,1,0,0,0,0, 0,1,1,1,1,0,0,0, 0,1,1,1,1,0,0,0, 0,1,1,1,1,0,0,0, 0,0,1,1,0,0,0,0],
  },
  heart: {
    colors: ['','#ff595e','#ff6f91'],
    grid: [0,1,1,0,0,1,1,0, 1,1,2,1,1,2,1,1, 1,1,1,1,1,1,1,1, 0,1,1,1,1,1,1,0, 0,0,1,1,1,1,0,0],
  },
  face: {
    colors: ['','#ffca3a','#1a1a1a','#ff595e'],
    grid: [0,1,1,1,1,1,1,0, 1,1,2,1,1,2,1,1, 1,1,1,1,1,1,1,1, 1,1,3,3,3,3,1,1, 0,1,1,1,1,1,1,0],
  },
  cloud: {
    colors: ['','#f4f1de','#1982c4'],
    grid: [0,0,1,1,1,0,0,0, 0,1,1,1,1,1,0,0, 1,1,1,1,1,1,1,0, 2,2,2,2,2,2,2,0, 0,2,2,0,2,2,0,0],
  },
  creature: {
    colors: ['','#6a4c93','#ff6f91','#f4f1de'],
    grid: [0,1,0,0,0,0,1,0, 0,1,1,1,1,1,1,0, 0,1,3,1,1,3,1,0, 0,1,1,2,2,1,1,0, 0,0,1,1,1,1,0,0],
  },
  house: {
    colors: ['','#ff595e','#ffca3a','#8ac926'],
    grid: [0,0,0,1,1,0,0,0, 0,0,1,1,1,1,0,0, 0,1,2,2,2,2,1,0, 0,1,2,3,3,2,1,0, 0,1,2,3,3,2,1,0],
  },
  default: {
    colors: ['','#2ec4b6','#ff6f91','#ffca3a'],
    grid: [0,1,0,0,0,0,2,0, 0,0,1,0,0,2,0,0, 0,0,0,3,3,0,0,0, 0,0,2,0,0,1,0,0, 0,2,0,0,0,0,1,0],
  },
}

function pickIcon(prompt: string): string {
  const l = prompt.toLowerCase()
  if (l.includes('weather') || l.includes('sun') || l.includes('rain')) return 'cloud'
  if (l.includes('tree') || l.includes('growth') || l.includes('garden')) return 'tree'
  if (l.includes('moon') || l.includes('night') || l.includes('dream')) return 'moon'
  if (l.includes('smile') || l.includes('mood') || l.includes('feel') || l.includes('monday')) return 'face'
  if (l.includes('love') || l.includes('heart') || l.includes('happy')) return 'heart'
  if (l.includes('creature') || l.includes('animal') || l.includes('pet')) return 'creature'
  if (l.includes('home') || l.includes('house') || l.includes('weekend')) return 'house'
  return 'default'
}

function generatePromptSVG(prompt: string): string {
  const icon = PIXEL_ICONS[pickIcon(prompt)]
  const cells: string[] = []
  icon.grid.forEach((ci, i) => {
    if (ci === 0) return
    cells.push(`<rect x="${(i%8)*10}" y="${Math.floor(i/8)*10}" width="9" height="9" fill="${icon.colors[ci]}"/>`)
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 50" width="80" height="50" shape-rendering="crispEdges"><rect width="80" height="50" fill="#1e2027"/>${cells.join('')}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

// ---------- keys ----------
export const todayKey = () => new Date().toISOString().slice(0,10)
export const mosaicKey = (p: string, d: string) => `mosaic:${p}:${d}`
export const userTilesKey = (p: string, d: string, u: string) => `usertiles:${p}:${d}:${u}`
export const promptQueueKey = (p: string) => `promptqueue:${p}`
export const userStreakKey = (p: string, u: string) => `streak:${p}:${u}`
export const userBadgesKey = (p: string, u: string) => `badges:${p}:${u}`
export const userXpKey = (p: string, u: string) => `xp:${p}:${u}`
export const leaderboardKey = (p: string) => `leaderboard:${p}`
export const activityKey = (p: string) => `activity:${p}`
export const challengeCounterKey = (p: string) => `challenge:${p}`

export function decayAlpha(placedAt: number | null): number {
  if (!placedAt) return 1
  const h = (Date.now() - placedAt) / 3_600_000
  if (h <= DECAY_START_HOURS) return 1
  if (h >= DECAY_FULL_HOURS) return 0
  return 1 - (h - DECAY_START_HOURS) / (DECAY_FULL_HOURS - DECAY_START_HOURS)
}

// ---------- XP & leaderboard ----------
export async function dbAddXp(
  postId: string,
  username: string,
  amount: number,
): Promise<{xp: number; level: number; xpForNext: number}> {
  const key = userXpKey(postId, username)
  const raw = await redis.get(key)
  const xp = (raw ? parseInt(raw, 10) : 0) + amount
  await redis.set(key, String(xp))
  const {level, xpForNext} = xpToLevel(xp)

  // Update leaderboard entry
  const lbKey = leaderboardKey(postId)
  const lbRaw = await redis.get(lbKey)
  const lb: LeaderboardEntry[] = lbRaw ? JSON.parse(lbRaw) : []
  const existing = lb.find(e => e.username === username)
  if (existing) {
    existing.xp = xp
    existing.level = level
    existing.tilesTotal += 1
  } else {
    lb.push({username, tilesTotal: 1, xp, level, streakDays: 0})
  }
  lb.sort((a, b) => b.xp - a.xp)
  await redis.set(lbKey, JSON.stringify(lb.slice(0, 20)))

  return {xp, level, xpForNext}
}

export async function dbGetLeaderboard(postId: string): Promise<LeaderboardEntry[]> {
  const raw = await redis.get(leaderboardKey(postId))
  return raw ? JSON.parse(raw) : []
}

// ---------- activity feed ----------
export async function dbLogActivity(postId: string, item: ActivityItem): Promise<void> {
  const key = activityKey(postId)
  const raw = await redis.get(key)
  const items: ActivityItem[] = raw ? JSON.parse(raw) : []
  items.unshift(item)
  await redis.set(key, JSON.stringify(items.slice(0, 20)))
}

export async function dbGetActivity(postId: string): Promise<ActivityItem[]> {
  const raw = await redis.get(activityKey(postId))
  return raw ? JSON.parse(raw) : []
}

// ---------- challenge counter ----------
async function dbNextChallengeNumber(postId: string): Promise<number> {
  const key = challengeCounterKey(postId)
  const raw = await redis.get(key)
  const next = (raw ? parseInt(raw, 10) : 0) + 1
  await redis.set(key, String(next))
  return next
}

// ---------- mosaic ----------
export async function dbLoadOrCreateMosaic(postId: string): Promise<MosaicState> {
  const date = todayKey()
  const key = mosaicKey(postId, date)
  const raw = await redis.get(key)
  if (raw) return JSON.parse(raw) as MosaicState

  let prompt = DEFAULT_PROMPTS[new Date().getDate() % DEFAULT_PROMPTS.length]
  const queueRaw = await redis.get(promptQueueKey(postId))
  if (queueRaw) {
    const queue = JSON.parse(queueRaw) as {text: string; votes: number}[]
    if (queue.length > 0) {
      queue.sort((a, b) => b.votes - a.votes)
      prompt = queue[0].text
    }
  }

  const challengeNumber = await dbNextChallengeNumber(postId)
  const tiles: Tile[] = Array.from({length: TILE_COUNT}, () => ({color:null,placedAt:null,placedBy:null}))
  const fresh: MosaicState = {
    date, prompt, promptImage: generatePromptSVG(prompt),
    challengeNumber, tiles, participantCount: 0, completedPercent: 0,
  }
  await redis.set(key, JSON.stringify(fresh))
  return fresh
}

// ---------- streak & badges ----------
export async function dbUpdateStreak(
  postId: string, username: string,
): Promise<{streakDays: number; newBadge: Badge | null}> {
  const key = userStreakKey(postId, username)
  const raw = await redis.get(key)
  const data = raw ? JSON.parse(raw) as {lastDate:string;streakDays:number} : {lastDate:'',streakDays:0}
  const today = todayKey()
  const yesterday = new Date(Date.now()-86_400_000).toISOString().slice(0,10)
  let streakDays = data.lastDate===today ? data.streakDays : data.lastDate===yesterday ? data.streakDays+1 : 1
  await redis.set(key, JSON.stringify({lastDate:today, streakDays}))

  const badgesKey = userBadgesKey(postId, username)
  const badgesRaw = await redis.get(badgesKey)
  const earned: Badge[] = badgesRaw ? JSON.parse(badgesRaw) : []
  const earnedIds = new Set(earned.map(b => b.id))
  let newBadge: Badge | null = null
  for (const def of BADGE_DEFS) {
    if (!earnedIds.has(def.id) && streakDays >= def.streakRequired) {
      newBadge = {id:def.id, label:def.label, emoji:def.emoji, earnedAt:Date.now()}
      earned.push(newBadge)
      await redis.set(badgesKey, JSON.stringify(earned))
      break
    }
  }
  return {streakDays, newBadge}
}

export async function dbGetUserStatus(postId: string, username: string) {
  const date = todayKey()
  const usedRaw = await redis.get(userTilesKey(postId, date, username))
  const tilesUsed = usedRaw ? parseInt(usedRaw,10) : 0
  const streakRaw = await redis.get(userStreakKey(postId, username))
  const streakDays = streakRaw ? JSON.parse(streakRaw).streakDays : 0
  const badgesRaw = await redis.get(userBadgesKey(postId, username))
  const badges: Badge[] = badgesRaw ? JSON.parse(badgesRaw) : []
  const xpRaw = await redis.get(userXpKey(postId, username))
  const xp = xpRaw ? parseInt(xpRaw,10) : 0
  const {level, xpForNext} = xpToLevel(xp)
  return {tilesUsed, streakDays, badges, xp, level, xpForNext}
}

// ---------- place tile ----------
export async function dbPlaceTile(
  postId: string, username: string, index: number, color: string,
): Promise<{mosaic:MosaicState;tilesUsed:number;streakDays:number;newBadge:Badge|null;xp:number;level:number;xpForNext:number}|{error:string}> {
  const date = todayKey()
  const usedKey = userTilesKey(postId, date, username)
  const usedRaw = await redis.get(usedKey)
  const used = usedRaw ? parseInt(usedRaw,10) : 0
  if (used >= TILES_PER_USER_PER_DAY) return {error:'no tiles remaining today'}

  const mosaic = await dbLoadOrCreateMosaic(postId)
  const wasEmpty = mosaic.tiles[index].color === null
  mosaic.tiles[index] = {color, placedAt:Date.now(), placedBy:username}

  // Log activity
  await dbLogActivity(postId, {username, color, tileIndex:index, ts:Date.now()})

  if (wasEmpty) {
    const painted = mosaic.tiles.filter(t => t.color!==null).length
    mosaic.completedPercent = Math.round((painted/TILE_COUNT)*100)

    if (mosaic.completedPercent >= 100) {
      // Archive + reset
      const queueRaw = await redis.get(promptQueueKey(postId))
      const queue = queueRaw
        ? (JSON.parse(queueRaw) as {text:string;votes:number}[]).filter(q => q.text!==mosaic.prompt)
        : []
      await redis.set(promptQueueKey(postId), JSON.stringify(queue))
      const nextPrompt = queue.length>0
        ? queue.sort((a,b)=>b.votes-a.votes)[0].text
        : DEFAULT_PROMPTS[(new Date().getDate()+1)%DEFAULT_PROMPTS.length]
      const challengeNumber = await dbNextChallengeNumber(postId)
      const freshTiles: Tile[] = Array.from({length:TILE_COUNT},()=>({color:null,placedAt:null,placedBy:null}))
      const nextMosaic: MosaicState = {
        date:todayKey(), prompt:nextPrompt, promptImage:generatePromptSVG(nextPrompt),
        challengeNumber, tiles:freshTiles, participantCount:0, completedPercent:0,
      }
      await redis.set(`${mosaicKey(postId,todayKey())}:done`, JSON.stringify(mosaic))
      await redis.set(mosaicKey(postId,todayKey()), JSON.stringify(nextMosaic))
      const xpResult = await dbAddXp(postId, username, XP_PER_TILE)
      return {mosaic:nextMosaic, tilesUsed:used+1, streakDays:0, newBadge:null, ...xpResult}
    }
  }

  if (used===0) mosaic.participantCount += 1
  await redis.set(mosaicKey(postId,date), JSON.stringify(mosaic))
  await redis.set(usedKey, String(used+1))

  const {streakDays, newBadge} = used===0
    ? await dbUpdateStreak(postId, username)
    : {streakDays:0, newBadge:null}

  const streakBonus = (used===0 && streakDays>1) ? XP_STREAK_BONUS : 0
  const xpResult = await dbAddXp(postId, username, XP_PER_TILE + streakBonus)

  // Update streak in leaderboard
  const lbKey = leaderboardKey(postId)
  const lbRaw = await redis.get(lbKey)
  if (lbRaw) {
    const lb: LeaderboardEntry[] = JSON.parse(lbRaw)
    const entry = lb.find(e => e.username===username)
    if (entry) entry.streakDays = streakDays
    await redis.set(lbKey, JSON.stringify(lb))
  }

  return {mosaic, tilesUsed:used+1, streakDays, newBadge, ...xpResult}
}

export async function dbGetUserTilesUsed(postId: string, username: string): Promise<number> {
  const raw = await redis.get(userTilesKey(postId, todayKey(), username))
  return raw ? parseInt(raw,10) : 0
}

export async function dbAddPromptSuggestion(postId: string, username: string, text: string): Promise<void> {
  const key = promptQueueKey(postId)
  const raw = await redis.get(key)
  const queue = raw ? JSON.parse(raw) : []
  queue.push({text, submittedBy:username, votes:1})
  await redis.set(key, JSON.stringify(queue))
}