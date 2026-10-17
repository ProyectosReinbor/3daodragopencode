import { randomInt, randomUUID } from 'node:crypto';
import { canVisitVenue } from '../shared/world-passport.js';
import { VENUE_GAME_REWARD } from '../shared/venue-game.js';
export function beginVenueGame(session,world,venue,position,now,pick=()=>randomInt(0,4)) {
  if (!canVisitVenue(venue,position)) throw Error('Entra al local para participar.');
  if ((world.venueGameCooldowns?.[venue]||0)>now) throw Error('Ya ganaste el premio de este local. Vuelve después de 24 horas.');
  if (session.venueGame && now-session.venueGame.issuedAt<1000) throw Error('Espera un momento antes de iniciar otra partida.');
  const challenge={token:randomUUID(),venue,pattern:Array.from({length:3},pick),issuedAt:now,readyAt:now+3500,expiresAt:now+60000};
  session.venueGame=challenge;
  return {...challenge,pattern:[...challenge.pattern]};
}
export function finishVenueGame(session,world,token,answers,position,now) {
  const challenge=session.venueGame;
  if (!challenge || challenge.token!==token) throw Error('Este intento ya terminó. Inicia otra partida.');
  session.venueGame=null;
  if (now<challenge.readyAt || now>challenge.expiresAt) throw Error('El intento está fuera de tiempo. Inicia otra partida.');
  if (!canVisitVenue(challenge.venue,position)) throw Error('Vuelve al local para terminar la partida.');
  if ((world.venueGameCooldowns?.[challenge.venue]||0)>now) throw Error('El premio de este local ya fue entregado.');
  const won=Array.isArray(answers)&&answers.length===challenge.pattern.length&&answers.every((answer,i)=>Number.isInteger(answer)&&answer===challenge.pattern[i]);
  if (!won) return {won:false,reward:null};
  world.venueGameCooldowns ||= {};
  world.venueGameCooldowns[challenge.venue]=now+86400000;
  return {won:true,reward:{...VENUE_GAME_REWARD}};
}
