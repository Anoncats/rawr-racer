'use client'

import { useFrame, useThree } from "@react-three/fiber"
import { RefObject, useState, useEffect } from "react"
import { Vector3, Quaternion } from "three"
import { RapierRigidBody } from "@react-three/rapier"

interface CameraControllerProps {
  target: RefObject<RapierRigidBody | null>
  offset?: [number, number, number]
  enabled?: boolean
}

export function CameraController({
  target,
  offset = [0, 2, -5],
  enabled = true
}: CameraControllerProps) {
  const { camera } = useThree()
  const [isTargetReady, setIsTargetReady] = useState(false)

  // Check if target is ready
  useEffect(() => {
    if (!enabled || !target) return

    let timeoutId: NodeJS.Timeout
    
    const checkTarget = () => {
      try {
        if (target.current && typeof target.current.translation === 'function') {
          // Test if we can actually call the translation method
          target.current.translation()
          setIsTargetReady(true)
          console.log('CameraController: Target ready')
          return
        }
      } catch {
        console.warn('CameraController: Target not ready, retrying...')
      }
      
      // Retry after a short delay
      timeoutId = setTimeout(checkTarget, 100)
    }

    checkTarget()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [target, enabled])

  useFrame(() => {
    if (!enabled || !isTargetReady || !target?.current) return

    try {
      const body = target.current
      
      // Double-check the body is still valid
      if (!body || typeof body.translation !== 'function') {
        setIsTargetReady(false)
        return
      }

      const { x: px, y: py, z: pz } = body.translation()
      const { x: rx, y: ry, z: rz, w: rw } = body.rotation()
      
      const q = new Quaternion(rx, ry, rz, rw)
      const behind = new Vector3(...offset).applyQuaternion(q)
      const desired = new Vector3(px, py, pz).add(behind)

      camera.position.lerp(desired, 0.1)
      camera.lookAt(px, py, pz)
    } catch (error) {
      console.error('CameraController error:', error)
      setIsTargetReady(false)
    }
  })

  return null
}