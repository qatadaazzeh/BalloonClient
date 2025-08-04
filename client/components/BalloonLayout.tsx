import { ReactNode } from "react";
import BalloonHeader from "./BalloonHeader";

interface BalloonLayoutProps {
  children: ReactNode;
}

export default function BalloonLayout({ children }: BalloonLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <BalloonHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
