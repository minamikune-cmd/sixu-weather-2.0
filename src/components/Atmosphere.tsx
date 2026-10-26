import { useEffect, useRef } from 'react'
import type { DayPhase, Season, WeatherKind } from '../types/weather'

interface Props {
  season: Season
  phase: DayPhase
  kind: WeatherKind
  animations: boolean
  temperature: number
  windSpeed: number
}

interface Particle {
  x: number; y: number; vx: number; vy: number; size: number
  rotation: number; spin: number; opacity: number; type: string
}

export default function Atmosphere({ season, phase, kind, animations, temperature, windSpeed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let width = 0
    let height = 0
    let frame = 0
    let lastFrame = 0
    let particles: Particle[] = []
    let visible = !document.hidden
    let lightningAt = performance.now() + 7000 + Math.random() * 7000
    let flashUntil = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const active = animations && !reduced
    const mobile = window.innerWidth < 700
    const particleType = kind === 'rain' || kind === 'thunder' ? 'rain'
      : kind === 'snow' ? 'snow'
      : kind === 'clear' && season === 'spring' ? 'petal'
      : kind === 'clear' && season === 'autumn' ? 'leaf'
      : kind === 'clear' && phase === 'night' ? 'star' : 'mote'
    const baseCount = particleType === 'rain' ? 64 : particleType === 'snow' ? 46 : particleType === 'star' ? 52 : 22
    const count = active ? (mobile ? Math.round(baseCount * 0.55) : baseCount) : 0

    const makeParticle = (index: number, initial = true): Particle => {
      const type = particleType
      const star = type === 'star'
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : star ? Math.random() * height * 0.65 : -20 - index * 2,
        vx: type === 'rain' ? 0.7 + windSpeed / 40 : (Math.random() - 0.5) * 0.45,
        vy: type === 'rain' ? 8 + Math.random() * 6 : type === 'snow' ? 0.6 + Math.random() : star ? 0 : 0.25 + Math.random() * 0.5,
        size: type === 'rain' ? 7 + Math.random() * 12 : type === 'petal' || type === 'leaf' ? 3 + Math.random() * 4 : 1 + Math.random() * 2.4,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.035,
        opacity: 0.25 + Math.random() * 0.6,
        type,
      }
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      particles = Array.from({ length: count }, (_, index) => makeParticle(index))
    }

    const drawPetal = (particle: Particle) => {
      context.save()
      context.translate(particle.x, particle.y)
      context.rotate(particle.rotation)
      context.globalAlpha = particle.opacity
      context.fillStyle = particle.type === 'leaf' ? '#e3a14d' : '#ffd2dc'
      context.beginPath()
      context.ellipse(0, 0, particle.size * 1.5, particle.size * 0.7, 0, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    const render = (now: number) => {
      if (!visible || !active) return
      frame = requestAnimationFrame(render)
      if (now - lastFrame < 1000 / 30) return
      lastFrame = now
      context.clearRect(0, 0, width, height)
      const wind = Math.sin(now * 0.00035) * 0.35 + Math.min(windSpeed / 45, 1.4)

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index]
        if (particle.type === 'star') {
          context.globalAlpha = particle.opacity * (0.55 + Math.sin(now * 0.001 + index) * 0.35)
          context.fillStyle = '#e6f0ff'
          context.beginPath()
          context.arc(particle.x, particle.y, particle.size * 0.65, 0, Math.PI * 2)
          context.fill()
          continue
        }
        particle.x += particle.vx + wind * (particle.type === 'rain' ? 0.2 : 1)
        particle.y += particle.vy
        particle.rotation += particle.spin
        if (particle.y > height + 30 || particle.x > width + 40 || particle.x < -40) particles[index] = makeParticle(index, false)
        if (particle.type === 'rain') {
          context.globalAlpha = particle.opacity * 0.65
          context.strokeStyle = '#b9e5f2'
          context.lineWidth = 1
          context.beginPath()
          context.moveTo(particle.x, particle.y)
          context.lineTo(particle.x - wind * 2, particle.y - particle.size)
          context.stroke()
        } else if (particle.type === 'snow') {
          context.globalAlpha = particle.opacity
          context.fillStyle = '#f2f8ff'
          context.beginPath()
          context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          context.fill()
        } else if (particle.type === 'petal' || particle.type === 'leaf') {
          drawPetal(particle)
        } else {
          context.globalAlpha = particle.opacity * 0.25
          context.fillStyle = '#fff6d6'
          context.beginPath()
          context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          context.fill()
        }
      }
      context.globalAlpha = 1
      if (kind === 'thunder' && now > lightningAt) {
        flashUntil = now + 90
        lightningAt = now + 10000 + Math.random() * 9000
      }
      if (now < flashUntil) {
        context.fillStyle = 'rgba(220, 232, 255, 0.13)'
        context.fillRect(0, 0, width, height)
      }
    }

    const onVisibility = () => {
      visible = !document.hidden
      if (visible && active) {
        lastFrame = 0
        frame = requestAnimationFrame(render)
      } else cancelAnimationFrame(frame)
    }
    resize()
    if (active) frame = requestAnimationFrame(render)
    window.addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [season, phase, kind, animations, temperature, windSpeed])

  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="sky-aurora" />
      <div className="cloud cloud-one" />
      <div className="cloud cloud-two" />
      <div className="cloud cloud-three" />
      {(kind === 'fog' || kind === 'overcast' || (season === 'winter' && temperature < 4)) && <div className="mist" />}
      {kind === 'clear' && season === 'summer' && phase === 'day' && temperature >= 28 && animations && <div className="heat-haze" />}
      <canvas ref={canvasRef} className="weather-canvas" />
      <div className="landscape landscape-back" />
      <div className="landscape landscape-front" />
    </div>
  )
}
