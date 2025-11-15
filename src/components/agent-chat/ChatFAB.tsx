"use client";

import React, { useState } from 'react';
import { MessageSquare } from "lucide-react";
import { ChatContainer } from "./ChatContainer";

export function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development (Claude Agent SDK requires local filesystem)
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isDevelopment) {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 h-10 px-4 rounded-md shadow-sm bg-primary hover:bg-gray-900 transition-all duration-150 flex items-center gap-2 text-primary-foreground font-medium text-14 border border-gray-300"
          aria-label="Build"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Build</span>
        </button>
      )}

      <ChatContainer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
