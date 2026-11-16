import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack, call, car, carSport, chevronForward, close, home, location, logOut, person, receipt, search } from 'ionicons/icons';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class AppComponent {
  constructor() {
    addIcons({ arrowBack, call, car, carSport, chevronForward, close, home, location, logOut, person, receipt, search });
  }
}
