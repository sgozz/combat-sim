type SoundName = 
  | 'attack'
  | 'hit'
  | 'miss'
  | 'defend'
  | 'move'
  | 'turnStart'
  | 'victory'
  | 'defeat'

type SoundConfig = {
  volume: number
  enabled: boolean
}

const defaultConfig: SoundConfig = {
  volume: 0.5,
  enabled: true,
}

let config: SoundConfig = { ...defaultConfig }
const audioCache = new Map<string, HTMLAudioElement>()

export const setSoundConfig = (newConfig: Partial<SoundConfig>): void => {
  config = { ...config, ...newConfig }
}

export const getSoundConfig = (): SoundConfig => ({ ...config })

export const playSound = (name: SoundName): void => {
  if (!config.enabled) return
  
  const path = `/sounds/${name}.mp3`
  
  let audio = audioCache.get(path)
  if (!audio) {
    audio = new Audio(path)
    audioCache.set(path, audio)
  }
  
  audio.volume = config.volume
  audio.currentTime = 0
  audio.play().catch(() => {})
}

export const preloadSounds = (): void => {
  const sounds: SoundName[] = ['attack', 'hit', 'miss', 'defend', 'move', 'turnStart', 'victory', 'defeat']
  sounds.forEach(name => {
    const path = `/sounds/${name}.mp3`
    const audio = new Audio(path)
    audio.preload = 'auto'
    audioCache.set(path, audio)
  })
}
