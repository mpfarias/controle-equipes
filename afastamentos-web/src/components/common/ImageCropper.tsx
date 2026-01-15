import { useState, useRef, useCallback } from 'react';
import ReactCrop, {
  type Crop,
  centerCrop,
  makeAspectCrop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

const ASPECT_RATIO = 3 / 4; // Proporção 3x4 para foto de rosto
const MIN_WIDTH = 150;
const MIN_HEIGHT = 200; // Mantém proporção 3x4 (150 * 4/3 = 200)

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      ASPECT_RATIO,
      width,
      height,
    );
    const centeredCrop = centerCrop(crop, width, height);
    setCrop(centeredCrop);
  }, []);

  const getCroppedImg = useCallback(() => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return;
    }

    const image = imgRef.current;
    const canvas = canvasRef.current;
    const crop = completedCrop;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const pixelRatio = window.devicePixelRatio;
    canvas.width = crop.width * scaleX * pixelRatio;
    canvas.height = crop.height * scaleY * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }
        const fileReader = new FileReader();
        fileReader.readAsDataURL(blob);
        fileReader.onload = () => {
          const base64String = fileReader.result as string;
          onCropComplete(base64String);
        };
      },
      'image/jpeg',
      0.9,
    );
  }, [completedCrop, onCropComplete]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h4 style={{ marginBottom: '16px' }}>Enquadrar Foto</h4>
      <p style={{ marginBottom: '16px', color: '#64748b', fontSize: '0.9rem' }}>
        Ajuste o recorte para mostrar apenas o rosto do policial
      </p>
      
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={ASPECT_RATIO}
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
        >
          <img
            ref={imgRef}
            alt="Crop me"
            src={imageSrc}
            style={{ maxWidth: '100%', maxHeight: '400px' }}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          display: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="primary"
          onClick={getCroppedImg}
          disabled={!completedCrop}
        >
          Confirmar Corte
        </button>
      </div>
    </div>
  );
}
