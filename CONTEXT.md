# Gin 13

A multi-round card game for 3–4 players, similar to gin/rummy, with a unique wild-card rotation over 13 rounds.

## Language

**Gin 13**:
A card game in which players draw, meld, and discard to minimise their hand score across 13 rounds.
_Avoid_: Gin Rummy, Rummy 13

**Points**:
Each non-wild card is worth its rank value (A=10, 2=2, ..., 10=10, J=10, Q=10, K=10). Wild cards are worth 25 points. At round end, each player except the one who went out scores the sum of cards remaining in their hand. Lowest cumulative total after 13 rounds wins.
_Avoid_: Score, penalty

**Wild progression**:
Across 13 rounds, the wild rank ascends sequentially: round 1 = A, round 2 = 2, ..., round 13 = K. Fixed per match, not randomized.

**Wild card**:
Any card matching the round's wild rank. Can substitute for any card in a meld. Worth 25 points if held at round end. A wild freed by Manipulation returns to the manipulator's hand.

**Lay down**:
The act of playing a meld from hand onto the table for the first time. A player must lay down at least one meld before they can manipulate any existing melds.
_Avoid_: Play, go down

**Manipulate**:
The act of adding cards to, swapping cards within, or re-arranging any meld on the table (regardless of who laid it down). Only allowed once a player has already laid down at least one meld of their own. A wild swapped out of a meld returns to the manipulator's hand.
_Avoid_: Play on, piggyback

**Meld**:
A set of cards on the table that forms either a 3-of-a-kind, 4-of-a-kind, or a straight flush of 4+ cards of the same suit. All melds are communal — any player may manipulate any meld.
_Avoid_: Set, run, combination

**Straight flush**:
Four or more cards of the same suit in consecutive rank order. A is low for straights (A, 2, 3, ...). Wrapping (e.g. Q, K, A, 2) is illegal. No upper length limit.

**Going out**:
Emptying the hand by laying down and/or manipulating melds, then discarding the last remaining card to end the round. The player who goes out scores 0 for that round.

**Round**:
One of 13 sub-games within a full Gin 13 match. Each round has a designated wild rank. A round ends when one player goes out. When the draw deck is exhausted, the discard pile (except its top card) is shuffled to form a new draw deck. The player who goes first rotates clockwise each round.
_Avoid_: Hand, game

## Relationships

- A **Gin 13** match consists of exactly 13 **Rounds**
- A **Meld** is either a 3-of-a-kind, 4-of-a-kind, or a **Straight flush**
- A player must **Lay down** before they can **Manipulate**
- A player **Goes out** to end the round

## Example dialogue

> **Dev:** "Can a player Manipulate on their first turn?"
> **Domain expert:** "No — they must Lay down at least one meld first. Once they have, on subsequent turns they can Manipulate freely."

> **Dev:** "Can a player go out by only Manipulating existing melds, without laying down a fresh meld?"
> **Domain expert:** "Yes — as long as they've laid down at least once on a previous turn."
