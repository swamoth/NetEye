'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, Stars } from '@react-three/drei'
import * as THREE from 'three'

function Earth() {
  const earthRef = useRef<THREE.Mesh>(null)

  const earthTexture = useMemo(() => {
    return null
  }, [])

  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.002
    }
  })

  //the below funtion decide the roughness of the earth
  //triangles ≈ 2 × widthSegments × heightSegments
  //          = 2 × 64 × 64 = 8,192 triangles stick with this for time being

  return (
    <Sphere ref={earthRef} args={[2, 128,128]}>
      <meshStandardMaterial
        color="#1a4d8c"
        roughness={0.4}
        metalness={0.3}
      />
    </Sphere>
  )
}




//this is the atomsphere function which is light blue .
function Atmosphere() {
  const atmosphereRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += 0.002
    }
  })

  return (
    <Sphere ref={atmosphereRef} args={[2.1, 64, 64]}>
      <meshStandardMaterial
        color="#4da6ff"
        transparent
        opacity={0.1}
        side={THREE.BackSide}
      />
    </Sphere>
  )
}




function Scene() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <pointLight position={[-5, -3, -5]} intensity={0.5} color="#4da6ff" />

      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <Earth />
      <Atmosphere />

      //this is controls for globe
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={10}
        autoRotate={false}
      />
    </>
  )
}

export default function Globe() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <Scene />
      </Canvas>
    </div>
  )
}
