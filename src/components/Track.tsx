'use client'
import { RigidBody } from "@react-three/rapier"
import { JSX, useMemo } from "react"
import * as THREE from "three"

export default function Track(): JSX.Element {
  // Create a winding path from start to finish
  const trackGeometry = useMemo(() => {
    const points = []
    const segments = 100 // Reduced for better performance
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments // Progress from 0 to 1
      
      // Gentler winding path with moderate elevation changes - made longer
      const x = t * 50 - 25 // Linear progression from -25 to 25
      const z = Math.sin(t * Math.PI * 2) * 6 // Gentler S-curves
      const y = 1 // Flat track at consistent height
      
      points.push(new THREE.Vector3(x, y, z))
    }
    
    const curve = new THREE.CatmullRomCurve3(points, false) // false = not closed
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, 1.0, 16, false)
    return tubeGeometry
  }, [])

  return (
    <>
      {/* Main track */}
      <RigidBody type="fixed">
        <mesh geometry={trackGeometry}>
          <meshLambertMaterial color="#404040" />
        </mesh>
      </RigidBody>
      
      {/* Start line marker */}
      <RigidBody type="fixed">
        <mesh position={[-25, 1, 0]}>
          <boxGeometry args={[0.1, 2, 4]} />
          <meshBasicMaterial color="#00ff00" />
        </mesh>
      </RigidBody>
      
      {/* Finish line marker */}
      <RigidBody type="fixed">
        <mesh position={[25, 1, 0]}>
          <boxGeometry args={[0.1, 2, 4]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </RigidBody>
      
      {/* Ground plane (lower for dramatic effect) */}
      {/* <RigidBody type="fixed">
        <mesh rotation-x={-Math.PI / 2} position={[0, -8, 0]}>
          <planeGeometry args={[50, 50]} />
          <meshBasicMaterial color="#2a5a2a" />
        </mesh>
      </RigidBody> */}
    </>
  )
}
