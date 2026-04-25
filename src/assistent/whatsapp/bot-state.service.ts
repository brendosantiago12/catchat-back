import { Injectable } from '@nestjs/common';

@Injectable()
export class BotStateService {
  private readyAt: number | null = null;

  setReadyAt(timestamp: number): void {
    this.readyAt = timestamp;
  }

  getReadyAt(): number | null {
    return this.readyAt;
  }
}
