'use client'
import { RigidBody, RapierRigidBody } from "@react-three/rapier"
import { useFrame } from "@react-three/fiber"
import { useRef, useMemo } from "react"
import { Vector3 } from "three"
import * as THREE from "three"

type Obstacle = {
  id: number
  position: Vector3
  direction: number // 1 for right, -1 for left
  speed: number
  trackPosition: number // 0 to 1 along the track
  sidePosition: number // -1 to 1 for side to side movement
}

export default function SideObstacles() {
  const obstacleRefs = useRef<Array<RapierRigidBody | null>>([])
  
  // Create obstacles at different positions along the track
  const obstacles = useMemo<Obstacle[]>(() => [
    { id: 0, position: new Vector3(), direction: 1, speed: 0.01, trackPosition: 0.2, sidePosition: 0 },
    { id: 1, position: new Vector3(), direction: -1, speed: 0.012, trackPosition: 0.4, sidePosition: 0 },
    { id: 2, position: new Vector3(), direction: 1, speed: 0.01, trackPosition: 0.6, sidePosition: 1 },
  ], [])
  
  // Calculate track path (same as in Track component)
  const trackPath = useMemo(() => {
    const points = []
    const segments = 100
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = t * 50 - 25 // Updated to match longer track
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
      
      // Update side position (move side to side)
      obstacle.sidePosition += obstacle.direction * obstacle.speed
      
      // Reverse direction at sides
      if (obstacle.sidePosition >= 1) {
        obstacle.sidePosition = 1
        obstacle.direction = -1
      } else if (obstacle.sidePosition <= -1) {
        obstacle.sidePosition = -1
        obstacle.direction = 1
      }
      
      // Get base position along track curve (fixed track position)
      const trackPosition = trackPath.getPoint(obstacle.trackPosition)
      
      // Calculate perpendicular direction for side movement
      const tangent = trackPath.getTangent(obstacle.trackPosition)
      const perpendicular = new Vector3(-tangent.z, 0, tangent.x).normalize()
      
      // Position obstacle above track with side movement
      const finalPosition = trackPosition.clone()
      finalPosition.add(perpendicular.multiplyScalar(obstacle.sidePosition * 1.5)) // 1.5 units side movement
      finalPosition.y += 1.5 // Raised above track surface
      
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
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshLambertMaterial color="#af8899" />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}