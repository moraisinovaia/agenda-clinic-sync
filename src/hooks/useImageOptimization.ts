import { useState, useCallback } from 'react';

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

interface OptimizedImage {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export const useImageOptimization = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizeImage = useCallback(
    async (
      file: File,
      options: ImageOptimizationOptions = {}
    ): Promise<OptimizedImage> => {
      const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.8,
        format = 'jpeg'
      } = options;

      setIsOptimizing(true);

      try {
        return new Promise((resolve, reject) => {
          const img = new Image();
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }

          img.onload = () => {
            // Calcular dimensões mantendo aspect ratio
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            // Desenhar imagem redimensionada
            ctx.drawImage(img, 0, 0, width, height);

            // Converter para blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Falha na otimização da imagem'));
                  return;
                }

                const optimizedFile = new File(
                  [blob],
                  file.name.replace(/\.[^/.]+$/, `.${format}`),
                  { type: `image/${format}` }
                );

                const reader = new FileReader();
                reader.onload = (e) => {
                  const dataUrl = e.target?.result as string;
                  
                  resolve({
                    file: optimizedFile,
                    dataUrl,
                    originalSize: file.size,
                    compressedSize: blob.size,
                    compressionRatio: ((file.size - blob.size) / file.size) * 100
                  });
                };
                reader.readAsDataURL(optimizedFile);
              },
              `image/${format}`,
              quality
            );
          };

          img.onerror = () => {
            reject(new Error('Erro ao carregar imagem'));
          };

          // Carregar imagem
          const reader = new FileReader();
          reader.onload = (e) => {
            img.src = e.target?.result as string;
          };
          reader.readAsDataURL(file);
        });
      } finally {
        setIsOptimizing(false);
      }
    },
    []
  );

  const batchOptimize = useCallback(
    async (
      files: File[],
      options?: ImageOptimizationOptions
    ): Promise<OptimizedImage[]> => {
      setIsOptimizing(true);
      
      try {
        const optimizedImages = await Promise.all(
          files.map(file => optimizeImage(file, options))
        );
        
        return optimizedImages;
      } finally {
        setIsOptimizing(false);
      }
    },
    [optimizeImage]
  );

  return {
    optimizeImage,
    batchOptimize,
    isOptimizing
  };
};