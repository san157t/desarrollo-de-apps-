import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonButton, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.page.html',
  styleUrls: ['./toast.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonButton, CommonModule, FormsModule]
})
export class ToastPage implements OnInit {
  constructor(private toastCtrl: ToastController) {}

  ngOnInit() {}

  async mostrarToast() {
    const toast = await this.toastCtrl.create({
      message: 'Este es un ion-toast de ejemplo',
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
