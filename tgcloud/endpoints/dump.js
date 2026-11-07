import { db } from 'sdk';
import { users } from '../schema.js';

export default async function () {
  return await db.select().from(users).limit(50).all();
}