<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Galería de Evidencias</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- PASO 02: toggle de calidad -->
      <ion-item lines="none">
        <ion-label>Alta calidad</ion-label>
        <ion-toggle v-model="highQuality"></ion-toggle>
      </ion-item>

      <ion-grid>
        <ion-row>
          <ion-col
            v-for="photo in photos"
            :key="photo.filepath"
            size="12"
            size-md="6"
            size-lg="4"
          >
            <ion-card>
              <ion-img
                :src="photo.webviewPath"
                :alt="photo.filepath"
                @click="() => showActionSheet(photo)"
              ></ion-img>
            </ion-card>
          </ion-col>

          <ion-col v-if="photos.length === 0" size="12" class="ion-text-center">
            <p style="color: #64748b; margin-top: 40px;">
              No hay evidencias capturadas.<br />Presione el botón de la cámara para iniciar.
            </p>
          </ion-col>
        </ion-row>
      </ion-grid>

      <ion-fab vertical="bottom" horizontal="center" slot="fixed">
        <ion-fab-button @click="addNewToGallery">
          <ion-icon :icon="camera"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonGrid, IonRow, IonCol, IonImg, IonFab,
  IonFabButton, IonIcon, IonCard,
  IonItem, IonLabel, IonToggle,
  actionSheetController,
} from '@ionic/vue';
import { camera, trash, close } from 'ionicons/icons';
import { usePhotoGallery, type UserPhoto } from '../composables/usePhotoGallery';

const { photos, addNewToGallery, deletePhoto, highQuality } = usePhotoGallery();

const showActionSheet = async (photo: UserPhoto) => {
  const actionSheet = await actionSheetController.create({
    header: 'Fotos',
    buttons: [
      {
        text: 'Eliminar',
        role: 'destructive',
        icon: trash,
        handler: async () => {
          await deletePhoto(photo);
        },
      },
      {
        text: 'Cancelar',
        icon: close,
        role: 'cancel',
      },
    ],
  });
  await actionSheet.present();
};
</script>