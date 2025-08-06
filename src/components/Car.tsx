"use client"
import { forwardRef, useRef, useEffect, useCallback } from "react"
import { RigidBody, RapierRigidBody, CollisionEnterPayload } from "@react-three/rapier"
import { useFrame } from "@react-three/fiber"
import { Vector3, Quaternion } from "three"

type CarProps = {
  onReady?: () => void
  onMovement?: () => void
  onFall?: () => void
  onFinish?: () => void
  onObstacleHit?: () => void
}

const Car = forwardRef<RapierRigidBody, CarProps>(function Car({ onReady, onMovement, onFall, onFinish, onObstacleHit }, ref) {
  const keys = useRef<Record<string, boolean>>({})
  const isReady = useRef(false)
  const hasMovedRef = useRef(false)
  const startPosition = [-25, 3, 0] as const
  
  // Microphone and audio analysis
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const volumeLevelRef = useRef(0)

  // Initialize microphone access
  useEffect(() => {
    const initMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true } 
        })
        
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        analyserRef.current = audioContextRef.current.createAnalyser()
        microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
        
        analyserRef.current.fftSize = 512
        analyserRef.current.smoothingTimeConstant = 0.8
        microphoneRef.current.connect(analyserRef.current)
        
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount) as Uint8Array<ArrayBuffer>
        
        // Start analyzing audio
        const analyzeAudio = () => {
          if (!analyserRef.current || !dataArrayRef.current) return
          
          analyserRef.current.getByteFrequencyData(dataArrayRef.current)
          
          // Calculate average volume from frequency data
          let sum = 0
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i]
          }
          const average = sum / dataArrayRef.current.length
          
          // Normalize to 0-1 range and apply sensitivity
          volumeLevelRef.current = Math.min(average / 128, 1)
          
          requestAnimationFrame(analyzeAudio)
        }
        
        analyzeAudio()
        console.log('Microphone initialized successfully')
      } catch (error) {
        console.warn('Could not access microphone:', error)
        volumeLevelRef.current = 0
      }
    }
    
    initMicrophone()
    
    return () => {
      if (microphoneRef.current) {
        microphoneRef.current.disconnect()
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys.current[e.key] = true)
    const up   = (e: KeyboardEvent) => (keys.current[e.key] = false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  const notifyReady = useCallback(() => {
    if (!isReady.current && onReady && ref && typeof ref !== 'function' && ref.current) {
      isReady.current = true
      onReady()
      console.log('Car ready and physics initialized')
    }
  }, [onReady, ref])

  useFrame(() => {
    if (!ref || typeof ref === 'function' || !ref.current) return
    
    // Notify ready on first successful access
    notifyReady()
    
    const position = ref.current.translation()
    const rotation = ref.current.rotation()
    const isMoving = keys.current.ArrowUp || keys.current.ArrowDown || 
                     keys.current.ArrowLeft || keys.current.ArrowRight
    
    // Detect first movement
    if (isMoving && !hasMovedRef.current) {
      hasMovedRef.current = true
      onMovement?.()
    }
    
    // Fall detection (below track level - more sensitive for thinner track)
    if (position.y < -2) {
      onFall?.()
      // Reset position and clear all momentum
      ref.current.setTranslation({ x: startPosition[0], y: startPosition[1], z: startPosition[2] }, true)
      ref.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      ref.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      ref.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true) // Reset rotation
      hasMovedRef.current = false
    }
    
    // Finish line detection (reaching the end at x = 25)
    if (hasMovedRef.current && 
        position.x > 24 && 
        position.y > -1) {
      onFinish?.()
      hasMovedRef.current = false
    }
    
    // Calculate forward direction using quaternion rotation
    const quaternion = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    const forwardVector = new Vector3(0, 0, -1) // Default forward direction in Three.js
    forwardVector.applyQuaternion(quaternion)
    
    // Movement controls with car-relative directions and voice-controlled strength
    const baseImpulseStrength = 0.02
    const voiceMultiplier = 1 + (volumeLevelRef.current * 2) // Voice can double the impulse strength
    const impulseStrength = baseImpulseStrength * voiceMultiplier
    console.log(`impulseStrength: ${impulseStrength.toFixed(3)}, volume: ${volumeLevelRef.current.toFixed(2)}`)
    
    if (keys.current.ArrowUp) {
      ref.current.applyImpulse({ 
        x: -forwardVector.x * impulseStrength * 1.4,
        y: 0, 
        z: -forwardVector.z * impulseStrength * 1.4
      }, true)
    }
    if (keys.current.ArrowDown) {
      ref.current.applyImpulse({ 
        x: forwardVector.x * impulseStrength * 1.4,
        y: 0, 
        z: forwardVector.z * impulseStrength * 1.4
      }, true)
    }
    if (keys.current.ArrowLeft)  ref.current.applyTorqueImpulse({
      x: 0,
      y: impulseStrength - 0.01,
      z: 0
    }, true)
    if (keys.current.ArrowRight) ref.current.applyTorqueImpulse({
      x: 0,
      y: -impulseStrength + 0.01,
      z: 0 },
    true)
  })

  const handleCollision = (event: CollisionEnterPayload) => {
    // Check if we collided with an obstacle (red material indicates obstacle)
    const otherBody = event.other.rigidBody
    if (otherBody && (otherBody.userData as { isObstacle?: boolean })?.isObstacle) {
      onObstacleHit?.()
      // Don't apply impulse here - let the Scene component handle the reset
      // The Scene component will reset position and clear momentum
    }
  }

  return (
    <RigidBody
      ref={ref}
      colliders="cuboid"
      mass={1}
      position={startPosition}
      enabledRotations={[false, true, false]}
      linearDamping={0.5}
      angularDamping={0.5}
      onCollisionEnter={handleCollision}
    >
      <mesh>
        <boxGeometry args={[0.6, 0.3, 1.2]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </RigidBody>
  )
})

export default Car