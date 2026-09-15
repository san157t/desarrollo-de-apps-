import { Component } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, AlertController
} from '@ionic/angular';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.page.html',
  styleUrls: ['./alert.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonButton]
})
export class AlertPage {
  constructor(private alertCtrl: AlertController) {}

  async mostrarAlerta() {
    const alert = await this.alertCtrl.create({
      header: '¡Atención!',
      message: 'Este es un ejemplo de ion-alert.',
      buttons: ['Aceptar']
    });
    await alert.present();
  }
}
