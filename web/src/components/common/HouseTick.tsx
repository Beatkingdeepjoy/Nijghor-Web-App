import React from 'react';
import type { MessageRecord } from '../../types/db';

interface HouseTickProps {
  status: MessageRecord['status'];
  className?: string;
}

export const HouseTick: React.FC<HouseTickProps> = ({ status, className = 'w-3.5 h-3.5' }) => {
  // Clock Icon (Pending in Local Outbox)
  if (status === 'pending') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        className={`${className} text-stone-400 animate-spin`}
        style={{ animationDuration: '3s' }}
        title="Pending (Clock: in local outbox)"
      >
        <circle cx="8" cy="8" r="6" strokeWidth="1.5" />
        <path d="M8 5V8L10 10" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Single Outline House (Sent to Server Relay)
  if (status === 'sent') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        className={`${className} text-stone-400 dark:text-vault-dark-muted`}
        title="Sent (Outline House)"
      >
        <path
          d="M8 2.5L2.5 7V13.5H6.5V9.5H9.5V13.5H13.5V7L8 2.5Z"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Filled House (Delivered to Recipient Browser)
  if (status === 'delivered') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        stroke="none"
        className={`${className} text-vault-sage`}
        title="Delivered (Filled House)"
      >
        <path d="M8 2.5L2.5 7V13.5H6.5V9.5H9.5V13.5H13.5V7L8 2.5Z" />
      </svg>
    );
  }

  // Glowing House (Read by Recipient)
  if (status === 'read') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="#C8553D"
        className={`${className} filter drop-shadow-[0_0_4px_rgba(200,85,61,0.8)] dark:drop-shadow-[0_0_6px_rgba(232,168,87,0.9)]`}
        title="Read (Glowing House)"
      >
        <path d="M8 2.5L2.5 7V13.5H6.5V9.5H9.5V13.5H13.5V7L8 2.5Z" />
      </svg>
    );
  }

  return null;
};
