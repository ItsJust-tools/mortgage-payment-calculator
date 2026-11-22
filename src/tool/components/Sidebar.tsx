'use client';

import React from 'react';
import { VIEW_OPTIONS } from '../ui-shared';
import type { ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="mortgage-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Schedule view</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {VIEW_OPTIONS.map((view) => (
            <li key={view.value} className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...state, view: view.value })}
                className={`rounded px-1 ${state.view === view.value ? 'font-semibold text-sky-600 dark:text-sky-400' : ''}`}
              >
                {view.label}
              </button>
              <span className="text-gray-500 dark:text-gray-400">{view.hint}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved snapshots</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">About</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Monthly payments use the standard amortization formula
          <span className="block mt-1 font-mono">P = L·r / (1 − (1+r)^−n)</span>
          with r the monthly rate and n the number of payments. Extra payments go straight to
          principal, cutting total interest and the payoff time.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current loan inputs; open it
          to restore this calculation.
        </p>
      </div>
    </div>
  );
};
