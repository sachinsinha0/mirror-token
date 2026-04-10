import React from 'react';

interface Props {
  hex: string;
  size?: number;
}

export function ColorSwatch({ hex, size = 20 }: Props) {
  return (
    <span
      className="color-swatch"
      style={{
        backgroundColor: hex,
        width: size,
        height: size,
        display: 'inline-block',
        borderRadius: 4,
        border: '1px solid var(--figma-color-border)',
        flexShrink: 0,
      }}
      title={hex}
    />
  );
}
