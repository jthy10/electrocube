export type GameSfx =
  | 'hover'
  | 'select'
  | 'collect'
  | 'combo'
  | 'dash'
  | 'pulse'
  | 'hit'
  | 'shield'
  | 'bank'
  | 'countdown'
  | 'start'
  | 'victory'
  | 'defeat'

export interface SfxOptions {
  gain?: number
  pitch?: number
  pan?: number
}

export interface AudioMix {
  master: number
  music: number
  sfx: number
}

interface ToneOptions {
  frequency: number
  endFrequency?: number
  start: number
  duration: number
  gain: number
  type?: OscillatorType
  pan?: number
  bus?: GainNode
}

const SILENCE = 0.0001

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const safeGain = (value: number | undefined, fallback = 1) =>
  Number.isFinite(value) ? clamp(value ?? fallback, 0, 2) : fallback

const midiToFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/**
 * Lazy, dependency-free sci-fi audio. No AudioContext is created until unlock,
 * play, or startMusic is called from a browser interaction.
 */
export class ElectroAudio {
  private context: AudioContext | null = null
  private masterBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private active = true
  private disposed = false
  private mix: AudioMix = { master: 0.72, music: 0.3, sfx: 0.78 }
  private musicRequested = false
  private musicIntensity = 0.25
  private musicTimer: number | null = null
  private musicGeneration = 0
  private musicBar = 0

  get supported() {
    if (typeof window === 'undefined') return false
    const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }
    return Boolean(audioWindow.AudioContext ?? audioWindow.webkitAudioContext)
  }

  get enabled() {
    return this.active
  }

  get currentMix(): Readonly<AudioMix> {
    return { ...this.mix }
  }

  async unlock(): Promise<boolean> {
    if (!this.active || this.disposed) return false
    const context = this.ensureContext()
    if (!context) return false

    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        return false
      }
    }

    const unlocked = context.state === 'running'
    if (unlocked && this.musicRequested) this.resumeMusicLoop()
    return unlocked
  }

  setEnabled(enabled: boolean) {
    this.active = enabled
    const context = this.context
    const masterBus = this.masterBus
    if (!context || !masterBus) return

    this.rampGain(masterBus.gain, enabled ? this.mix.master : SILENCE, 0.05)
    if (!enabled) {
      this.pauseMusicLoop()
    } else {
      void this.unlock()
    }
  }

  toggle() {
    this.setEnabled(!this.active)
    return this.active
  }

  setMix(mix: Partial<AudioMix>) {
    this.mix = {
      master: clamp(mix.master ?? this.mix.master, 0, 1),
      music: clamp(mix.music ?? this.mix.music, 0, 1),
      sfx: clamp(mix.sfx ?? this.mix.sfx, 0, 1),
    }

    if (!this.context) return
    if (this.masterBus) this.rampGain(this.masterBus.gain, this.active ? this.mix.master : SILENCE, 0.04)
    if (this.sfxBus) this.rampGain(this.sfxBus.gain, this.mix.sfx, 0.04)
    if (this.musicBus) {
      this.rampGain(this.musicBus.gain, this.musicRequested ? this.mix.music : SILENCE, 0.1)
    }
  }

  setMusicIntensity(intensity: number) {
    this.musicIntensity = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1)
  }

  play(effect: GameSfx, options: SfxOptions = {}) {
    if (!this.active || this.disposed) return

    const context = this.ensureContext()
    if (!context) return

    const schedule = () => {
      if (context.state !== 'running' || !this.active || this.disposed) return
      this.scheduleEffect(effect, options)
    }

    if (context.state === 'running') schedule()
    else void this.unlock().then((unlocked) => unlocked && schedule())
  }

  startMusic() {
    if (this.disposed) return
    this.musicRequested = true
    void this.unlock().then((unlocked) => {
      if (unlocked) this.resumeMusicLoop()
    })
  }

  stopMusic(fadeSeconds = 0.35) {
    this.musicRequested = false
    this.pauseMusicLoop()
    if (this.context && this.musicBus) {
      this.rampGain(this.musicBus.gain, SILENCE, clamp(fadeSeconds, 0.02, 3))
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.musicRequested = false
    this.pauseMusicLoop()

    const context = this.context
    this.context = null
    this.masterBus = null
    this.sfxBus = null
    this.musicBus = null
    this.noiseBuffer = null

    if (context && context.state !== 'closed') void context.close().catch(() => undefined)
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
    if (!this.supported || this.disposed) return null

    const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }
    const AudioContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext
    if (!AudioContextConstructor) return null

    try {
      const context = new AudioContextConstructor()
      const masterBus = context.createGain()
      const sfxBus = context.createGain()
      const musicBus = context.createGain()
      const compressor = context.createDynamicsCompressor()

      compressor.threshold.value = -12
      compressor.knee.value = 14
      compressor.ratio.value = 7
      compressor.attack.value = 0.003
      compressor.release.value = 0.18

      masterBus.gain.value = this.active ? this.mix.master : SILENCE
      sfxBus.gain.value = this.mix.sfx
      musicBus.gain.value = SILENCE

      sfxBus.connect(compressor)
      musicBus.connect(compressor)
      compressor.connect(masterBus)
      masterBus.connect(context.destination)

      this.context = context
      this.masterBus = masterBus
      this.sfxBus = sfxBus
      this.musicBus = musicBus
      return context
    } catch {
      return null
    }
  }

  private scheduleEffect(effect: GameSfx, options: SfxOptions) {
    const context = this.context
    if (!context) return

    const start = context.currentTime + 0.004
    const gain = safeGain(options.gain)
    const pitch = clamp(options.pitch ?? 1, 0.5, 2)
    const pan = clamp(options.pan ?? 0, -1, 1)
    const tone = (frequency: number, delay: number, duration: number, toneGain: number, type: OscillatorType = 'sine') =>
      this.scheduleTone({
        frequency: frequency * pitch,
        start: start + delay,
        duration,
        gain: toneGain * gain,
        type,
        pan,
      })

    switch (effect) {
      case 'hover':
        this.scheduleTone({
          frequency: 520 * pitch,
          endFrequency: 690 * pitch,
          start,
          duration: 0.045,
          gain: 0.055 * gain,
          type: 'sine',
          pan,
        })
        break
      case 'select':
        tone(260, 0, 0.07, 0.08, 'square')
        tone(520, 0.035, 0.09, 0.075, 'sine')
        break
      case 'collect':
        tone(660, 0, 0.11, 0.09, 'sine')
        tone(880, 0.045, 0.12, 0.08, 'triangle')
        tone(1_320, 0.09, 0.14, 0.06, 'sine')
        break
      case 'combo':
        tone(740, 0, 0.1, 0.075, 'triangle')
        tone(990, 0.05, 0.13, 0.085, 'triangle')
        tone(1_480, 0.1, 0.18, 0.065, 'sine')
        break
      case 'dash':
        this.scheduleTone({
          frequency: 210 * pitch,
          endFrequency: 54 * pitch,
          start,
          duration: 0.22,
          gain: 0.13 * gain,
          type: 'sawtooth',
          pan,
        })
        this.scheduleNoise(start, 0.16, 0.08 * gain, 1_900, 'bandpass', pan)
        break
      case 'pulse':
        this.scheduleTone({
          frequency: 92 * pitch,
          endFrequency: 620 * pitch,
          start,
          duration: 0.26,
          gain: 0.17 * gain,
          type: 'sine',
          pan,
        })
        this.scheduleNoise(start + 0.025, 0.19, 0.1 * gain, 820, 'lowpass', pan)
        break
      case 'hit':
        this.scheduleNoise(start, 0.13, 0.16 * gain, 460, 'lowpass', pan)
        this.scheduleTone({
          frequency: 130 * pitch,
          endFrequency: 62 * pitch,
          start,
          duration: 0.18,
          gain: 0.12 * gain,
          type: 'square',
          pan,
        })
        break
      case 'shield':
        this.scheduleTone({
          frequency: 1_250 * pitch,
          endFrequency: 240 * pitch,
          start,
          duration: 0.35,
          gain: 0.12 * gain,
          type: 'sawtooth',
          pan,
        })
        this.scheduleNoise(start, 0.28, 0.07 * gain, 2_200, 'highpass', pan)
        break
      case 'bank':
        tone(330, 0, 0.2, 0.09, 'triangle')
        tone(495, 0.045, 0.24, 0.075, 'triangle')
        tone(660, 0.09, 0.3, 0.07, 'sine')
        break
      case 'countdown':
        tone(440, 0, 0.12, 0.1, 'square')
        tone(880, 0.018, 0.08, 0.045, 'sine')
        break
      case 'start':
        tone(440, 0, 0.13, 0.1, 'square')
        tone(660, 0.06, 0.16, 0.09, 'triangle')
        tone(990, 0.12, 0.32, 0.11, 'sine')
        break
      case 'victory':
        ;[523, 659, 784, 1_047].forEach((frequency, index) =>
          tone(frequency, index * 0.095, 0.28 + index * 0.035, 0.085, index % 2 ? 'triangle' : 'sine'),
        )
        break
      case 'defeat':
        this.scheduleTone({
          frequency: 330 * pitch,
          endFrequency: 72 * pitch,
          start,
          duration: 0.72,
          gain: 0.13 * gain,
          type: 'sawtooth',
          pan,
        })
        tone(165, 0.18, 0.55, 0.075, 'sine')
        break
    }
  }

  private scheduleTone(options: ToneOptions) {
    const context = this.context
    const bus = options.bus ?? this.sfxBus
    if (!context || !bus) return

    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    const panner = context.createStereoPanner()
    const end = options.start + options.duration
    const peak = Math.max(SILENCE, options.gain)

    oscillator.type = options.type ?? 'sine'
    oscillator.frequency.setValueAtTime(Math.max(20, options.frequency), options.start)
    if (options.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), end)
    }

    panner.pan.value = clamp(options.pan ?? 0, -1, 1)
    envelope.gain.setValueAtTime(SILENCE, options.start)
    envelope.gain.exponentialRampToValueAtTime(peak, options.start + Math.min(0.018, options.duration * 0.25))
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end)

    oscillator.connect(envelope)
    envelope.connect(panner)
    panner.connect(bus)
    oscillator.start(options.start)
    oscillator.stop(end + 0.03)
  }

  private scheduleNoise(
    start: number,
    duration: number,
    gain: number,
    frequency: number,
    filterType: BiquadFilterType,
    pan: number,
    bus = this.sfxBus,
  ) {
    const context = this.context
    if (!context || !bus) return

    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const envelope = context.createGain()
    const panner = context.createStereoPanner()
    const end = start + duration

    source.buffer = this.getNoiseBuffer(context)
    filter.type = filterType
    filter.frequency.value = frequency
    filter.Q.value = filterType === 'bandpass' ? 1.6 : 0.7
    panner.pan.value = clamp(pan, -1, 1)

    envelope.gain.setValueAtTime(Math.max(SILENCE, gain), start)
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end)

    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(panner)
    panner.connect(bus)
    source.start(start)
    source.stop(end + 0.02)
  }

  private getNoiseBuffer(context: AudioContext) {
    if (this.noiseBuffer) return this.noiseBuffer

    const length = Math.floor(context.sampleRate * 0.5)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1
    }
    this.noiseBuffer = buffer
    return buffer
  }

  private resumeMusicLoop() {
    const context = this.context
    const musicBus = this.musicBus
    if (!context || !musicBus || !this.active || !this.musicRequested || this.musicTimer !== null) return

    this.rampGain(musicBus.gain, this.mix.music, 0.25)
    this.musicGeneration += 1
    this.scheduleMusicBar(this.musicGeneration)
  }

  private pauseMusicLoop() {
    this.musicGeneration += 1
    if (this.musicTimer !== null && typeof window !== 'undefined') window.clearTimeout(this.musicTimer)
    this.musicTimer = null
    if (this.context && this.musicBus) this.rampGain(this.musicBus.gain, SILENCE, 0.18)
  }

  private scheduleMusicBar(generation: number) {
    const context = this.context
    const bus = this.musicBus
    if (
      !context ||
      !bus ||
      generation !== this.musicGeneration ||
      !this.musicRequested ||
      !this.active
    ) {
      this.musicTimer = null
      return
    }

    const tempo = 108 + this.musicIntensity * 34
    const stepDuration = 30 / tempo
    const barStart = context.currentTime + 0.06
    const bassPattern = [38, 38, 41, 38, 46, 43, 41, 36]
    const leadPattern = [74, 77, 81, 79, 74, 82, 81, 77]

    for (let step = 0; step < 8; step += 1) {
      const start = barStart + step * stepDuration
      const bassMidi = bassPattern[(step + this.musicBar * 2) % bassPattern.length]

      if (step % 2 === 0) {
        this.scheduleTone({
          frequency: midiToFrequency(bassMidi),
          endFrequency: midiToFrequency(bassMidi - 5),
          start,
          duration: stepDuration * 1.7,
          gain: 0.095,
          type: 'sawtooth',
          pan: -0.08,
          bus,
        })
      }

      if (step % 2 === 1 || this.musicIntensity > 0.7) {
        this.scheduleNoise(start, stepDuration * 0.28, 0.018 + this.musicIntensity * 0.016, 5_600, 'highpass', 0.22, bus)
      }

      if ((step + this.musicBar) % 3 === 0 && (this.musicIntensity > 0.18 || step === 0)) {
        const leadMidi = leadPattern[(step + this.musicBar) % leadPattern.length]
        this.scheduleTone({
          frequency: midiToFrequency(leadMidi),
          start: start + stepDuration * 0.08,
          duration: stepDuration * 0.78,
          gain: 0.025 + this.musicIntensity * 0.025,
          type: 'triangle',
          pan: step % 2 ? 0.34 : -0.34,
          bus,
        })
      }

      if (step === 0 || step === 4) {
        this.scheduleTone({
          frequency: 78,
          endFrequency: 42,
          start,
          duration: 0.16,
          gain: 0.12,
          type: 'sine',
          bus,
        })
      }
    }

    this.musicBar = (this.musicBar + 1) % 64
    const barMilliseconds = stepDuration * 8 * 1_000
    this.musicTimer = window.setTimeout(() => {
      this.musicTimer = null
      this.scheduleMusicBar(generation)
    }, Math.max(120, barMilliseconds - 100))
  }

  private rampGain(parameter: AudioParam, target: number, duration: number) {
    const context = this.context
    if (!context) return

    const now = context.currentTime
    parameter.cancelScheduledValues(now)
    parameter.setValueAtTime(Math.max(SILENCE, parameter.value), now)
    parameter.exponentialRampToValueAtTime(Math.max(SILENCE, target), now + duration)
  }
}

/** Shared game audio instance; construction is silent and browser-safe. */
export const gameAudio = new ElectroAudio()

