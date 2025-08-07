'use client'

import React from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { type Chain } from 'viem'

export const horizenTestnet = {
  id : 845320009,
  name : 'Horizen Testnet (Base Sepolia)',
  nativeCurrency : { name : 'Ether', symbol : 'ETH', decimals : 18 },
  rpcUrls : { default : { http : ['https://horizen-rpc-testnet.appchain.base.org'] }, },
  blockExplorers : { default : { name : 'Horizen', url : 'https://horizen-explorer-testnet.appchain.base.org/' }, },
} as const satisfies Chain


const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [horizenTestnet],
    transports: {
      // RPC URL for each chain
      [mainnet.id]: http(
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`,
      ),
      [horizenTestnet.id]: http(
        `https://horizen-rpc-testnet.appchain.base.org`,
      ),
    },


    // Required API Keys
    walletConnectProjectId: `${process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}`,

    // Required App Info
    appName: "Rawr Racer",

    // Optional App Info
    appDescription: "Rawr to Race!",
    appUrl: "https://family.co", // your app's url
    appIcon: "https://family.co/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children } : { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};