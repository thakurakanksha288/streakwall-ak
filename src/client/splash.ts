import {requestExpandedMode} from '@devvit/web/client'
import type {MosaicRsp} from '../shared/api.ts'
import {getMoodBackground} from './moodColor.ts'

async function init(): Promise<void> {
  const cardEl = document.getElementById('card') as HTMLElement
  const promptEl = document.getElementById('prompt') as HTMLParagraphElement
  const progressEl = document.getElementById('progress') as HTMLParagraphElement
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement

  try {
    const res = await fetch('/api/mosaic')
    const mosaic = (await res.json()) as MosaicRsp
    promptEl.textContent = `"${mosaic.prompt}"`
    progressEl.textContent = `${mosaic.completedPercent}% painted · ${mosaic.participantCount} redditors today`
    cardEl.style.background = getMoodBackground(mosaic.prompt)
  } catch {
    promptEl.textContent = 'A daily pixel mosaic — paint a few tiles!'
  }

  startBtn.addEventListener('click', ev => requestExpandedMode(ev, 'game'))
}

void init()