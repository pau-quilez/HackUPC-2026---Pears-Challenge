import { DICE_SIDES } from '../../shared/src/index.js'

export function rollDie () {
  return Math.floor(Math.random() * DICE_SIDES) + 1
}

export function rollDice (count = 2) {
  const values = []
  for (let i = 0; i < count; i++) {
    values.push(rollDie())
  }
  return {
    values,
    total: values.reduce((sum, v) => sum + v, 0),
    count
  }
}
