import { Component } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonMenu, IonMenuButton, IonButton, IonList, IonItem, IonLabel, MenuController
} from '@ionic/angular';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.page.html',
  styleUrls: ['./menu.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonMenu, IonMenuButton, IonButton, IonList, IonItem, IonLabel]
})
export class MenuPage {
  constructor(private menuCtrl: MenuController) {}

  abrirMenu() {
    this.menuCtrl.open('menu-demo');
  }
}
