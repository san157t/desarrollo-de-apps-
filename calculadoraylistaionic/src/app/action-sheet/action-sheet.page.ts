import { Component } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, ActionSheetController
} from '@ionic/angular';

@Component({
  selector: 'app-action-sheet',
  templateUrl: './action-sheet.page.html',
  styleUrls: ['./action-sheet.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton]
})
export class ActionSheetPage {
  constructor(private actionSheetCtrl: ActionSheetController) {}

  async mostrarActionSheet() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Elige una opción',
      buttons: [
        { text: 'Compartir', icon: 'share-outline' },
        { text: 'Editar', icon: 'create-outline' },
        { text: 'Eliminar', role: 'destructive', icon: 'trash-outline' },
        { text: 'Cancelar', role: 'cancel', icon: 'close-outline' }
      ]
    });
    await actionSheet.present();
  }
}
