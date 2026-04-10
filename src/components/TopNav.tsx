"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle, Wallet, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArkivStore } from "@/store/useArkivStore";
import { ARKIV_CHAIN } from "@/lib/arkiv/chain";

const shortAddress = (address?: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";

export function TopNav() {
  const connectWallet = useArkivStore((state) => state.connectWallet);
  const disconnectWallet = useArkivStore((state) => state.disconnectWallet);
  const retryNetworkSwitch = useArkivStore((state) => state.retryNetworkSwitch);
  const connecting = useArkivStore((state) => state.connecting);
  const account = useArkivStore((state) => state.account);
  const chainId = useArkivStore((state) => state.chainId);
  const walletAvailable = useArkivStore((state) => state.walletAvailable);
  const balance = useArkivStore((state) => state.balance);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onArkivNetwork = chainId === ARKIV_CHAIN.id;

  return (
    <div className="absolute top-6 left-6 right-6 z-50">
      <nav className="flex items-center justify-between rounded-[20px] border border-gray-200 bg-white px-6 py-4 shadow-md">
        {/* Logo */}
        <Link href="/" className="font-mono text-xl font-bold tracking-widest text-[#111]">
          [ ARKIV BUILD ]
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 mr-4 font-mono text-xs font-semibold tracking-wide text-gray-700">
            <Link 
              href="https://kaolin.hoodi.arkiv.network/faucet/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center h-8 rounded-lg bg-orange-500 text-white px-3 shadow-sm hover:bg-orange-600 transition-colors"
            >
              Faucet
            </Link>
            <Link href="https://arkiv.network/dev" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">
              Docs
            </Link>
          </div>
          
          {walletAvailable && account && (
            <div className="flex items-center">
              <span
                className={[
                  "shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider",
                  onArkivNetwork
                    ? "bg-[#e6f4ea] text-[#137333]"
                    : "bg-[#fce8e6] text-[#c5221f]",
                ].join(" ")}
              >
                {onArkivNetwork ? "Kaolin" : "Wrong network"}
              </span>

              {!onArkivNetwork && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retryNetworkSwitch}
                  className="ml-2 h-8 rounded-lg px-3 text-xs shadow-sm bg-white"
                >
                  Switch
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={account ? disconnectWallet : connectWallet}
              className="h-10 rounded-xl bg-[#1f1f1f] hover:bg-black font-semibold text-white px-4 transition-colors"
              disabled={connecting}
            >
              {connecting ? (
                <LoaderCircle className="size-4 animate-spin mr-2" />
              ) : (
                <Wallet className="size-4 mr-2" />
              )}
              {account ? shortAddress(account) : "Connect MetaMask"}
            </Button>
            
            {account && (
               <>
                 <div className="flex items-center h-10 px-4 rounded-xl border border-gray-200 bg-white shadow-sm font-mono text-sm font-semibold text-gray-700">
                    {balance ? `${Number(balance).toFixed(4)} KAO` : "Loading..."}
                 </div>
                 <Button
                   variant="outline"
                   size="icon"
                   onClick={copyAddress}
                   className="h-10 w-10 rounded-xl border-gray-200 shadow-sm bg-white"
                   title="Copy Address"
                 >
                   {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-gray-600" />}
                 </Button>
               </>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
