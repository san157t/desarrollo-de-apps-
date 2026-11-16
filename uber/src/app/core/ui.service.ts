import { Injectable, inject } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class Ui {
  private toasts = inject(ToastController);
  private alerts = inject(AlertController);

  async toast(message: string) {
    const t = await this.toasts.create({ message, duration: 2800, position: 'top' });
    await t.present();
  }

  async confirm(header: string, message: string, ok: string): Promise<boolean> {
    const a = await this.alerts.create({
      header, message,
      buttons: [{ text: 'Volver', role: 'cancel' }, { text: ok, role: 'confirm' }],
    });
    await a.present();
    return (await a.onDidDismiss()).role === 'confirm';
  }

  /** Devuelve el texto escrito, o null si la persona cancela. */
  async prompt(header: string, placeholder: string, ok: string): Promise<string | null> {
    const a = await this.alerts.create({
      header,
      inputs: [{ name: 'text', type: 'textarea', placeholder }],
      buttons: [{ text: 'Volver', role: 'cancel' }, { text: ok, role: 'confirm' }],
    });
    await a.present();
    const r = await a.onDidDismiss();
    return r.role === 'confirm' ? (r.data?.values?.text ?? '') : null;
  }
}
