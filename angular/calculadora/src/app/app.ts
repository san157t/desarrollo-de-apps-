import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  numero1: number = 0;
  numero2: number = 0;

  operacion: string = '+';

  resultado: number = 0;

  historial: string[] = [];


  calcular() {

    switch (this.operacion) {

      case '+':
        this.resultado = this.numero1 + this.numero2;
        break;

      case '-':
        this.resultado = this.numero1 - this.numero2;
        break;

      case '*':
        this.resultado = this.numero1 * this.numero2;
        break;

      case '/':
        if (this.numero2 === 0) {
          alert('No se puede dividir entre cero');
          return;
        }

        this.resultado = this.numero1 / this.numero2;
        break;
    }

    this.historial.push(
      `${this.numero1} ${this.operacion} ${this.numero2} = ${this.resultado}`
    );
  }

}