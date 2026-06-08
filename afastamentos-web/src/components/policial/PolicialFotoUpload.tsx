import { useRef, useState } from 'react';
import {
  Box,
  Card,
  CardActions,
  CardMedia,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
} from '@mui/material';
import { AddPhotoAlternate, Delete, PhotoCamera } from '@mui/icons-material';
import { ImageCropper } from '../common/ImageCropper';

type PolicialFotoUploadProps = {
  fotoUrl: string | null | undefined;
  onChange: (fotoUrl: string | null) => void;
  onError?: (message: string) => void;
};

export function PolicialFotoUpload({ fotoUrl, onChange, onError }: PolicialFotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [imageForCrop, setImageForCrop] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError?.('Por favor, selecione uma imagem válida.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError?.('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageSrc = e.target?.result as string;
      setImageForCrop(imageSrc);
      setShowImageCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    onChange(croppedImageUrl);
    setShowImageCropper(false);
    setImageForCrop('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropCancel = () => {
    setShowImageCropper(false);
    setImageForCrop('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Card
          sx={{
            position: 'relative',
            width: 180,
            height: 240,
            borderRadius: 2,
            boxShadow: 3,
          }}
        >
          {fotoUrl ? (
            <>
              <CardMedia
                component="img"
                image={fotoUrl}
                alt="Foto do policial"
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <CardActions
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                  justifyContent: 'center',
                  p: 1,
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    color: 'white',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
                    mr: 1,
                  }}
                  title="Alterar foto"
                >
                  <PhotoCamera fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleRemove}
                  sx={{
                    color: 'white',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.8)' },
                  }}
                  title="Remover foto"
                >
                  <Delete fontSize="small" />
                </IconButton>
              </CardActions>
            </>
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.15)',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.25)' },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <AddPhotoAlternate sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Adicionar foto
              </Typography>
            </Box>
          )}
        </Card>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </Box>

      <Dialog
        open={showImageCropper}
        onClose={handleCropCancel}
        maxWidth="md"
        fullWidth
        sx={{ zIndex: 1800 }}
      >
        <DialogContent sx={{ p: 2 }}>
          {showImageCropper ? (
            <ImageCropper
              imageSrc={imageForCrop}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
