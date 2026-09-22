import { ref, watch, onMounted } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { isPlatform, toastController } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';

export const usePhotoGallery = () => {
  const photos = ref<UserPhoto[]>([]);

  // PASO 02: modo calidad (true = alta calidad, false = baja/rápida)
  const highQuality = ref(true);

  const PHOTO_STORAGE = 'photos';

  const showToast = async (message: string, color: 'success' | 'danger' | 'medium' = 'medium') => {
    const toast = await toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    await toast.present();
  };

  const addNewToGallery = async () => {
    try {
      // Take a photo
      const capturedPhoto = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        // PASO 01: Prompt deja elegir entre Cámara o Galería
        source: CameraSource.Prompt,
        // PASO 02: calidad dinámica según el toggle
        quality: highQuality.value ? 100 : 50,
      });

      const fileName = Date.now() + '.jpeg';
      // Save the picture and add it to photo collection
      const savedImageFile = await savePicture(capturedPhoto, fileName);

      photos.value = [savedImageFile, ...photos.value];

      await showToast('Foto agregada correctamente', 'success');
    } catch (error: any) {
      // PASO 03: feedback si el usuario negó el permiso o canceló
      const message = error?.message || '';
      if (message.toLowerCase().includes('denied') || message.toLowerCase().includes('permission')) {
        await showToast('Permiso de cámara denegado. Habilítalo en ajustes.', 'danger');
      } else if (message.toLowerCase().includes('cancel')) {
        // el usuario simplemente canceló, no mostramos error
      } else {
        await showToast('No se pudo tomar la foto', 'danger');
      }
    }
  };

  const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
    let base64Data: string | Blob;
    // "hybrid" will detect mobile - iOS or Android
    if (isPlatform('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path!,
      });
      base64Data = typeof file.data === 'string' ? file.data : await file.data.text();
    } else {
      base64Data = await base64FromPath(photo.webPath!);
    }

    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (isPlatform('hybrid')) {
      // Display the new image by rewriting the 'file://' path to HTTP
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        webviewPath: photo.webPath,
      };
    }
  };

  const base64FromPath = async (path: string): Promise<string> => {
    const response = await fetch(path);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject('method did not return a string');
        }
      };
      reader.readAsDataURL(blob);
    });
  };

  const cachePhotos = () => {
    Preferences.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(photos.value),
    });
  };

  const loadSaved = async () => {
    const photoList = await Preferences.get({ key: PHOTO_STORAGE });
    const photosInPreferences = photoList.value ? JSON.parse(photoList.value) : [];

    // If running on the web...
    if (!isPlatform('hybrid')) {
      for (const photo of photosInPreferences) {
        const file = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data,
        });
        // Web platform only: Load the photo as base64 data
        photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
      }
    }

    photos.value = photosInPreferences;
  };

  const deletePhoto = async (photo: UserPhoto) => {
    photos.value = photos.value.filter((p) => p.filepath !== photo.filepath);

    const filename = photo.filepath.substring(photo.filepath.lastIndexOf('/') + 1);
    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data,
    });

    await showToast('Foto eliminada', 'medium');
  };

  onMounted(loadSaved);
  watch(photos, cachePhotos);

  return {
    addNewToGallery,
    photos,
    deletePhoto,
    highQuality,
  };
};

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}