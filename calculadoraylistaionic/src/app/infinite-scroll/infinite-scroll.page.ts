import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonInfiniteScroll, IonInfiniteScrollContent
} from '@ionic/angular';

@Component({
  selector: 'app-infinite-scroll',
  templateUrl: './infinite-scroll.page.html',
  styleUrls: ['./infinite-scroll.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonInfiniteScroll, IonInfiniteScrollContent, CommonModule]
})
export class InfiniteScrollPage {
  items: number[] = [];

  constructor() {
    this.cargarMas();
  }

  cargarMas(event?: any) {
    const inicio = this.items.length;
    for (let i = inicio; i < inicio + 20; i++) {
      this.items.push(i + 1);
    }
    if (event) {
      event.target.complete();
    }
  }
}
