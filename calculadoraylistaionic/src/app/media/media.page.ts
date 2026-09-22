import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonImg, IonThumbnail, IonAvatar, IonItem, IonLabel } from '@ionic/angular';

@Component({
  selector: 'app-media',
  templateUrl: './media.page.html',
  styleUrls: ['./media.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonImg, IonThumbnail, IonAvatar, IonItem, IonLabel]
})
export class MediaPage {
  constructor() {}
}
