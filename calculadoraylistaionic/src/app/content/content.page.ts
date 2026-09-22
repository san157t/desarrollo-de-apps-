import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonItem, IonLabel } from '@ionic/angular';

@Component({
  selector: 'app-content',
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonItem, IonLabel, CommonModule]
})
export class ContentPage {
  numeros = Array.from({ length: 20 }, (_, i) => i + 1);
  constructor() {}
}
