"use client"

import dynamic from "next/dynamic"
import { Web3Provider } from "../components/Web3Provider"
import { ConnectKitButton } from "connectkit"

const Scene = dynamic(() => import("../components/Scene"), { ssr: false })

export default function Home() {
  return (
    <Web3Provider>
      <div style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column"
      }}>
        <header style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10
        }}>
          <ConnectKitButton />
        </header>
        <div style={{ flex: 1 }}>
          <Scene />
        </div>
      </div>
    </Web3Provider>
  )
}