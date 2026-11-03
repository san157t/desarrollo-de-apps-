import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { Ui } from '../core/ui.service';
import { cop, errMsg } from '../config';

@Component({
  selector: 'app-rating-sheet',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="scrim" (click)="closed.emit()"></div>
    <div class="sheet" role="dialog" aria-label="Calificar viaje">
      <h2 class="h2">¿Cómo fue tu viaje{{ driver ? ' con ' + driver : '' }}?</h2>
      @if (fare) { <div class="muted">Total del viaje: <b>{{ cop(fare) }}</b></div> }
      <div class="stars" role="radiogroup" aria-label="Calificación">
        @for (n of [1, 2, 3, 4, 5]; track n) {
          <button type="button" role="radio" [attr.aria-checked]="score === n" [attr.aria-label]="n + ' estrellas'"
                  [class.on]="n <= score" (click)="score = n">★</button>
        }
      </div>
      <textarea class="field" rows="3" placeholder="Cuéntanos más (opcional)" [(ngModel)]="comment"></textarea>
      <label class="check"><input type="checkbox" [(ngModel)]="incident"> Tuve un problema durante el viaje</label>
      <button class="btn" [disabled]="!score || busy" (click)="send()">Enviar calificación</button>
      <button class="btn alt" (click)="closed.emit()">Ahora no</button>
    </div>
  `,
})
export class RatingSheetComponent {
  @Input({ required: true }) tripId!: number;
  @Input() driver?: string;
  @Input() fare?: number;
  @Output() done = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private api = inject(Api);
  private ui = inject(Ui);
  cop = cop;
  score = 0;
  comment = '';
  incident = false;
  busy = false;

  async send() {
    this.busy = true;
    try {
      await this.api.post(`/client/trips/${this.tripId}/rating`, {
        score: this.score, comment: this.comment || null, has_incident: this.incident,
      });
      this.ui.toast('¡Gracias por tu calificación!');
      this.done.emit();
    } catch (e) {
      this.ui.toast(errMsg(e));
    } finally {
      this.busy = false;
    }
  }
}
