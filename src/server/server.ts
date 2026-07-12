import {once} from 'node:events'
import type {IncomingMessage, ServerResponse} from 'node:http'
import {context, reddit} from '@devvit/web/server'
import type {PartialJsonValue, TriggerResponse, UiResponse} from '@devvit/web/shared'
import {
  Endpoint, EndpointMethod, TILE_COUNT, TILES_PER_USER_PER_DAY,
  type Badge, type ErrorRsp, type MosaicRsp, type PlaceTileReq,
  type PromptSuggestionReq, type UserStatusRsp, type LeaderboardRsp, type ActivityRsp,
} from '../shared/api.ts'
import {
  dbAddPromptSuggestion, dbGetUserStatus, dbGetUserTilesUsed,
  dbLoadOrCreateMosaic, dbPlaceTile, dbGetLeaderboard, dbGetActivity, decayAlpha,
} from './db.ts'

type AnyRsp = MosaicRsp | UserStatusRsp | UiResponse | TriggerResponse | ErrorRsp | {ok:boolean} | LeaderboardRsp | ActivityRsp

export async function onReq(reqMsg: IncomingMessage, rspMsg: ServerResponse): Promise<void> {
  try { await route(reqMsg, rspMsg) }
  catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`
    console.error(msg)
    writeJson<ErrorRsp>(500, {error:msg, status:500}, rspMsg)
  }
}

async function route(reqMsg: IncomingMessage, rspMsg: ServerResponse): Promise<void> {
  const endpoint = reqMsg.url?.slice(1) as Endpoint
  const method = EndpointMethod[endpoint]
  let rsp: AnyRsp
  if (method !== reqMsg.method) {
    rsp = {error:'not found', status:404}
  } else {
    switch (endpoint) {
      case Endpoint.GetMosaic:        rsp = await routeGetMosaic(); break
      case Endpoint.PlaceTile:        rsp = await routePlaceTile(reqMsg); break
      case Endpoint.UserStatus:       rsp = await routeUserStatus(); break
      case Endpoint.PromptSuggestion: rsp = await routePromptSuggestion(reqMsg); break
      case Endpoint.GetLeaderboard:   rsp = await routeGetLeaderboard(); break
      case Endpoint.GetActivity:      rsp = await routeGetActivity(); break
      case Endpoint.OnMenuNewPost:    rsp = await routeMenuNewPost(); break
      case Endpoint.OnAppInstall:     rsp = await routeAppInstall(); break
      default: rsp = {error:'not found', status:404}
    }
  }
  writeJson<PartialJsonValue>('status' in rsp ? (rsp as ErrorRsp).status : 200, rsp, rspMsg)
}

async function routeGetMosaic(): Promise<MosaicRsp> {
  const postId = context.postId; if (!postId) throw Error('no postId')
  const mosaic = await dbLoadOrCreateMosaic(postId)
  return {...mosaic, tiles:mosaic.tiles.map(t=>({...t,decay:decayAlpha(t.placedAt)}))}
}

async function routeUserStatus(): Promise<UserStatusRsp> {
  const postId = context.postId; if (!postId) throw Error('no postId')
  const username = await reddit.getCurrentUsername()
  if (!username) return {tilesRemainingToday:0,hasPlayedToday:false,streakDays:0,badges:[],newBadge:null,xp:0,level:1,xpForNext:50}
  const {tilesUsed,streakDays,badges,xp,level,xpForNext} = await dbGetUserStatus(postId, username)
  return {tilesRemainingToday:Math.max(0,TILES_PER_USER_PER_DAY-tilesUsed),hasPlayedToday:tilesUsed>0,streakDays,badges,newBadge:null,xp,level,xpForNext}
}

async function routePlaceTile(reqMsg: IncomingMessage): Promise<MosaicRsp & {newBadge:Badge|null;streakDays:number;xp:number;level:number;xpForNext:number}|ErrorRsp> {
  const postId = context.postId; if (!postId) throw Error('no postId')
  const username = await reddit.getCurrentUsername()
  if (!username) return {error:'not logged in',status:401}
  const req = await readJson<PlaceTileReq>(reqMsg)
  if (typeof req.index!=='number'||req.index<0||req.index>=TILE_COUNT||typeof req.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(req.color))
    return {error:'invalid tile placement',status:400}
  const result = await dbPlaceTile(postId, username, req.index, req.color)
  if ('error' in result) return {error:result.error,status:429}
  return {
    ...result.mosaic,
    tiles:result.mosaic.tiles.map(t=>({...t,decay:decayAlpha(t.placedAt)})),
    newBadge:result.newBadge, streakDays:result.streakDays,
    xp:result.xp, level:result.level, xpForNext:result.xpForNext,
  }
}

async function routePromptSuggestion(reqMsg: IncomingMessage): Promise<{ok:boolean}|ErrorRsp> {
  const postId = context.postId; if (!postId) throw Error('no postId')
  const username = await reddit.getCurrentUsername()
  if (!username) return {error:'not logged in',status:401}
  const req = await readJson<PromptSuggestionReq>(reqMsg)
  if (!req.text||req.text.length<3||req.text.length>80) return {error:'prompt must be 3-80 characters',status:400}
  await dbAddPromptSuggestion(postId, username, req.text)
  return {ok:true}
}

async function routeGetLeaderboard(): Promise<LeaderboardRsp> {
  const postId = context.postId; if (!postId) throw Error('no postId')
  return {entries: await dbGetLeaderboard(postId)}
}

async function routeGetActivity(): Promise<ActivityRsp> {
  const postId = context.postId; if (!postId) throw Error('no postId')
  return {items: await dbGetActivity(postId)}
}

async function routeMenuNewPost(): Promise<UiResponse> {
  const post = await reddit.submitCustomPost({title:'Streak Wall — today\'s mosaic'})
  return {showToast:{text:'Streak Wall post created!',appearance:'success'},navigateTo:post.url}
}

async function routeAppInstall(): Promise<TriggerResponse> { return {} }

async function readJson<T>(reqMsg: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = []
  reqMsg.on('data', chunk => chunks.push(chunk))
  await once(reqMsg,'end')
  return JSON.parse(`${Buffer.concat(chunks)}`)
}

function writeJson<T extends PartialJsonValue>(status: number, json: Readonly<T>, rsp: ServerResponse): void {
  const body = JSON.stringify(json)
  rsp.writeHead(status,{'Content-Length':Buffer.byteLength(body),'Content-Type':'application/json'})
  rsp.end(body)
}