'use client'
import { RigidBody, RapierRigidBody } from "@react-three/rapier"
import { useFrame } from "@react-three/fiber"
import { useRef, useMemo } from "react"
import { Vector3 } from "three"
import * as THREE from "three"

type VerticalObstacle = {
  id: number
  position: Vector3
  direction: number // 1 for up, -1 for down
  speed: number
  trackPosition: number // 0 to 1 along the track
  verticalPosition: number // 0 to 1 for up and down movement
  baseHeight: number
}

export default function VerticalObstacles() {
  const obstacleRefs = useRef<Array<RapierRigidBody | null>>([])
  
  // Create obstacles at different positions along the track
  const obstacles = useMemo<VerticalObstacle[]>(() => [
    { id: 0, position: new Vector3(), direction: 1, speed: 0.01, trackPosition: 0.3, verticalPosition: 0, baseHeight: 1.5 },
    { id: 2, position: new Vector3(), direction: 1, speed: 0.02, trackPosition: 0.7, verticalPosition: 0, baseHeight: 1.5 },
  ], [])
  
  // Calculate track path (same as in Track component)
  const trackPath = useMemo(() => {
    const points = []
    const segments = 100
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = t * 50 - 25
      const z = Math.sin(t * Math.PI * 2) * 6
      const y = 1 // Flat track at consistent height
      points.push(new THREE.Vector3(x, y, z))
    }
    
    return new THREE.CatmullRomCurve3(points, false)
  }, [])

  useFrame(() => {
    obstacles.forEach((obstacle, index) => {
      const ref = obstacleRefs.current[index]
      if (!ref) return
      
      // Update vertical position (move up and down)
      obstacle.verticalPosition += obstacle.direction * obstacle.speed
      
      // Reverse direction at limits
      if (obstacle.verticalPosition >= 2) {
        obstacle.verticalPosition = 2
        obstacle.direction = -1
      } else if (obstacle.verticalPosition <= 0) {
        obstacle.verticalPosition = 0
        obstacle.direction = 1
      }
      
      // Get base position along track curve
      const trackPosition = trackPath.getPoint(obstacle.trackPosition)
      
      // Position obstacle above track with vertical movement
      const finalPosition = trackPosition.clone()
      finalPosition.y = obstacle.baseHeight + (obstacle.verticalPosition * 2) // Move 2 units up and down
      
      obstacle.position.copy(finalPosition)
      
      // Update rigid body position
      ref.setTranslation({ 
        x: finalPosition.x, 
        y: finalPosition.y,
        z: finalPosition.z 
      }, true)
    })
  })

  return (
    <>
      {obstacles.map((obstacle, index) => (
        <RigidBody
          key={obstacle.id}
          ref={(ref) => {
            obstacleRefs.current[index] = ref
            if (ref) {
              ref.userData = { isObstacle: true }
            }
          }}
          type="kinematicPosition"
          colliders="cuboid"
        >
          <mesh>
            <boxGeometry args={[1.0, 0.5, 1.0]} />
            <meshLambertMaterial color="#ff6b6b" />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}