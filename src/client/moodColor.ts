// Maps today's prompt text to a background mood color, so the splash card's
// background reflects the vibe of the actual quote instead of staying fixed.
// Small, deliberately simple: substring keyword matching, first match wins.
// Checked in priority order — multi-word phrases before single words, so
// common daily-prompt phrasing (e.g. "dream weekend") picks the more specific mood.

type Mood = {hue: number; sat: number; light: number}

const MOOD_RULES: {keywords: string[]; hue: number; sat: number; light: number}[] = [
  // multi-word phrases first (more specific than single-word matches below)
  {keywords: ['dream weekend', 'lazy sunday', 'cozy morning'], hue: 32, sat: 45, light: 14},
  {keywords: ['rainy day', 'movie night'], hue: 222, sat: 40, light: 13},

  // single-word / theme groups
  {keywords: ['weekend', 'cozy', 'blanket', 'chill', 'lazy'], hue: 32, sat: 42, light: 14},
  {keywords: ['dream', 'night', 'stars', 'moon', 'sleep'], hue: 250, sat: 40, light: 13},
  {keywords: ['beach', 'ocean', 'summer', 'sun', 'sunny'], hue: 190, sat: 45, light: 14},
  {keywords: ['forest', 'nature', 'garden', 'plant', 'green'], hue: 140, sat: 35, light: 13},
  {keywords: ['love', 'heart', 'crush', 'valentine'], hue: 340, sat: 45, light: 14},
  {keywords: ['rain', 'storm', 'blue monday', 'gloomy'], hue: 212, sat: 40, light: 13},
  {keywords: ['party', 'celebrate', 'festival', 'birthday'], hue: 300, sat: 42, light: 14},
  {keywords: ['fire', 'passion', 'spicy'], hue: 14, sat: 50, light: 14},
]

const DEFAULT_MOOD: Mood = {hue: 230, sat: 18, light: 9} // matches the original #14151a-ish look

export function getMoodForPrompt(prompt: string): Mood {
  const text = prompt.toLowerCase()
  for (const rule of MOOD_RULES) {
    if (rule.keywords.some(k => text.includes(k))) {
      return {hue: rule.hue, sat: rule.sat, light: rule.light}
    }
  }
  return DEFAULT_MOOD
}

/** Returns a CSS background value — a subtle radial tint over a dark base,
 *  so the app stays readable and "night wall"-like at any mood. */
export function getMoodBackground(prompt: string): string {
  const {hue, sat, light} = getMoodForPrompt(prompt)
  return `radial-gradient(120% 140% at 50% -10%, hsl(${hue} ${sat}% ${light + 6}% / 0.55), hsl(${hue} ${Math.max(sat - 10, 8)}% ${light}%))`
}