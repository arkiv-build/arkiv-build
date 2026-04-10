"use client";

import Link from "next/link";
import { LoaderCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArkivStore } from "@/store/useArkivStore";
import { ARKIV_CHAIN } from "@/lib/arkiv/chain";

const shortAddress = (address?: string) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";

export function TopNav() {
  const connectWallet = useArkivStore((state) => state.connectWallet);
  const retryNetworkSwitch = useArkivStore((state) => state.retryNetworkSwitch);
  const connecting = useArkivStore((state) => state.connecting);
  const account = useArkivStore((state) => state.account);
  const chainId = useArkivStore((state) => state.chainId);
  const walletAvailable = useArkivStore((state) => state.walletAvailable);

  const onArkivNetwork = chainId === ARKIV_CHAIN.id;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
      <nav className="flex items-center justify-between rounded-[20px] border border-gray-200 bg-white px-6 py-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]">
        {/* Logo and Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="font-mono text-xl font-bold tracking-widest text-[#111]">
            [ ARKIV BUILD ]
          </Link>
          <div className="hidden md:flex items-center gap-6 font-mono text-xs font-semibold tracking-wide text-gray-700">
            <Link href="#" className="hover:text-black transition-colors">
              Docs
            </Link>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {walletAvailable && (
            <div className="flex items-center mr-2">
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

          <Button
            onClick={account ? retryNetworkSwitch : connectWallet}
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
        </div>
      </nav>
    </div>
  );
}
