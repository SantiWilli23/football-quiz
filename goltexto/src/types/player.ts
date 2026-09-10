export interface Player {
  id: number;
  name: string;
  team: string;
  league: string;
  nationality: string;
  position: string;
  age: number;
}

export interface Guess {
  player: Player;
  score: number;
}
