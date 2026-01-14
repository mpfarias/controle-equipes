import { useEffect, useState } from 'react';

export type ConfirmDialogConfig = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => Promise<void> | void;
};

export type ConfirmConfig = Omit<ConfirmDialogConfig, 'open'>;

export function ConfirmDialog({
  config,
  onCancel,
  onConfirm,
}: {
  config: ConfirmDialogConfig;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { open, title, message, confirmLabel, cancelLabel } = config;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setLoading(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            className="danger"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
