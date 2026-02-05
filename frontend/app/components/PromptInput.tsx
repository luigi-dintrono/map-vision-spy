'use client';

import { useState } from 'react';

export interface Prompt {
  id: string;
  text: string;
  color: string;
}

interface PromptInputProps {
  prompts: Prompt[];
  onPromptsChange: (prompts: Prompt[]) => void;
}

const DEFAULT_COLORS = ['#FF69B4', '#00FF00', '#FF0000', '#0000FF', '#FFFF00', '#FF00FF'];

export default function PromptInput({ prompts, onPromptsChange }: PromptInputProps) {
  const addPrompt = () => {
    const newPrompt: Prompt = {
      id: Date.now().toString(),
      text: '',
      color: DEFAULT_COLORS[prompts.length % DEFAULT_COLORS.length],
    };
    onPromptsChange([...prompts, newPrompt]);
  };

  const removePrompt = (id: string) => {
    onPromptsChange(prompts.filter((p) => p.id !== id));
  };

  const updatePrompt = (id: string, updates: Partial<Prompt>) => {
    onPromptsChange(
      prompts.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
        Object Types
      </label>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Describe objects to find. Add multiple prompts for different object types.
      </p>

      {prompts.map((prompt, index) => (
        <div
          key={prompt.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <input
            type="color"
            value={prompt.color}
            onChange={(e) => updatePrompt(prompt.id, { color: e.target.value })}
            style={{
              width: '40px',
              height: '36px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          />
          <input
            type="text"
            value={prompt.text}
            onChange={(e) => updatePrompt(prompt.id, { text: e.target.value })}
            placeholder={index === 0 ? 'tennis courts' : index === 1 ? 'sand traps' : 'another object type'}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
          <button
            onClick={() => removePrompt(prompt.id)}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#666',
            }}
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={addPrompt}
        style={{
          width: '100%',
          padding: '8px',
          background: '#f0f0f0',
          border: '1px dashed #ccc',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#666',
        }}
      >
        + Add prompt
      </button>
    </div>
  );
}
