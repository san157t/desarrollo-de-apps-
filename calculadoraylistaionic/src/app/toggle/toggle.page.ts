import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonToggle, IonLabel } from '@ionic/angular';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.page.html',
  styleUrls: ['./toggle.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonToggle, IonLabel, CommonModule, FormsModule]
})
export class TogglePage implements OnInit {
  wifi = true;
  bluetooth = false;

  constructor() {}
  ngOnInit() {}
}
