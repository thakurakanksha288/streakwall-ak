import type {ActivityItem, Badge, LeaderboardEntry, MosaicRsp, UserStatusRsp} from '../shared/api.ts'
import {BADGE_DEFS, GRID_WIDTH, TILE_COUNT, TILES_PER_USER_PER_DAY} from '../shared/api.ts'

const PALETTE = ['#ff595e','#ffca3a','#8ac926','#1982c4','#6a4c93','#ff6f91','#2ec4b6','#f4f1de']
const COLOR_NAMES: Record<string,string> = {
  '#ff595e':'Coral','#ffca3a':'Gold','#8ac926':'Lime',
  '#1982c4':'Blue','#6a4c93':'Purple','#ff6f91':'Pink',
  '#2ec4b6':'Teal','#f4f1de':'Cream',
}
const BADGE_COLOR_CLASS: Record<string,string> = {
  'first-paint':'b-first','streak-10':'b-10','streak-25':'b-25','streak-100':'b-100',
}

// ---------- pixel art icons (client-side, no Buffer needed) ----------
const PIXEL_ICONS: Record<string,{colors:string[];grid:number[]}> = {
  sun:{colors:['','#ffca3a','#ff9f3a'],grid:[0,0,0,1,1,0,0,0,0,1,0,1,1,0,1,0,0,0,1,1,1,1,0,0,0,1,0,1,1,0,1,0,0,0,0,1,1,0,0,0]},
  tree:{colors:['','#8ac926','#2ec4b6','#8a5a3a'],grid:[0,0,0,2,2,0,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,1,0,0,0,0,3,3,0,0,0,0,0,0,3,3,0,0,0]},
  moon:{colors:['','#f4f1de','#ffca3a'],grid:[0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,0,0,0,0]},
  heart:{colors:['','#ff595e','#ff6f91'],grid:[0,1,1,0,0,1,1,0,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0]},
  face:{colors:['','#ffca3a','#1a1a1a','#ff595e'],grid:[0,1,1,1,1,1,1,0,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,3,3,3,3,1,1,0,1,1,1,1,1,1,0]},
  cloud:{colors:['','#f4f1de','#1982c4'],grid:[0,0,1,1,1,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1,1,1,0,2,2,2,2,2,2,2,0,0,2,2,0,2,2,0,0]},
  creature:{colors:['','#6a4c93','#ff6f91','#f4f1de'],grid:[0,1,0,0,0,0,1,0,0,1,1,1,1,1,1,0,0,1,3,1,1,3,1,0,0,1,1,2,2,1,1,0,0,0,1,1,1,1,0,0]},
  house:{colors:['','#ff595e','#ffca3a','#8ac926'],grid:[0,0,0,1,1,0,0,0,0,0,1,1,1,1,0,0,0,1,2,2,2,2,1,0,0,1,2,3,3,2,1,0,0,1,2,3,3,2,1,0]},
  default:{colors:['','#2ec4b6','#ff6f91','#ffca3a'],grid:[0,1,0,0,0,0,2,0,0,0,1,0,0,2,0,0,0,0,0,3,3,0,0,0,0,0,2,0,0,1,0,0,0,2,0,0,0,0,1,0]},
}

function pickIcon(prompt: string): string {
  const l = prompt.toLowerCase()
  if (l.includes('weather')||l.includes('sun')||l.includes('rain')) return 'cloud'
  if (l.includes('tree')||l.includes('growth')||l.includes('garden')) return 'tree'
  if (l.includes('moon')||l.includes('night')||l.includes('dream')) return 'moon'
  if (l.includes('smile')||l.includes('mood')||l.includes('feel')||l.includes('monday')) return 'face'
  if (l.includes('love')||l.includes('heart')||l.includes('happy')) return 'heart'
  if (l.includes('creature')||l.includes('animal')||l.includes('pet')) return 'creature'
  if (l.includes('home')||l.includes('house')||l.includes('weekend')) return 'house'
  return 'default'
}

function drawInspireCanvas(prompt: string): void {
  const canvas = document.getElementById('inspire-canvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const icon = PIXEL_ICONS[pickIcon(prompt)]
  ctx.fillStyle = '#1e2027'
  ctx.fillRect(0,0,80,50)
  icon.grid.forEach((ci,i) => {
    if (ci===0) return
    const x = (i%8)*10
    const y = Math.floor(i/8)*10
    ctx.fillStyle = icon.colors[ci]
    ctx.fillRect(x,y,9,9)
  })
}

// ---------- DOM refs ----------
const canvas = document.getElementById('mosaic-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const promptEl = document.getElementById('prompt-text') as HTMLParagraphElement
const challengeEl = document.getElementById('challenge-num') as HTMLSpanElement
const tilesLeftEl = document.getElementById('tiles-left') as HTMLSpanElement
const participantsEl = document.getElementById('participants') as HTMLSpanElement
const streakEl = document.getElementById('streak') as HTMLSpanElement
const xpBarFill = document.getElementById('xp-bar-fill') as HTMLDivElement
const xpLabel = document.getElementById('xp-label') as HTMLSpanElement
const levelEl = document.getElementById('level-badge') as HTMLSpanElement
const paletteEl = document.getElementById('palette') as HTMLDivElement
const colorNameEl = document.getElementById('color-name') as HTMLSpanElement
const badgeShelf = document.getElementById('badge-shelf') as HTMLDivElement
const toast = document.getElementById('badge-toast') as HTMLDivElement
const activityList = document.getElementById('activity-list') as HTMLUListElement
const lbList = document.getElementById('lb-list') as HTMLOListElement
const completionScreen = document.getElementById('completion-screen') as HTMLDivElement
const completionStats = document.getElementById('completion-stats') as HTMLDivElement

let mosaic: MosaicRsp | null = null
let tilesRemaining = TILES_PER_USER_PER_DAY
let selectedColor = PALETTE[0]
let cellSize = 32
let hoveredIndex = -1

// ---------- tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = (btn as HTMLElement).dataset.tab!
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(`tab-${tab}`)?.classList.add('active')
  })
})

// ---------- palette ----------
function buildPalette(): void {
  PALETTE.forEach(color => {
    const swatch = document.createElement('button')
    swatch.className = 'swatch'
    swatch.style.background = color
    swatch.title = COLOR_NAMES[color] ?? color
    swatch.addEventListener('mouseenter', () => { colorNameEl.textContent = COLOR_NAMES[color] ?? color })
    swatch.addEventListener('mouseleave', () => { colorNameEl.textContent = COLOR_NAMES[selectedColor] ?? '' })
    swatch.addEventListener('click', () => {
      selectedColor = color
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'))
      swatch.classList.add('active')
      colorNameEl.textContent = COLOR_NAMES[color] ?? color
    })
    paletteEl.appendChild(swatch)
  })
  ;(paletteEl.firstChild as HTMLElement).classList.add('active')
  colorNameEl.textContent = COLOR_NAMES[PALETTE[0]]
}

// ---------- canvas ----------
function resizeCanvas(): void {
  const maxWidth = Math.min(window.innerWidth - 110, 540)
  cellSize = Math.floor(maxWidth / GRID_WIDTH)
  canvas.width = cellSize * GRID_WIDTH
  canvas.height = cellSize * Math.ceil(TILE_COUNT / GRID_WIDTH)
}

function draw(): void {
  if (!mosaic) return
  ctx.clearRect(0,0,canvas.width,canvas.height)
  mosaic.tiles.forEach((tile,i) => {
    const x = (i%GRID_WIDTH)*cellSize
    const y = Math.floor(i/GRID_WIDTH)*cellSize
    const isHovered = i===hoveredIndex
    if (tile.color) {
      ctx.globalAlpha = Math.max(0.15,tile.decay)
      ctx.fillStyle = tile.color
      ctx.fillRect(x,y,cellSize-1,cellSize-1)
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = isHovered ? 'rgba(255,111,145,0.25)' : 'rgba(255,255,255,0.06)'
      ctx.fillRect(x,y,cellSize-1,cellSize-1)
    }
    if (isHovered) {
      ctx.strokeStyle = selectedColor
      ctx.lineWidth = 2
      ctx.strokeRect(x+1,y+1,cellSize-3,cellSize-3)
    }
  })
}

function animateTile(index: number, color: string): void {
  const x = (index%GRID_WIDTH)*cellSize
  const y = Math.floor(index/GRID_WIDTH)*cellSize
  let frame = 0
  const animate = () => {
    if (frame>=8) return
    const scale = 1+0.3*Math.sin((frame/8)*Math.PI)
    const off = (cellSize*(scale-1))/2
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9
    ctx.fillRect(x-off,y-off,cellSize*scale-1,cellSize*scale-1)
    ctx.globalAlpha = 1
    frame++
    requestAnimationFrame(animate)
  }
  requestAnimationFrame(animate)
}

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect()
  const index = Math.floor((e.clientY-rect.top)/cellSize)*GRID_WIDTH+Math.floor((e.clientX-rect.left)/cellSize)
  if (index!==hoveredIndex) { hoveredIndex=index; draw() }
})
canvas.addEventListener('mouseleave', () => { hoveredIndex=-1; draw() })
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect()
  const index = Math.floor((e.clientY-rect.top)/cellSize)*GRID_WIDTH+Math.floor((e.clientX-rect.left)/cellSize)
  if (index>=0&&index<TILE_COUNT) void placeTile(index)
})

// ---------- badge shelf ----------
function renderBadgeShelf(earned: Badge[]): void {
  badgeShelf.innerHTML = ''
  const earnedIds = new Set(earned.map(b=>b.id))
  BADGE_DEFS.forEach(def => {
    const item = document.createElement('div')
    const cls = BADGE_COLOR_CLASS[def.id] ?? ''
    item.className = 'badge-item '+(earnedIds.has(def.id)?`earned ${cls}`:'locked')
    item.title = earnedIds.has(def.id)?def.label:`${def.label} (locked)`
    item.innerHTML = `<span class="badge-emoji">${def.emoji}</span><span class="badge-label">${def.label}</span>`
    badgeShelf.appendChild(item)
  })
}

// ---------- toast ----------
function showToast(msg: string): void {
  toast.innerHTML = msg
  toast.classList.add('show')
  setTimeout(()=>toast.classList.remove('show'),3500)
}

// ---------- XP ----------
function updateXpBar(xp: number, level: number, xpForNext: number): void {
  levelEl.textContent = `Lv${level}`
  xpLabel.textContent = `${xp} / ${xpForNext} XP`
  xpBarFill.style.width = `${Math.min(100,Math.round((xp/xpForNext)*100))}%`
}

// ---------- activity ----------
function renderActivity(items: ActivityItem[]): void {
  if (items.length===0) {
    activityList.innerHTML = '<li class="activity-empty">No activity yet — be the first to paint!</li>'
    return
  }
  activityList.innerHTML = ''
  items.slice(0,8).forEach(item => {
    const li = document.createElement('li')
    li.className = 'activity-item'
    const time = new Date(item.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    li.innerHTML = `<span class="activity-dot" style="background:${item.color}"></span><span class="activity-user">u/${item.username}</span>&nbsp;painted a tile&nbsp;<span class="activity-time">${time}</span>`
    activityList.appendChild(li)
  })
}

// ---------- leaderboard ----------
function renderLeaderboard(entries: LeaderboardEntry[]): void {
  if (entries.length===0) {
    lbList.innerHTML = '<li class="lb-empty">No painters yet — start painting to appear here!</li>'
    return
  }
  lbList.innerHTML = ''
  entries.slice(0,8).forEach((entry,i) => {
    const li = document.createElement('li')
    li.className = 'lb-item'+(i===0?' gold':i===1?' silver':i===2?' bronze':'')
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`
    li.innerHTML = `<span class="lb-rank">${medal}</span><span class="lb-name">u/${entry.username}</span><span class="lb-xp">Lv${entry.level} · ${entry.xp}XP · 🔥${entry.streakDays}</span>`
    lbList.appendChild(li)
  })
}

// ---------- completion ----------
function showCompletionScreen(participantCount: number): void {
  completionStats.innerHTML = `
    <div class="cs-stat">🎨 ${participantCount} redditors collaborated</div>
    <div class="cs-stat">✅ ${TILE_COUNT} tiles painted</div>
    <div class="cs-stat">🔄 New challenge starting now…</div>
  `
  completionScreen.classList.add('show')
  setTimeout(()=>{ completionScreen.classList.remove('show'); void loadAll() },4000)
}

// ---------- API ----------
async function loadMosaic(): Promise<void> {
  const res = await fetch('/api/mosaic')
  mosaic = (await res.json()) as MosaicRsp
  promptEl.textContent = `"${mosaic.prompt}" · ${mosaic.completedPercent}% painted`
  challengeEl.textContent = `Daily Challenge #${mosaic.challengeNumber}`
  participantsEl.textContent = `${mosaic.participantCount} painting today`
  drawInspireCanvas(mosaic.prompt)
  draw()
}

async function loadUserStatus(): Promise<void> {
  const res = await fetch('/api/user-status')
  if (!res.ok) return
  const status = (await res.json()) as UserStatusRsp
  tilesRemaining = status.tilesRemainingToday
  tilesLeftEl.textContent = `${tilesRemaining} tiles left today`
  streakEl.textContent = status.streakDays>0?`🔥 ${status.streakDays}-day streak`:''
  updateXpBar(status.xp, status.level, status.xpForNext)
  renderBadgeShelf(status.badges)
}

async function loadActivity(): Promise<void> {
  const res = await fetch('/api/activity')
  if (res.ok) renderActivity((await res.json()).items)
}

async function loadLeaderboard(): Promise<void> {
  const res = await fetch('/api/leaderboard')
  if (res.ok) renderLeaderboard((await res.json()).entries)
}

async function loadAll(): Promise<void> {
  await Promise.all([loadMosaic(),loadUserStatus(),loadActivity(),loadLeaderboard()])
}

async function placeTile(index: number): Promise<void> {
  if (tilesRemaining<=0) return
  const res = await fetch('/api/tile',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({index,color:selectedColor}),
  })
  if (!res.ok) return
  const data = (await res.json()) as MosaicRsp&{newBadge:Badge|null;streakDays:number;xp:number;level:number;xpForNext:number}
  const prevPercent = mosaic?.completedPercent??0
  mosaic = data
  tilesRemaining -= 1
  tilesLeftEl.textContent = `${tilesRemaining} tiles left today`
  if (data.streakDays>0) streakEl.textContent = `🔥 ${data.streakDays}-day streak`
  updateXpBar(data.xp,data.level,data.xpForNext)
  animateTile(index,selectedColor)
  draw()
  if (data.newBadge) {
    showToast(`${data.newBadge.emoji} <strong>${data.newBadge.label}</strong> unlocked!`)
    await loadUserStatus()
  }
  if (prevPercent<100&&data.completedPercent>=100) showCompletionScreen(data.participantCount)
  void loadActivity()
  void loadLeaderboard()
}

document.getElementById('prompt-submit')?.addEventListener('click', async () => {
  const input = document.getElementById('prompt-input') as HTMLInputElement
  if (!input.value.trim()) return
  await fetch('/api/prompt-suggestion',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:input.value.trim()}),
  })
  input.value=''
  input.placeholder='Thanks — submitted!'
})

async function init(): Promise<void> {
  buildPalette()
  resizeCanvas()
  window.addEventListener('resize',()=>{resizeCanvas();draw()})
  await loadAll()
  setInterval(()=>void loadAll(),10000)
}

void init()