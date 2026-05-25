"use client";

/**
 * Fundo leve (menos camadas que antes) para reduzir custo de GPU / repintura.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="aurora-base" />
      <div className="aurora-blob aurora-blob--a" />
      <div className="aurora-blob aurora-blob--b" />
      <div className="aurora-noise" />
    </div>
  );
}
