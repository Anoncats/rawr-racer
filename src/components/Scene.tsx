'use client'
import { Canvas, useThree } from "@react-three/fiber"
import { Physics } from "@react-three/rapier"
import { Stats } from "@react-three/drei"
import React, { useRef, JSX, useEffect, useState, Suspense } from "react"
import Track from "./Track"
import Car from "./Car"
import SideObstacles from "./SideObstacles"
import VerticalObstacles from "./VerticalObstacles"
import { CameraController } from "./CameraController"
import { RapierRigidBody } from "@react-three/rapier"
import { useWriteContract } from 'wagmi'
import storageAbi from "../data/ScoreStorage.json"


class ErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.name}:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

function ContextManager({ setContextLost, setRenderingPaused }: { 
  setContextLost: (lost: boolean) => void
  setRenderingPaused: (paused: boolean) => void
}) {
  const { gl, invalidate, scene, camera } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    let isCleanedUp = false
    
    // Log initial WebGL context state with more details
    const context = gl.getContext()
    // console.log('WebGL initialized:', {
    //   isContextLost: context.isContextLost(),
    //   memoryGeometries: gl.info?.memory?.geometries || 0,
    //   memoryTextures: gl.info?.memory?.textures || 0,
    //   renderer: gl.info?.render || {},
    //   canvasSize: { width: canvas.width, height: canvas.height },
    //   contextAttributes: context.getContextAttributes(),
    //   extensions: context.getSupportedExtensions()?.length || 0,
    //   maxTextures: context.getParameter(context.MAX_TEXTURE_SIZE),
    //   maxViewport: context.getParameter(context.MAX_VIEWPORT_DIMS)
    // })

    // Reduced memory monitoring frequency
    const memoryInterval = setInterval(() => {
      if (isCleanedUp) return
      
      const isLost = gl.getContext().isContextLost()
      if (isLost) {
        console.warn('Context lost detected in monitor')
        return
      }
      
      // Enhanced memory monitoring
      if (gl.info?.memory) {
        const { geometries, textures } = gl.info.memory
        const renderCalls = gl.info?.render?.calls || 0
        const programs = gl.info?.programs?.length || 0
        
        // More aggressive warnings for memory pressure  
        const memoryPressure = geometries > 15 || textures > 15 || programs > 15
        
        if (memoryPressure) {
          console.warn('High memory pressure - pausing rendering:', { 
            geometries, 
            textures, 
            programs,
            renderCalls,
            jsMemory: 'memory' in performance ? 
              'available but type-protected' : 
              'unavailable'
          })
          setRenderingPaused(true)
          
          // Force garbage collection if available
          if ('gc' in window && typeof (window as { gc?: () => void }).gc === 'function') {
            (window as { gc: () => void }).gc()
          }
          
          // Resume after a short pause
          setTimeout(() => {
            console.log('Resuming rendering after memory cleanup')
            setRenderingPaused(false)
            invalidate()
          }, 1000)
        }
      }
    }, 10000)

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      isCleanedUp = true
      setContextLost(true)
      
      // Capture as much debug info as possible before context is fully lost
      const debugInfo = {
        timestamp: new Date().toISOString(),
        eventType: event.type,
        eventTarget: event.target?.constructor?.name || 'unknown',
        geometries: gl.info?.memory?.geometries || 'unavailable',
        textures: gl.info?.memory?.textures || 'unavailable',
        programs: gl.info?.programs?.length || 'unavailable',
        renderCalls: gl.info?.render?.calls || 'unavailable',
        canvasSize: { width: canvas.width, height: canvas.height },
        // Check various WebGL parameters
        webglState: {
          isContextLost: gl.getContext().isContextLost(),
          drawingBufferWidth: gl.getContext().drawingBufferWidth || 'unavailable',
          drawingBufferHeight: gl.getContext().drawingBufferHeight || 'unavailable'
        },
        // Browser/system info
        userAgent: navigator.userAgent,
        memoryInfo: 'memory' in performance ? 'available but type-protected' : 'unavailable'
      }
      
      console.error('WebGL context lost!', debugInfo)
      
      // Clear any ongoing operations
      clearInterval(memoryInterval)
    }

    const handleContextRestored = () => {
      setContextLost(false)
      console.info('WebGL context restored', {
        timestamp: new Date().toISOString(),
        contextLost: gl.getContext().isContextLost()
      })
      invalidate()
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      isCleanedUp = true
      clearInterval(memoryInterval)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [gl, invalidate, scene, camera, setContextLost, setRenderingPaused])

  return null
}

export default function Scene(): JSX.Element {
  const carRef = useRef<RapierRigidBody>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [debugPhysics, setDebugPhysics] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [carReady, setCarReady] = useState(false)
  const [renderingPaused, setRenderingPaused] = useState(false)
  
  // Game state
  const [gameStarted, setGameStarted] = useState(false)
  const [gameFinished, setGameFinished] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [finalTime, setFinalTime] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  // web3
  const { writeContract } = useWriteContract();

  // Timer logic
  useEffect(() => {
    if (!gameStarted || gameFinished || !startTime) return
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now() - startTime)
    }, 10)
    
    return () => clearInterval(interval)
  }, [gameStarted, gameFinished, startTime])

  // Game event handlers
  const handleMovement = () => {
    if (!gameStarted && !gameFinished) {
      setGameStarted(true)
      setStartTime(Date.now())
      console.log('Race started!')
      
      // Play GoKart audio when game starts (only if not already playing)
      if (!audioRef.current || audioRef.current.ended || audioRef.current.paused) {
        audioRef.current = new Audio('/GoKart.mp3')
        audioRef.current.volume = 0.2 // Reduced from 0.5 to 0.2 for microphone clarity
        audioRef.current.play().catch(e => console.warn('Audio play failed:', e))
      }
    }
  }

  const handleFall = () => {
    console.log('Car fell off track - resetting!')
  }

  const handleObstacleHit = () => {
    console.log('Car hit by obstacle - resetting position!')
    // Reset car position and momentum but keep timer running
    if (carRef.current) {
      const startPosition = [-25, 3, 0]
      carRef.current.setTranslation({ x: startPosition[0], y: startPosition[1], z: startPosition[2] }, true)
      carRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      carRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      carRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true) // Reset rotation to upright
    }
  }

  const handleFinish = () => {
    if (gameStarted && !gameFinished) {
      setGameFinished(true)
      setFinalTime(currentTime)
      console.log(`Race finished! Time: ${(currentTime / 1000).toFixed(2)}s`)
      const intTime = Math.floor(currentTime)

      writeContract({
        address: '0x9691531f456289fcf1a50130DD45FFfDFFBCC89c',
        abi: storageAbi,
        functionName: 'store',
        args: [intTime],
      })
      
      // Reset game after 10 seconds
      setTimeout(() => {
        setGameStarted(false)
        setGameFinished(false)
        setStartTime(null)
        setFinalTime(null)
        setCurrentTime(0)
      }, 10000)
    }
  }

  // Toggle debug with 'D' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') {
        setDebugPhysics(prev => !prev)
        console.log('Physics debug:', !debugPhysics)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [debugPhysics])

  // Pass state to ContextManager
  const ContextManagerWithState = () => {
    const contextManagerProps = { setContextLost, setRenderingPaused }
    return <ContextManager {...contextManagerProps} />
  }

  useEffect(() => {
    // Log browser WebGL support
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    
    if (!gl) {
      console.error('WebGL not supported')
      return
    }
    
    console.log('WebGL Support Info:', {
      version: gl.getParameter(gl.VERSION),
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      extensions: gl.getSupportedExtensions()
    })
  }, [])

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Game UI */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 20,
        color: "white",
        fontSize: "24px",
        fontWeight: "bold",
        textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
        fontFamily: "monospace"
      }}>
        {!gameStarted && !gameFinished && "Press arrow keys to start!"}
        {gameStarted && !gameFinished && `Time: ${(currentTime / 1000).toFixed(2)}s`}
        {gameFinished && finalTime && (
          <div>
            <div style={{ color: "#00ff00", fontSize: "32px" }}>🏆 CONGRATULATIONS! 🏆</div>
            <div>Final Time: {(finalTime / 1000).toFixed(2)}s</div>
            <div style={{ fontSize: "16px", marginTop: "10px" }}>Restarting in 3 seconds...</div>
          </div>
        )}
      </div>
      
      <Canvas 
        frameloop={renderingPaused ? 'never' : 'always'}
        style={{ 
          width: "100%", 
          height: "100%", 
          background: "#87CEEB",
          display: "block"
        }} 
        camera={{ fov: 50, position: [5, 3, -3] }}
        shadows={false}
        gl={{ 
          preserveDrawingBuffer: false,
          powerPreference: "default",
          antialias: false,
          alpha: false,
          failIfMajorPerformanceCaveat: false,
          stencil: false,
          depth: true,
          precision: "lowp"
        }}
        onCreated={({ gl, scene, camera, size }) => {
          console.log('Canvas created successfully:', {
            renderer: gl.domElement,
            context: gl.getContext(),
            scene: scene,
            camera: camera,
            contextLost: gl.getContext().isContextLost(),
            canvasSize: size,
            drawingBufferDimensions: {
              width: gl.getContext().drawingBufferWidth,
              height: gl.getContext().drawingBufferHeight
            }
          })
        }}
        onError={(error) => {
          console.error('Canvas error:', error)
        }}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
      >
        <Suspense>

          <ContextManagerWithState />

          {contextLost && (
            <mesh position={[0, 2, 0]}>
              <boxGeometry args={[2, 0.5, 0.1]} />
              <meshBasicMaterial color="red" />
            </mesh>
          )}
          <color attach="background" args={["#87CEEB"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={0.5} />

          <ErrorBoundary name="Physics">
            <Physics
              debug={debugPhysics}
              gravity={[0, -9.81, 0]}
              timeStep="vary"
              paused={false}
            >
              <ErrorBoundary name="Track">
                <Track />
              </ErrorBoundary>
              <ErrorBoundary name="SideObstacles">
                <SideObstacles />
              </ErrorBoundary>
              {/*}
              <ErrorBoundary name="VerticalObstacles">
                <VerticalObstacles />
              </ErrorBoundary> */}
              <ErrorBoundary name="Car">
                <Car 
                  ref={carRef} 
                  onReady={() => setCarReady(true)}
                  onMovement={handleMovement}
                  onFall={handleFall}
                  onFinish={handleFinish}
                  onObstacleHit={handleObstacleHit}
                />
              </ErrorBoundary>
            </Physics>
          </ErrorBoundary>

          {carReady && (
            <ErrorBoundary name="CameraController">
              <CameraController target={carRef} />
            </ErrorBoundary>
          )}
          <ErrorBoundary name="Stats">
            <Stats />
          </ErrorBoundary>
      </Suspense>
    </Canvas>
    </div>
  )
}